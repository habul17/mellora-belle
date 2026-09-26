// The shape GET /orders, GET /orders/:id and GET /admin/orders send back
// (backend/src/lib/orderView.ts builds it).

export type OrderStatus = "PENDING" | "PAID" | "PACKED" | "SHIPPED" | "DELIVERED" | "CANCELLED";

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
    totalAmount: number;
    createdAt: string;
    paidAt: string | null;
    shippedAt: string | null;
    deliveredAt: string | null;
    courierName: string | null;
    trackingNumber: string | null;
    trackingUrl: string | null;
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

export function statusLabel(order: OrderView) {
    if (order.refundNeeded) return "Cancelled – refund in progress";
    if (order.status === "PENDING") return "Awaiting payment";
    if (order.status === "CANCELLED") return "Cancelled";

    return ORDER_STEPS.find((step) => step.status === order.status)?.label ?? order.status;
}

export function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function itemsSummary(order: OrderView) {
    return order.items.map((item) => `${item.productName} (${item.size}) × ${item.quantity}`).join(", ");
}
