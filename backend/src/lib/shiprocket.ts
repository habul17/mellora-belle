// A small client for the parts of Shiprocket's API the shop uses: log in,
// create an order, assign a courier (AWB), request pickup, make the label,
// and cancel. Everything else (couriers, wallet, pickup addresses) is set up
// once in the Shiprocket panel.
//
// Switched on by SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD, which are an *API
// user* made in the panel (Settings > Additional Settings > API Users), not
// the owner's own login. Until they are set, orders are shipped by hand.

const DEFAULT_API_URL = "https://apiv2.shiprocket.in/v1/external";

// A login token lasts 10 days. Log in again a day early.
const TOKEN_LIFETIME_MS = 9 * 24 * 60 * 60 * 1000;

const REQUEST_TIMEOUT_MS = 20_000;

export function shiprocketEnabled() {
    return Boolean(process.env.SHIPROCKET_EMAIL && process.env.SHIPROCKET_PASSWORD);
}

// The pickup address's nickname in the panel (Settings > Pickup Addresses).
export function pickupLocation() {
    return process.env.SHIPROCKET_PICKUP_LOCATION || "Primary";
}

function apiUrl() {
    return (process.env.SHIPROCKET_API_URL || DEFAULT_API_URL).replace(/\/$/, "");
}

export class ShiprocketError extends Error {
    constructor(message: string, public httpStatus: number | null) {
        super(message);
    }
}

// Shiprocket words its errors several ways: { message }, { errors: { field:
// [..] } }, or a 200 whose body says the step didn't happen. One readable line.
function errorMessage(body: any, fallback: string) {
    const parts: string[] = [];
    if (typeof body?.message === "string" && body.message) parts.push(body.message);
    if (body?.errors && typeof body.errors === "object") {
        for (const value of Object.values(body.errors)) {
            parts.push(Array.isArray(value) ? value.join(" ") : String(value));
        }
    }
    return (parts.join(" ") || fallback).slice(0, 300);
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function login() {
    const res = await fetch(`${apiUrl()}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: process.env.SHIPROCKET_EMAIL, password: process.env.SHIPROCKET_PASSWORD }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const body = await res.json().catch(() => null);

    if (!res.ok || typeof body?.token !== "string") {
        throw new ShiprocketError(`Shiprocket login failed: ${errorMessage(body, `HTTP ${res.status}`)}`, res.status);
    }

    cachedToken = { value: body.token, expiresAt: Date.now() + TOKEN_LIFETIME_MS };
    return body.token as string;
}

async function token() {
    if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;
    return login();
}

async function request(method: "GET" | "POST", path: string, payload?: unknown, retried = false): Promise<any> {
    const res = await fetch(`${apiUrl()}${path}`, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` },
        ...(payload !== undefined && { body: JSON.stringify(payload) }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    // The token was revoked or the API user's password changed: log in once more.
    if (res.status === 401 && !retried) {
        cachedToken = null;
        return request(method, path, payload, true);
    }

    const body = await res.json().catch(() => null);

    if (!res.ok) {
        throw new ShiprocketError(errorMessage(body, `Shiprocket answered HTTP ${res.status}`), res.status);
    }

    return body;
}

// Log in once at boot, so a wrong API user or password shows up in Render's
// logs straight away rather than when the first order is packed.
export async function checkShiprocketLogin() {
    if (!shiprocketEnabled()) return;
    try {
        await token();
        console.log("Shiprocket login OK");
    } catch (err) {
        console.warn(`WARNING: ${(err as Error).message}. Check SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD.`);
    }
}

// Forget the token (tests, or after changing the API user's password).
export function forgetShiprocketToken() {
    cachedToken = null;
}

export type ShiprocketOrderInput = {
    channelOrderId: string;
    orderDate: string;
    customerName: string;
    address: string;
    address2: string;
    city: string;
    state: string;
    pincode: string;
    email: string;
    phone: string;
    items: { name: string; sku: string; units: number; sellingPrice: number }[];
    subTotal: number;
    shippingCharges: number;
    weightKg: number;
    lengthCm: number;
    breadthCm: number;
    heightCm: number;
};

export async function createOrder(input: ShiprocketOrderInput) {
    const body = await request("POST", "/orders/create/adhoc", {
        order_id: input.channelOrderId,
        order_date: input.orderDate,
        pickup_location: pickupLocation(),
        billing_customer_name: input.customerName,
        billing_last_name: "",
        billing_address: input.address,
        billing_address_2: input.address2,
        billing_city: input.city,
        billing_pincode: input.pincode,
        billing_state: input.state,
        billing_country: "India",
        billing_email: input.email,
        billing_phone: input.phone,
        shipping_is_billing: true,
        order_items: input.items.map((item) => ({
            name: item.name,
            sku: item.sku,
            units: item.units,
            selling_price: item.sellingPrice,
        })),
        payment_method: "Prepaid",
        shipping_charges: input.shippingCharges,
        sub_total: input.subTotal,
        length: input.lengthCm,
        breadth: input.breadthCm,
        height: input.heightCm,
        weight: input.weightKg,
    });

    if (!body?.order_id || !body?.shipment_id) {
        throw new ShiprocketError(errorMessage(body, "Shiprocket didn't return an order id"), null);
    }

    return { orderId: String(body.order_id), shipmentId: String(body.shipment_id) };
}

// An order already on Shiprocket under our order id, if there is one. Used
// when a create may have gone through without us hearing back.
export async function findOrder(channelOrderId: string) {
    const body = await request("GET", `/orders?search=${encodeURIComponent(channelOrderId)}`);
    const list: any[] = Array.isArray(body?.data) ? body.data : [];
    const match = list.find((order) => String(order?.channel_order_id) === channelOrderId);
    if (!match) return null;

    const shipment = Array.isArray(match.shipments) ? match.shipments[0] : match.shipments;
    return {
        orderId: String(match.id),
        shipmentId: shipment?.id ? String(shipment.id) : null,
        awb: shipment?.awb ? String(shipment.awb) : null,
        courierName: typeof shipment?.courier === "string" && shipment.courier ? shipment.courier : null,
    };
}

// Shiprocket picks the courier by the rules set in the panel (Settings >
// Courier Priority). Needs money in the Shiprocket wallet.
export async function assignAwb(shipmentId: string) {
    const body = await request("POST", "/courier/assign/awb", { shipment_id: shipmentId });
    const data = body?.response?.data;

    if (body?.awb_assign_status !== 1 || !data?.awb_code) {
        const reason = data?.awb_assign_error ?? body?.message;
        throw new ShiprocketError(`Couldn't assign a courier: ${reason || "no reason given"}`.slice(0, 300), null);
    }

    return { awb: String(data.awb_code), courierName: String(data.courier_name ?? "Courier") };
}

export async function requestPickup(shipmentId: string) {
    try {
        const body = await request("POST", "/courier/generate/pickup", { shipment_id: [shipmentId] });
        if (body?.pickup_status !== 1) {
            throw new ShiprocketError(errorMessage(body?.response ?? body, "Pickup wasn't scheduled"), null);
        }
        return { scheduledFor: typeof body.response?.pickup_scheduled_date === "string" ? body.response.pickup_scheduled_date : null };
    } catch (err) {
        // Asking twice is harmless: a retry after a lost answer lands here.
        if (err instanceof ShiprocketError && /already/i.test(err.message)) return { scheduledFor: null };
        throw err;
    }
}

export async function generateLabel(shipmentId: string) {
    const body = await request("POST", "/courier/generate/label", { shipment_id: [shipmentId] });

    if (body?.label_created !== 1 || typeof body?.label_url !== "string") {
        throw new ShiprocketError(errorMessage(body, "The label wasn't created"), null);
    }

    return { labelUrl: body.label_url as string };
}

export async function cancelOrder(shiprocketOrderId: string) {
    try {
        await request("POST", "/orders/cancel", { ids: [Number(shiprocketOrderId)] });
    } catch (err) {
        if (err instanceof ShiprocketError && /already/i.test(err.message)) return;
        throw err;
    }
}

export function trackingUrl(awb: string) {
    return `https://shiprocket.co/tracking/${encodeURIComponent(awb)}`;
}
