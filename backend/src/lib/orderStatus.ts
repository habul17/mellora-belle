import type { OrderStatus } from "../generated/prisma/enums.js"

// The steps the admin moves a paid order through, in order. PAID is only ever
// set by the payment code, and cancellations and returns have their own
// routes (orderRequests.ts), so here the admin can move an order forward one
// step at a time and nothing else: no skipping (PAID -> DELIVERED) and no
// going back.
const ADMIN_STEPS: OrderStatus[] = ["PAID", "PACKED", "SHIPPED", "DELIVERED"];

// The status an order must be in right now for the admin to move it to
// `target`, or null if `target` isn't a step the admin can take by hand.
export function statusBefore(target: unknown): OrderStatus | null {
    const index = ADMIN_STEPS.indexOf(target as OrderStatus);
    return index > 0 ? ADMIN_STEPS[index - 1]! : null;
}

// "CANCELLATION_REQUESTED" -> "cancellation requested", for error messages.
export function describeStatus(status: OrderStatus) {
    return status.toLowerCase().replace(/_/g, " ");
}

// The Cancellation & Refunds policy (frontend/src/lib/business.ts `returns`)
// promises these windows. Change both together.
const CANCEL_WINDOW_MS = 60 * 60 * 1000;
const RETURN_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;

type RequestableOrder = {
    status: OrderStatus;
    paidAt: Date | null;
    deliveredAt: Date | null;
    cancelRequestedAt: Date | null;
    returnRequestedAt: Date | null;
};

// Until when the customer can ask to cancel, or null if they can't (any more).
// Allowed once, within an hour of paying, while the order hasn't shipped.
export function cancelDeadline(order: RequestableOrder, now = new Date()) {
    if (order.status !== "PAID" && order.status !== "PACKED") return null;
    if (order.cancelRequestedAt || !order.paidAt) return null;

    const deadline = new Date(order.paidAt.getTime() + CANCEL_WINDOW_MS);
    return deadline > now ? deadline : null;
}

// Until when the customer can ask to return, or null if they can't.
// Allowed once, within 2 days of delivery.
export function returnDeadline(order: RequestableOrder, now = new Date()) {
    if (order.status !== "DELIVERED") return null;
    if (order.returnRequestedAt || !order.deliveredAt) return null;

    const deadline = new Date(order.deliveredAt.getTime() + RETURN_WINDOW_MS);
    return deadline > now ? deadline : null;
}
