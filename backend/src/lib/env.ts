// Checked once at boot, straight after .env is loaded. A missing setting stops
// the server with a clear message in Render's logs, rather than surfacing
// later as a confusing failure in the middle of a customer's checkout.

const REQUIRED = ["DATABASE_URL", "JWT_SECRET", "FRONTEND_URL"];

// The shop runs without these, with that feature off. Worth a loud warning.
const FEATURES: Record<string, string> = {
    RAZORPAY_KEY_ID: "payments",
    RAZORPAY_KEY_SECRET: "payments",
    RAZORPAY_WEBHOOK_SECRET: "payment confirmation by webhook",
    RESEND_API_KEY: "emails",
    SHIPROCKET_EMAIL: "Shiprocket booking (ship orders by hand until it's set)",
    SHIPROCKET_PASSWORD: "Shiprocket booking (ship orders by hand until it's set)",
    SHIPROCKET_WEBHOOK_TOKEN: "tracking updates from Shiprocket",
};

export function checkEnv() {
    const missing = REQUIRED.filter((name) => !process.env[name]);

    if (missing.length > 0) {
        console.error(`Cannot start: missing required setting(s) ${missing.join(", ")}. Add them to .env (laptop) or the Render dashboard.`);
        process.exit(1);
    }

    // A short secret can be guessed, and anyone who guesses it can sign in as the admin.
    if (process.env.JWT_SECRET!.length < 32) {
        console.warn("WARNING: JWT_SECRET is shorter than 32 characters. Use a long random value.");
    }

    for (const [name, feature] of Object.entries(FEATURES)) {
        if (!process.env[name]) console.warn(`WARNING: ${name} is not set, so ${feature} won't work.`);
    }
}
