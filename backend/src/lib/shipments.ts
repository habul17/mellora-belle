import { prisma } from "./prisma.js"
import * as shiprocket from "./shiprocket.js"
import { shiprocketEnabled, ShiprocketError } from "./shiprocket.js"
import { PARCEL_CM, totalWeight } from "./shipping.js"
import { sendQueuedOrderEmails } from "./orderEmails.js"
import { describeStatus } from "./orderStatus.js"
import type { Prisma } from "../generated/prisma/client.js"
import type { Shipment } from "../generated/prisma/client.js"
import { reportError, reportProblem } from "./monitoring.js"

// Booking parcels with Shiprocket, and what the courier tells us afterwards.
//
// Marking an order packed queues a booking (a Shipment row). Booking is four
// calls: create the order on Shiprocket, assign a courier (the AWB), request
// pickup and make the label. Each call's result is saved as soon as it comes
// back, so when one fails the retry carries on from there and nothing is
// booked twice. Failures are retried with growing gaps (2, 4, 8, 16, 32
// minutes), then left for the admin as FAILED with the reason.
//
// Nothing here ever blocks a payment or a status change: the booking runs
// after the order is safely saved, and a Shiprocket outage just means the
// admin sees "retrying" on the orders page.

const MAX_ATTEMPTS = 6;
// While one sweep works on a shipment, nextAttemptAt is pushed this far ahead
// so a second sweep at the same moment skips it.
const LEASE_MINUTES = 5;
// A customer has asked to cancel: wait for the admin's answer before booking.
const ON_HOLD_MINUTES = 10;

export class ShipmentActionError extends Error {
    constructor(public httpStatus: number, message: string) {
        super(message);
    }
}

const minutesFromNow = (minutes: number) => new Date(Date.now() + minutes * 60 * 1000);

// Ends the lease when a try finishes for good (booked, failed, cancelled), so
// stopBooking() doesn't wait for a try that is no longer running.
const leaseEnded = () => ({ nextAttemptAt: new Date() });

// Our order number as Shiprocket shows it. A rebooking after a Shiprocket
// cancellation needs a new one: MB-1001, then MB-1001-2.
export function channelOrderId(orderNumber: number, round: number) {
    return round === 1 ? `MB-${orderNumber}` : `MB-${orderNumber}-${round}`;
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// "2026-09-29 14:05", Indian time, for Shiprocket's order date.
function istDateTime(date: Date) {
    return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 16).replace("T", " ");
}

// Shiprocket's times are Indian time with no zone, written either
// "2026-09-29 14:05:00" or "29 09 2026 14:05:00".
export function parseShiprocketTime(text: unknown): Date | null {
    if (typeof text !== "string") return null;
    const value = text.trim();

    let parts: string[] | null = null;
    const isoLike = value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (isoLike) parts = isoLike.slice(1);
    const dayFirst = value.match(/^(\d{2})[ /-](\d{2})[ /-](\d{4}) (\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!parts && dayFirst) parts = [dayFirst[3]!, dayFirst[2]!, dayFirst[1]!, dayFirst[4]!, dayFirst[5]!, dayFirst[6]!];
    if (!parts) return null;

    const [year, month, day, hour, minute, second] = parts.map((part) => Number(part ?? 0));
    const date = new Date(Date.UTC(year!, month! - 1, day!, hour!, minute!, second || 0) - IST_OFFSET_MS);
    return Number.isNaN(date.getTime()) ? null : date;
}

// ---- Queueing ----

type Tx = Prisma.TransactionClient;

// In the same transaction that marks the order packed.
export async function queueBooking(tx: Tx, orderId: string) {
    if (!shiprocketEnabled()) return;
    await tx.shipment.createMany({ data: [{ orderId }], skipDuplicates: true });
}

// Whether a booking may exist on Shiprocket: it has an id there, or a try is
// running now or has run (and may have got through without us hearing back).
function mayExistOnShiprocket(shipment: Shipment) {
    return Boolean(shipment.shiprocketOrderId) || shipment.attempts > 0 || shipment.nextAttemptAt > new Date();
}

// The order was cancelled, or shipped another way: stop booking, and cancel
// on Shiprocket whatever may be there. A parcel already booked and then
// shipped by hand keeps its booking: the admin used that AWB.
export async function stopBooking(tx: Tx, orderId: string, why: "cancelled" | "shipped-by-hand") {
    const shipment = await tx.shipment.findUnique({ where: { orderId } });
    if (!shipment) return;

    const unfinished = shipment.status === "BOOKING" || shipment.status === "FAILED";
    if (why === "shipped-by-hand" && !unfinished) return;
    if (why === "cancelled" && !unfinished && shipment.status !== "BOOKED") return;

    // Shipped by hand with the AWB this booking got: the booking is in use.
    if (why === "shipped-by-hand" && shipment.awb) {
        await tx.shipment.update({ where: { id: shipment.id }, data: { status: "BOOKED", bookedAt: new Date(), lastError: null } });
        return;
    }

    if (!mayExistOnShiprocket(shipment)) {
        await tx.shipment.update({ where: { id: shipment.id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
        return;
    }

    // If a try is running right now its lease is in the future: start the
    // cancel when it ends (at most LEASE_MINUTES), so they don't overlap.
    const leaseEnd = shipment.nextAttemptAt > new Date() ? shipment.nextAttemptAt : new Date();
    const startAt = leaseEnd < minutesFromNow(LEASE_MINUTES) ? leaseEnd : minutesFromNow(LEASE_MINUTES);

    await tx.shipment.update({
        where: { id: shipment.id },
        data: { status: "CANCELLING", attempts: 0, lastError: null, nextAttemptAt: startAt },
    });
}

// The admin's "Book with Shiprocket" / "Try again" / "Book again" button.
export async function retryShipment(orderId: string) {
    if (!shiprocketEnabled()) {
        throw new ShipmentActionError(400, "Shiprocket isn't set up yet, so ship this order by hand.");
    }

    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { shipment: true } });
    if (!order) throw new ShipmentActionError(404, "Order not found");
    const shipment = order.shipment;
    const now = new Date();

    // A cancelled order whose Shiprocket booking couldn't be cancelled: try that again.
    if (order.status !== "PACKED") {
        if (order.status === "CANCELLED" && shipment?.status === "FAILED") {
            await prisma.shipment.updateMany({
                where: { id: shipment.id, status: "FAILED" },
                data: { status: "CANCELLING", attempts: 0, lastError: null, nextAttemptAt: now },
            });
            processShipmentsSoon();
            return;
        }
        throw new ShipmentActionError(409, `Only a packed order can be booked. This order is ${describeStatus(order.status)}.`);
    }

    if (!shipment) {
        await prisma.shipment.createMany({ data: [{ orderId }], skipDuplicates: true });
    } else if (shipment.status === "FAILED") {
        // Keeps what was already done on Shiprocket and carries on from there.
        await prisma.shipment.updateMany({
            where: { id: shipment.id, status: "FAILED" },
            data: { status: "BOOKING", attempts: 0, lastError: null, nextAttemptAt: now },
        });
    } else if (shipment.status === "CANCELLED") {
        // Cancelled on Shiprocket (in the panel): a fresh booking, new id there.
        await prisma.$transaction([
            prisma.shipment.updateMany({
                where: { id: shipment.id, status: "CANCELLED" },
                data: {
                    status: "BOOKING", round: { increment: 1 }, attempts: 0, lastError: null, nextAttemptAt: now,
                    shiprocketOrderId: null, shiprocketShipmentId: null, awb: null, courierName: null,
                    pickupRequestedAt: null, pickupScheduledFor: null, labelUrl: null, bookedAt: null, cancelledAt: null,
                    courierStatus: null, courierStatusAt: null,
                },
            }),
            // The old AWB is dead; the new booking fills these in again.
            prisma.order.updateMany({
                where: { id: orderId, status: "PACKED" },
                data: { courierName: null, trackingNumber: null, trackingUrl: null },
            }),
        ]);
    } else {
        const state = shipment.status === "BOOKED" ? "already booked" : "being booked now";
        throw new ShipmentActionError(409, `This order is ${state}. Refresh to see its latest state.`);
    }

    processShipmentsSoon();
}

// ---- The worker ----

const orderForBooking = {
    user: { select: { email: true } },
    items: { include: { variant: { include: { product: true } } } },
} as const;

type BookingOrder = Prisma.OrderGetPayload<{ include: typeof orderForBooking }>;

function bookingInput(order: BookingOrder, round: number): shiprocket.ShiprocketOrderInput {
    const grams = totalWeight(order.items);

    return {
        channelOrderId: channelOrderId(order.number, round),
        orderDate: istDateTime(order.paidAt ?? order.createdAt),
        customerName: order.fullName,
        address: order.addressLine1,
        address2: order.addressLine2 ?? "",
        city: order.city,
        state: order.state,
        pincode: order.pincode,
        email: order.user.email,
        phone: order.phone,
        items: order.items.map((item) => ({
            name: `${item.variant.product.name} (${item.variant.size})`,
            sku: item.variant.sku,
            units: item.quantity,
            sellingPrice: item.price,
        })),
        subTotal: order.subtotal,
        shippingCharges: order.shippingCost,
        weightKg: Math.max(0.1, Math.round(grams / 10) / 100),
        lengthCm: PARCEL_CM.length,
        breadthCm: PARCEL_CM.breadth,
        heightCm: PARCEL_CM.height,
    };
}

async function stillStatus(id: string, status: Shipment["status"]) {
    const current = await prisma.shipment.findUnique({ where: { id }, select: { status: true } });
    return current?.status === status;
}

async function book(shipment: Shipment, order: BookingOrder) {
    const id = shipment.id;
    let { shiprocketOrderId, shiprocketShipmentId, awb } = shipment;
    const ourId = channelOrderId(order.number, shipment.round);

    // 1. The order on Shiprocket. After a failed try, look first: a create
    // that timed out may have gone through.
    if (!shiprocketOrderId || !shiprocketShipmentId) {
        const found = shipment.attempts > 0 ? await shiprocket.findOrder(ourId) : null;
        const created = found?.shipmentId ? found : await shiprocket.createOrder(bookingInput(order, shipment.round));

        shiprocketOrderId = created.orderId;
        shiprocketShipmentId = created.shipmentId!;
        await prisma.shipment.update({ where: { id }, data: { shiprocketOrderId, shiprocketShipmentId } });

        if (found?.awb) {
            awb = found.awb;
            await saveAwb(id, order.id, found.awb, found.courierName ?? "Courier");
        }
    }

    // 2. A courier and its tracking number (AWB).
    if (!awb) {
        if (!(await stillStatus(id, "BOOKING"))) return;
        let assigned: { awb: string; courierName: string };
        try {
            assigned = await shiprocket.assignAwb(shiprocketShipmentId);
        } catch (err) {
            // Assigned on an earlier try whose answer never arrived.
            const found = err instanceof ShiprocketError && /already/i.test(err.message) ? await shiprocket.findOrder(ourId) : null;
            if (!found?.awb) throw err;
            assigned = { awb: found.awb, courierName: found.courierName ?? "Courier" };
        }
        awb = assigned.awb;
        await saveAwb(id, order.id, assigned.awb, assigned.courierName);
    }

    // 3. Ask the courier to collect it.
    if (!shipment.pickupRequestedAt) {
        if (!(await stillStatus(id, "BOOKING"))) return;
        const pickup = await shiprocket.requestPickup(shiprocketShipmentId);
        await prisma.shipment.update({
            where: { id },
            data: { pickupRequestedAt: new Date(), pickupScheduledFor: parseShiprocketTime(pickup.scheduledFor) },
        });
    }

    // 4. The label to print and stick on the parcel.
    if (!shipment.labelUrl) {
        if (!(await stillStatus(id, "BOOKING"))) return;
        const { labelUrl } = await shiprocket.generateLabel(shiprocketShipmentId);
        await prisma.shipment.update({ where: { id }, data: { labelUrl } });
    }

    await prisma.shipment.updateMany({
        where: { id, status: "BOOKING" },
        data: { status: "BOOKED", bookedAt: new Date(), lastError: null, ...leaseEnded() },
    });
}

// The AWB goes on the order too: the admin sees it, and the customer's
// shipped email and tracking link use it once the courier collects the parcel.
async function saveAwb(shipmentId: string, orderId: string, awb: string, courierName: string) {
    await prisma.$transaction([
        prisma.shipment.update({ where: { id: shipmentId }, data: { awb, courierName } }),
        prisma.order.updateMany({
            where: { id: orderId, status: { in: ["PACKED", "CANCELLATION_REQUESTED"] } },
            data: { courierName, trackingNumber: awb, trackingUrl: shiprocket.trackingUrl(awb) },
        }),
    ]);
}

async function cancelOnShiprocket(shipment: Shipment, order: BookingOrder) {
    let shiprocketOrderId = shipment.shiprocketOrderId;

    // A create may have gone through without us hearing back.
    if (!shiprocketOrderId) {
        const found = await shiprocket.findOrder(channelOrderId(order.number, shipment.round));
        shiprocketOrderId = found?.orderId ?? null;
    }

    if (shiprocketOrderId) await shiprocket.cancelOrder(shiprocketOrderId);

    await prisma.shipment.updateMany({
        where: { id: shipment.id, status: "CANCELLING" },
        data: { status: "CANCELLED", cancelledAt: new Date(), lastError: null, ...leaseEnded(), ...(shiprocketOrderId && { shiprocketOrderId }) },
    });
}

async function processOne(shipmentId: string) {
    const claimed = await prisma.shipment.updateMany({
        where: { id: shipmentId, status: { in: ["BOOKING", "CANCELLING"] }, nextAttemptAt: { lte: new Date() } },
        data: { nextAttemptAt: minutesFromNow(LEASE_MINUTES) },
    });
    if (claimed.count === 0) return;

    const shipment = await prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId } });
    const order = await prisma.order.findUniqueOrThrow({ where: { id: shipment.orderId }, include: orderForBooking });

    try {
        if (shipment.status === "CANCELLING") {
            await cancelOnShiprocket(shipment, order);
            return;
        }

        if (order.status === "CANCELLATION_REQUESTED") {
            await prisma.shipment.update({ where: { id: shipment.id }, data: { nextAttemptAt: minutesFromNow(ON_HOLD_MINUTES) } });
            return;
        }

        if (order.status !== "PACKED") {
            // Cancelled or shipped by hand since it was queued.
            await prisma.$transaction(async (tx) => {
                // Our own lease isn't a running try: let the cancel start now.
                await tx.shipment.update({ where: { id: shipment.id }, data: { nextAttemptAt: new Date() } });
                await stopBooking(tx, order.id, order.status === "SHIPPED" || order.status === "DELIVERED" ? "shipped-by-hand" : "cancelled");
            });
            return;
        }

        await book(shipment, order);
    } catch (err) {
        const attempts = shipment.attempts + 1;
        const message = (err instanceof Error ? err.message : String(err)).slice(0, 500);
        const what = shipment.status === "CANCELLING" ? "cancel" : "booking";

        console.log(`Order #${order.number} Shiprocket ${what} failed (attempt ${attempts} of ${MAX_ATTEMPTS}): ${message}`);
        // One alert when it first fails, and another if every retry fails.
        if (attempts === 1) reportProblem(`Order #${order.number} Shiprocket ${what} failed, retrying: ${message}`, ["shiprocket", what, order.id]);
        if (attempts >= MAX_ATTEMPTS) reportProblem(`Order #${order.number} Shiprocket ${what} gave up after ${MAX_ATTEMPTS} tries: ${message}`, ["shiprocket-gave-up", what, order.id]);

        await prisma.shipment.updateMany({
            where: { id: shipment.id, status: shipment.status },
            data: attempts >= MAX_ATTEMPTS
                ? { attempts, lastError: message, status: "FAILED", ...leaseEnded() }
                : { attempts, lastError: message, nextAttemptAt: minutesFromNow(2 ** attempts) },
        });
    }
}

export async function processShipments() {
    if (!shiprocketEnabled()) return;

    const due = await prisma.shipment.findMany({
        where: { status: { in: ["BOOKING", "CANCELLING"] }, nextAttemptAt: { lte: new Date() } },
        select: { id: true },
        orderBy: { createdAt: "asc" },
        take: 10,
    });

    for (const { id } of due) {
        try {
            await processOne(id);
        } catch (err) {
            // A database error on one shipment must not stop the rest.
            reportError(err, `Could not process shipment ${id}`);
        }
    }
}

export function processShipmentsSoon() {
    processShipments().catch((err) => reportError(err, "Processing shipments failed"));
}

// ---- Tracking updates from the courier (Shiprocket's webhook) ----

// Shiprocket's status names, tidied: "OUT_FOR_DELIVERY" -> "OUT FOR DELIVERY".
export function normaliseCourierStatus(status: string) {
    return status.toUpperCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

// The parcel has left the shop and is with the courier. Problems on the way
// (a failed delivery attempt, a delay) still mean it's out there.
const ON_THE_WAY = new Set([
    "PICKED UP", "SHIPPED", "IN TRANSIT", "OUT FOR DELIVERY", "REACHED AT DESTINATION HUB",
    "REACHED DESTINATION HUB", "IN FLIGHT", "MISROUTED", "DELAYED", "UNDELIVERED",
    "REACHED WAREHOUSE", "HANDOVER TO COURIER",
]);

const CANCELLED_ON_SHIPROCKET = new Set(["CANCELED", "CANCELLED", "CANCELLED BEFORE DISPATCHED"]);

export type CourierUpdate = { awb: string; status: string; at: Date | null; isReturn: boolean };

// What the order should become, if anything. Anything else (return to
// origin, lost, damaged) is only recorded, for the admin to deal with.
function orderStepFor(status: string): "SHIPPED" | "DELIVERED" | null {
    if (status === "DELIVERED") return "DELIVERED";
    if (ON_THE_WAY.has(status)) return "SHIPPED";
    return null;
}

// Updates can arrive late, twice or out of order. The order only ever moves
// forward (each move is conditional on the status before it), and the
// courier status shown is only replaced by a newer one.
export async function applyCourierUpdate(update: CourierUpdate): Promise<"unknown" | "recorded"> {
    const status = normaliseCourierStatus(update.status);
    const now = new Date();
    const at = update.at && update.at <= now ? update.at : now;

    const shipment = await prisma.shipment.findUnique({ where: { awb: update.awb } });
    // A parcel booked by hand in the panel, with its AWB typed in as the tracking number.
    const orderId = shipment?.orderId
        ?? (await prisma.order.findFirst({ where: { trackingNumber: update.awb }, select: { id: true } }))?.id;

    if (!orderId) return "unknown";

    if (shipment) {
        await prisma.shipment.updateMany({
            where: { id: shipment.id, OR: [{ courierStatusAt: null }, { courierStatusAt: { lte: at } }] },
            data: { courierStatus: status.slice(0, 100), courierStatusAt: at },
        });

        // Cancelled in the Shiprocket panel: the admin can book it again.
        if (CANCELLED_ON_SHIPROCKET.has(status)) {
            await prisma.shipment.updateMany({ where: { id: shipment.id, status: "BOOKED" }, data: { status: "CANCELLED", cancelledAt: now } });
        }
    }

    // A return pickup's updates say nothing about the order's own journey.
    if (update.isReturn) return "recorded";

    const step = orderStepFor(status);

    // Finished by hand in the panel after the booking here gave up: the
    // courier has it, so it's booked.
    if (step && shipment?.status === "FAILED") {
        await prisma.shipment.updateMany({ where: { id: shipment.id, status: "FAILED" }, data: { status: "BOOKED", bookedAt: now, lastError: null } });
    }

    if (step === "SHIPPED") {
        const moved = await prisma.$transaction(async (tx) => {
            const result = await tx.order.updateMany({ where: { id: orderId, status: "PACKED" }, data: { status: "SHIPPED", shippedAt: at } });
            if (result.count > 0) {
                await tx.orderEmail.createMany({ data: [{ orderId, kind: "ORDER_SHIPPED" }], skipDuplicates: true });
            }
            return result.count > 0;
        });
        if (moved) sendQueuedOrderEmails().catch((err) => reportError(err, "Sending order emails failed"));
    }

    if (step === "DELIVERED") {
        await prisma.$transaction(async (tx) => {
            // The pickup update never came: it did ship. Too late for the "on
            // its way" email, so none is sent.
            await tx.order.updateMany({ where: { id: orderId, status: "PACKED" }, data: { status: "SHIPPED", shippedAt: at } });
            await tx.order.updateMany({ where: { id: orderId, status: "SHIPPED" }, data: { status: "DELIVERED", deliveredAt: at } });
        });
    }

    return "recorded";
}
