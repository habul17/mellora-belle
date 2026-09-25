import Razorpay from "razorpay"

// This codebase stores money as whole rupees (prisma/seed.ts: basePrice 1299
// means Rs 1299). Razorpay's API works entirely in paise. Convert only here,
// at the boundary, and never store paise — so there is exactly one place in
// the project where this can go wrong.
export function toPaise(rupees: number) {
    return rupees * 100;
}

let client: Razorpay | null = null;

// Built on first use rather than at import time, so a missing key does not
// stop the whole server from booting — only the payment routes fail.
export function getRazorpay() {
    if (!client) {
        const key_id = process.env.RAZORPAY_KEY_ID;
        const key_secret = process.env.RAZORPAY_KEY_SECRET;

        if (!key_id || !key_secret) {
            throw new Error("RAZORPAY_KEYS_MISSING");
        }

        client = new Razorpay({ key_id, key_secret });
    }

    return client;
}
