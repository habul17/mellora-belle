import { Prisma } from "../generated/prisma/client.js"
import { prisma } from "./prisma.js"
import { getRazorpay } from "./razorpay.js"

export type MarkPaidResult = "paid" | "already-paid" | "refund-needed";

type OrderLine = { variantId: string; quantity: number };

// Takes stock again for an order whose hold already expired. All or nothing:
// if any line has sold out in the meantime, the lines already taken are put
// back, so a half-restocked order can never exist.
async function retakeStock(tx: Prisma.TransactionClient, items: OrderLine[]) {
    const taken: OrderLine[] = [];

    for (const item of items) {
        const result = await tx.variant.updateMany({
            where: { id: item.variantId, stockQuantity: { gte: item.quantity } },
            data: { stockQuantity: { decrement: item.quantity } }
        });

        if (result.count === 0) {
            for (const done of taken) {
                await tx.variant.update({
                    where: { id: done.variantId },
                    data: { stockQuantity: { increment: done.quantity } }
                });
            }
            return false;
        }

        taken.push(item);
    }

    return true;
}

// The one place an order becomes PAID. The webhook, the browser asking "did my
// payment go through?", and the expiry sweep can all arrive here in any order,
// even at the same moment. The payment row is the claim ticket: only the first
// caller gets past it, so nothing below can ever run twice.
export async function markOrderPaid(
    paymentId: string,
    razorpayPaymentId: string,
    rawWebhookPayload?: Prisma.InputJsonValue
): Promise<MarkPaidResult> {
    return prisma.$transaction(async (tx) => {
        const claimed = await tx.payment.updateMany({
            where: { id: paymentId, status: { not: "PAID" } },
            data: {
                status: "PAID",
                razorpayPaymentId,
                ...(rawWebhookPayload !== undefined && { rawWebhookPayload })
            }
        });

        if (claimed.count === 0) return "already-paid";

        const payment = await tx.payment.findUniqueOrThrow({
            where: { id: paymentId },
            include: { order: { include: { items: true } } }
        });
        const order = payment.order;

        // Conditional, not a plain update: if the expiry sweep cancels this
        // order at the same instant, the database makes one of us wait and
        // re-check, instead of both acting on a status that is already stale.
        const movedFromPending = await tx.order.updateMany({
            where: { id: order.id, status: "PENDING" },
            data: { status: "PAID" }
        });

        if (movedFromPending.count === 0) {
            // The money arrived after the hold expired, and the stock has
            // already gone back on sale. Try to take it again.
            const retaken = await retakeStock(tx, order.items);

            if (!retaken) {
                // The payment stays recorded as PAID (the money really did
                // arrive) while the order stays CANCELLED. That pairing is how
                // the admin spots an order that needs a refund.
                console.log(`REFUND NEEDED: order ${order.id} was paid (${razorpayPaymentId}) after its items sold out`);
                return "refund-needed";
            }

            await tx.order.update({
                where: { id: order.id },
                data: { status: "PAID" }
            });
        }

        // Take the purchased lines out of the cart, but leave anything the
        // customer added after checkout so they do not silently lose it.
        await tx.cartItem.deleteMany({
            where: {
                cart: { userId: order.userId },
                variantId: { in: order.items.map((item) => item.variantId) }
            }
        });

        return "paid";
    });
}

// Asks Razorpay directly whether an order has been paid, for when the webhook
// is late or never arrives. A browser can ask us to check, but the answer
// always comes from Razorpay — never from the browser itself.
export async function reconcilePayment(payment: { id: string; razorpayOrderId: string; amount: number }) {
    const { items } = await getRazorpay().orders.fetchPayments(payment.razorpayOrderId);

    const captured = items.find(
        (p) => p.status === "captured" && Number(p.amount) === payment.amount
    );

    if (!captured) return null;

    return markOrderPaid(payment.id, captured.id);
}
