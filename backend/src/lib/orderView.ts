import type { Prisma } from "../generated/prisma/client.js"
import { cancelDeadline, returnDeadline } from "./orderStatus.js"

// What an order looks like when it leaves the server. Built field by field so
// nothing is sent by accident (the raw Razorpay payload, other users' data).

export const orderViewInclude = {
    items: { include: { variant: { include: { product: true } } } },
    payment: true
} as const;

export const adminOrderViewInclude = {
    ...orderViewInclude,
    user: { select: { email: true } },
    shipment: true
} as const;

type ViewableOrder = Prisma.OrderGetPayload<{ include: typeof orderViewInclude }>;
type AdminViewableOrder = Prisma.OrderGetPayload<{ include: typeof adminOrderViewInclude }>;

export function toOrderView(order: ViewableOrder) {
    return {
        id: order.id,
        number: order.number,
        status: order.status,
        // Money arrived but the order was cancelled (sold out first, see
        // markOrderPaid, or cancelled on request) or returned and not
        // replaced, and the refund hasn't been recorded yet.
        refundNeeded: !order.refundedAt && !order.replacementSentAt &&
            ((order.status === "CANCELLED" && order.payment?.status === "PAID") || order.status === "RETURNED"),
        subtotal: order.subtotal,
        shippingCost: order.shippingCost,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt,
        paidAt: order.paidAt,
        shippedAt: order.shippedAt,
        deliveredAt: order.deliveredAt,
        courierName: order.courierName,
        trackingNumber: order.trackingNumber,
        trackingUrl: order.trackingUrl,
        // When the Cancel / Return buttons stop working, or null to hide them.
        cancelUntil: cancelDeadline(order),
        returnUntil: returnDeadline(order),
        cancelRequestedAt: order.cancelRequestedAt,
        returnRequestedAt: order.returnRequestedAt,
        requestReason: order.requestReason,
        requestDeclineNote: order.requestDeclineNote,
        cancelledAt: order.cancelledAt,
        returnedAt: order.returnedAt,
        refundedAt: order.refundedAt,
        refundAmount: order.refundAmount,
        refundReference: order.refundReference,
        replacementSentAt: order.replacementSentAt,
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
        razorpayPaymentId: order.payment?.razorpayPaymentId ?? null,
        // The Shiprocket booking, if Shiprocket is switched on.
        shipment: order.shipment && {
            status: order.shipment.status,
            awb: order.shipment.awb,
            courierName: order.shipment.courierName,
            labelUrl: order.shipment.labelUrl,
            pickupRequestedAt: order.shipment.pickupRequestedAt,
            pickupScheduledFor: order.shipment.pickupScheduledFor,
            bookedAt: order.shipment.bookedAt,
            attempts: order.shipment.attempts,
            lastError: order.shipment.lastError,
            courierStatus: order.shipment.courierStatus,
            courierStatusAt: order.shipment.courierStatusAt
        }
    };
}
