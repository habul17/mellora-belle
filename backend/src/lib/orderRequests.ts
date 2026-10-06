import { prisma } from "./prisma.js"
import { sendQueuedOrderEmails } from "./orderEmails.js"
import { cancelDeadline, returnDeadline, describeStatus } from "./orderStatus.js"
import type { OrderStatus } from "../generated/prisma/enums.js"
import { stopBooking, processShipmentsSoon } from "./shipments.js"

// Cancellations, returns and refunds. Refunds themselves are made by hand in
// the Razorpay dashboard; this records them. Every change is conditional on
// the status just read, so a double-click or two tabs can't apply it twice.

export class OrderRequestError extends Error {
    constructor(public httpStatus: number, message: string) {
        super(message);
    }
}

// Only faulty or wrong items can be returned: there are no returns or
// exchanges for a change of mind or the wrong size ordered.
export const RETURN_REASONS = ["Damaged or defective", "Wrong item or size sent", "Not as described"];

const TEXT_MAX = 500;
const CHANGED = "This order just changed. Refresh to see its latest state.";

function sendEmailsSoon() {
    sendQueuedOrderEmails().catch((err) => console.log("Sending order emails failed", err));
}

async function findOwnOrder(orderId: string, userId: string) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });

    // Someone else's order answers like a missing one.
    if (!order || order.userId !== userId) throw new OrderRequestError(404, "Order not found");

    return order;
}

function checkText(text: unknown, label: string) {
    const value = typeof text === "string" ? text.trim() : "";
    if (value.length > TEXT_MAX) throw new OrderRequestError(400, `${label} must be under ${TEXT_MAX} characters`);
    return value;
}

// Customer: ask to cancel, within an hour of paying and before it ships.
export async function requestCancellation(orderId: string, userId: string, reasonInput: unknown) {
    const reason = checkText(reasonInput, "The reason");
    const order = await findOwnOrder(orderId, userId);

    if (order.cancelRequestedAt) {
        throw new OrderRequestError(409, "You've already asked to cancel this order.");
    }
    if (!cancelDeadline(order)) {
        throw new OrderRequestError(400, "This order can't be cancelled online any more. Contact us and we'll help.");
    }

    await prisma.$transaction(async (tx) => {
        const claimed = await tx.order.updateMany({
            where: { id: order.id, status: order.status, cancelRequestedAt: null },
            data: {
                status: "CANCELLATION_REQUESTED",
                statusBeforeRequest: order.status,
                cancelRequestedAt: new Date(),
                requestReason: reason || null,
                requestDeclineNote: null,
            },
        });
        if (claimed.count === 0) throw new OrderRequestError(409, CHANGED);

        await tx.orderEmail.createMany({
            data: [{ orderId: order.id, kind: "CANCELLATION_REQUESTED" }],
            skipDuplicates: true,
        });
    });

    sendEmailsSoon();
}

// Customer: ask to return, within 2 days of delivery.
export async function requestReturn(orderId: string, userId: string, reasonInput: unknown, detailsInput: unknown) {
    if (typeof reasonInput !== "string" || !RETURN_REASONS.includes(reasonInput)) {
        throw new OrderRequestError(400, "Choose a reason for the return");
    }
    const details = checkText(detailsInput, "The details");
    const order = await findOwnOrder(orderId, userId);

    if (order.returnRequestedAt) {
        throw new OrderRequestError(409, "You've already asked to return this order.");
    }
    if (!returnDeadline(order)) {
        throw new OrderRequestError(400, "This order can't be returned online any more. Contact us and we'll help.");
    }

    await prisma.$transaction(async (tx) => {
        const claimed = await tx.order.updateMany({
            where: { id: order.id, status: "DELIVERED", returnRequestedAt: null },
            data: {
                status: "RETURN_REQUESTED",
                statusBeforeRequest: "DELIVERED",
                returnRequestedAt: new Date(),
                requestReason: details ? `${reasonInput}: ${details}` : reasonInput,
                requestDeclineNote: null,
            },
        });
        if (claimed.count === 0) throw new OrderRequestError(409, CHANGED);

        await tx.orderEmail.createMany({
            data: [{ orderId: order.id, kind: "RETURN_REQUESTED" }],
            skipDuplicates: true,
        });
    });

    sendEmailsSoon();
}

const ADMIN_CANCELLABLE: OrderStatus[] = ["PAID", "PACKED", "CANCELLATION_REQUESTED"];

// Admin: cancel a paid order that hasn't shipped: approving a request, a
// customer who phoned, or an order the shop can't fulfil. The items never
// left, so their stock goes back on sale.
export async function cancelOrder(orderId: string) {
    await prisma.$transaction(async (tx) => {
        const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });

        if (!order) throw new OrderRequestError(404, "Order not found");
        if (!ADMIN_CANCELLABLE.includes(order.status)) {
            throw new OrderRequestError(409, `This order is ${describeStatus(order.status)}, so it can't be cancelled here.`);
        }

        const claimed = await tx.order.updateMany({
            where: { id: order.id, status: order.status },
            data: { status: "CANCELLED", cancelledAt: new Date() },
        });
        if (claimed.count === 0) throw new OrderRequestError(409, CHANGED);

        for (const item of order.items) {
            await tx.variant.update({
                where: { id: item.variantId },
                data: { stockQuantity: { increment: item.quantity } },
            });
        }

        await tx.orderEmail.createMany({
            data: [{ orderId: order.id, kind: "ORDER_CANCELLED" }],
            skipDuplicates: true,
        });

        // A packed order may already be booked with Shiprocket.
        await stopBooking(tx, order.id, "cancelled");
    });

    sendEmailsSoon();
    processShipmentsSoon();
}

// Admin: say no to a request, with a reason the customer is emailed. The
// order goes back to where it was.
export async function declineRequest(orderId: string, noteInput: unknown) {
    const note = checkText(noteInput, "The note");
    if (!note) throw new OrderRequestError(400, "Write a short note telling the customer why");

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new OrderRequestError(404, "Order not found");

    const isCancel = order.status === "CANCELLATION_REQUESTED";
    if (!isCancel && order.status !== "RETURN_REQUESTED") {
        throw new OrderRequestError(409, "This order has no open request. Refresh to see its latest state.");
    }

    const backTo: OrderStatus = isCancel ? (order.statusBeforeRequest ?? "PAID") : "DELIVERED";

    await prisma.$transaction(async (tx) => {
        const claimed = await tx.order.updateMany({
            where: { id: order.id, status: order.status },
            data: { status: backTo, requestDeclineNote: note },
        });
        if (claimed.count === 0) throw new OrderRequestError(409, CHANGED);

        await tx.orderEmail.createMany({
            data: [{ orderId: order.id, kind: isCancel ? "CANCELLATION_DECLINED" : "RETURN_DECLINED" }],
            skipDuplicates: true,
        });
    });

    sendEmailsSoon();
}

// Admin: the returned parcel has arrived and been checked. Its stock is not
// added back automatically: only the admin knows if it can be sold again.
export async function markReturned(orderId: string) {
    const claimed = await prisma.order.updateMany({
        where: { id: orderId, status: "RETURN_REQUESTED" },
        data: { status: "RETURNED", returnedAt: new Date() },
    });

    if (claimed.count === 0) {
        const exists = await prisma.order.count({ where: { id: orderId } });
        throw exists
            ? new OrderRequestError(409, "This order has no open return request. Refresh to see its latest state.")
            : new OrderRequestError(404, "Order not found");
    }
}

// Admin: a returned item was replaced, so no refund is owed. The replacement
// is sent by hand, outside the order.
export async function markReplaced(orderId: string) {
    const claimed = await prisma.order.updateMany({
        where: { id: orderId, status: "RETURNED", refundedAt: null, replacementSentAt: null },
        data: { replacementSentAt: new Date() },
    });

    if (claimed.count === 0) {
        const exists = await prisma.order.count({ where: { id: orderId } });
        throw exists
            ? new OrderRequestError(409, "This order isn't a return waiting for a refund. Refresh to see its latest state.")
            : new OrderRequestError(404, "Order not found");
    }
}

// Admin: record a refund already made in the Razorpay dashboard.
export async function markRefunded(orderId: string, amountInput: unknown, referenceInput: unknown) {
    const reference = checkText(referenceInput, "The refund reference").slice(0, 100);
    const amount = Number(amountInput);

    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { payment: true } });
    if (!order) throw new OrderRequestError(404, "Order not found");

    const owed = ((order.status === "CANCELLED" && order.payment?.status === "PAID") || order.status === "RETURNED") &&
        !order.replacementSentAt;
    if (!owed || order.refundedAt) {
        throw new OrderRequestError(409, "This order isn't waiting for a refund. Refresh to see its latest state.");
    }

    if (!Number.isInteger(amount) || amount < 1 || amount > order.totalAmount) {
        throw new OrderRequestError(400, `Enter the refunded amount in whole rupees, from 1 to ${order.totalAmount}`);
    }

    await prisma.$transaction(async (tx) => {
        const claimed = await tx.order.updateMany({
            where: { id: order.id, status: order.status, refundedAt: null },
            data: { refundedAt: new Date(), refundAmount: amount, refundReference: reference || null },
        });
        if (claimed.count === 0) throw new OrderRequestError(409, CHANGED);

        await tx.orderEmail.createMany({
            data: [{ orderId: order.id, kind: "REFUND_ISSUED" }],
            skipDuplicates: true,
        });
    });

    sendEmailsSoon();
}
