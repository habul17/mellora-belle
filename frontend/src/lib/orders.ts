// The shape GET /orders, GET /orders/:id and GET /admin/orders send back
// (backend/src/lib/orderView.ts builds it).

export type OrderStatus =
    | "PENDING" | "PAID" | "PACKED" | "SHIPPED" | "DELIVERED"
    | "CANCELLATION_REQUESTED" | "CANCELLED" | "RETURN_REQUESTED" | "RETURNED";

export type OrderItemView = {
    id: string;
    productName: string;
    slug: string;
    image: string | null;
    size: string;
    quantity: number;
    price: number;
};

export type OrderView = {
    id: string;
    number: number;
    status: OrderStatus;
    refundNeeded: boolean;
    subtotal: number;
    shippingCost: number;
    totalAmount: number;
    createdAt: string;
    paidAt: string | null;
    shippedAt: string | null;
    deliveredAt: string | null;
    courierName: string | null;
    trackingNumber: string | null;
    trackingUrl: string | null;
    // Null hides the Cancel / Return button.
    cancelUntil: string | null;
    returnUntil: string | null;
    cancelRequestedAt: string | null;
    returnRequestedAt: string | null;
    requestReason: string | null;
    requestDeclineNote: string | null;
    cancelledAt: string | null;
    returnedAt: string | null;
    refundedAt: string | null;
    refundAmount: number | null;
    refundReference: string | null;
    address: {
        fullName: string;
        phone: string;
        addressLine1: string;
        addressLine2: string | null;
        city: string;
        state: string;
        pincode: string;
    };
    items: OrderItemView[];
};

export type AdminOrderView = OrderView & {
    customerEmail: string;
    razorpayPaymentId: string | null;
};

// The steps a customer sees an order move through, in order.
export const ORDER_STEPS: { status: OrderStatus; label: string }[] = [
    { status: "PAID", label: "Confirmed" },
    { status: "PACKED", label: "Packed" },
    { status: "SHIPPED", label: "Shipped" },
    { status: "DELIVERED", label: "Delivered" },
];

// Must match RETURN_REASONS in backend/src/lib/orderRequests.ts.
export const RETURN_REASONS = ["Damaged or defective", "Wrong item sent", "Doesn't fit", "Changed my mind"];

export function statusLabel(order: OrderView) {
    const ended = order.status === "CANCELLED" ? "Cancelled" : order.status === "RETURNED" ? "Returned" : null;

    if (ended && order.refundedAt) return `${ended} – refunded`;
    if (ended && order.refundNeeded) return `${ended} – refund in progress`;
    if (ended) return ended;
    if (order.status === "PENDING") return "Awaiting payment";
    if (order.status === "CANCELLATION_REQUESTED") return "Cancellation requested";
    if (order.status === "RETURN_REQUESTED") return "Return requested";

    return ORDER_STEPS.find((step) => step.status === order.status)?.label ?? order.status;
}

// An order the customer paid for that was cancelled by the payment code
// because its items sold out first, rather than on request.
export function soldOutBeforePayment(order: OrderView) {
    return order.status === "CANCELLED" && !order.cancelledAt && !order.cancelRequestedAt;
}

export function formatDateTime(iso: string) {
    return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function itemsSummary(order: OrderView) {
    return order.items.map((item) => `${item.productName} (${item.size}) × ${item.quantity}`).join(", ");
}
