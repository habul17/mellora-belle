import type { Prisma } from "../generated/prisma/client.js"

// What an order looks like when it leaves the server. Built field by field so
// nothing is sent by accident (the raw Razorpay payload, other users' data).

export const orderViewInclude = {
    items: { include: { variant: { include: { product: true } } } },
    payment: true
} as const;

export const adminOrderViewInclude = {
    ...orderViewInclude,
    user: { select: { email: true } }
} as const;

type ViewableOrder = Prisma.OrderGetPayload<{ include: typeof orderViewInclude }>;
type AdminViewableOrder = Prisma.OrderGetPayload<{ include: typeof adminOrderViewInclude }>;

export function toOrderView(order: ViewableOrder) {
    return {
        id: order.id,
        number: order.number,
        status: order.status,
        // Money arrived, but the order was cancelled because its items sold
        // out first (see markOrderPaid). The customer is owed a refund.
        refundNeeded: order.status === "CANCELLED" && order.payment?.status === "PAID",
        totalAmount: order.totalAmount,
        createdAt: order.createdAt,
        paidAt: order.paidAt,
        shippedAt: order.shippedAt,
        deliveredAt: order.deliveredAt,
        courierName: order.courierName,
        trackingNumber: order.trackingNumber,
        trackingUrl: order.trackingUrl,
        address: {
            fullName: order.fullName,
            phone: order.phone,
            addressLine1: order.addressLine1,
            addressLine2: order.addressLine2,
            city: order.city,
            state: order.state,
            pincode: order.pincode
        },
        items: order.items.map((item) => ({
            id: item.id,
            productName: item.variant.product.name,
            slug: item.variant.product.slug,
            image: item.variant.product.images[0] ?? null,
            size: item.variant.size,
            quantity: item.quantity,
            price: item.price
        }))
    };
}

export function toAdminOrderView(order: AdminViewableOrder) {
    return {
        ...toOrderView(order),
        customerEmail: order.user.email,
        // Needed to find the payment in the Razorpay dashboard for a refund.
        razorpayPaymentId: order.payment?.razorpayPaymentId ?? null
    };
}
