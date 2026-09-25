import { prisma } from "./prisma.js"
import { reconcilePayment } from "./confirmPayment.js"

type ReleasableOrder = {
    id: string;
    items: { variantId: string; quantity: number }[];
};

// Cancels one PENDING order and puts its reserved stock back.
// Returns true only for the call that actually did the cancelling, so the
// stock can never be credited twice.
export async function cancelAndReleaseStock(order: ReleasableOrder) {
    return prisma.$transaction(async (tx) => {
        const claimed = await tx.order.updateMany({
            where: { id: order.id, status: "PENDING" },
            data: { status: "CANCELLED" }
        });

        if (claimed.count === 0) return false;

        for (const item of order.items) {
            await tx.variant.update({
                where: { id: item.variantId },
                data: { stockQuantity: { increment: item.quantity } }
            });
        }

        return true;
    });
}

export async function releaseExpiredReservations() {
    const expiredOrders = await prisma.order.findMany({
        where: {
            status: "PENDING",
            reservedUntil: { lte: new Date() }
        },
        include: { items: true, payment: true }
    });

    let releasedCount = 0;

    for (const order of expiredOrders) {
        try {
            if (order.payment) {
                // The customer opened the payment window. Before giving the
                // stock away, make sure the money did not actually arrive with
                // its webhook lost. If Razorpay cannot be reached, this throws
                // and the order is skipped until the next sweep — holding
                // stock a minute longer is far cheaper than cancelling a
                // paid order.
                const paid = await reconcilePayment(order.payment);

                if (paid) continue;
            }

            const released = await cancelAndReleaseStock(order);

            if (released) releasedCount++;
        } catch (err) {
            console.log(`Failed to release reservation for order ${order.id}`, err);
        }
    }

    return releasedCount;
}
