import { rateLimit, ipKeyGenerator } from "express-rate-limit"
import type { Request } from "express"
import { normalizeEmail } from "./auth.js"

// Limits on the endpoints worth attacking: guessing passwords, flooding
// someone's inbox with reset emails, creating accounts in bulk, and hammering
// checkout (each attempt holds stock for 15 minutes).
//
// Counts live in memory, so they reset when the server restarts. That's fine
// for one server; move them to a shared store if there are ever several.

const MINUTE = 60 * 1000;

const ip = (req: Request) => ipKeyGenerator(req.ip ?? "unknown");
const userId = (req: Request) => (req as { user?: { userId?: string } }).user?.userId ?? ip(req);
const ipAndEmail = (req: Request) => `${ip(req)}|${normalizeEmail(req.body?.email)}`;

function limiter(windowMinutes: number, limit: number, error: string, options: Parameters<typeof rateLimit>[0] = {}) {
    return rateLimit({
        windowMs: windowMinutes * MINUTE,
        limit,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        message: { error },
        ...options,
    });
}

const WAIT = (minutes: number) => `Too many attempts. Please wait ${minutes} minutes and try again.`;

// Only failed logins count, so a customer who logs in often is never blocked.
// Per account (from one address) and, more loosely, per address, since a whole
// office or mobile network can share one.
export const loginLimits = [
    limiter(15, 10, WAIT(15), { keyGenerator: ipAndEmail, skipSuccessfulRequests: true }),
    limiter(15, 50, WAIT(15), { keyGenerator: ip, skipSuccessfulRequests: true }),
];

export const signupLimit = limiter(60, 20, "Too many accounts created from here. Please try again in an hour.", { keyGenerator: ip });

// Each request sends an email, so these are the tightest.
export const forgotPasswordLimits = [
    limiter(60, 5, WAIT(60), { keyGenerator: ipAndEmail }),
    limiter(60, 20, WAIT(60), { keyGenerator: ip }),
];

export const resetPasswordLimit = limiter(15, 20, WAIT(15), { keyGenerator: ip });

// A normal visitor refreshes about once every 15 minutes per open tab.
export const refreshLimit = limiter(15, 120, WAIT(15), { keyGenerator: ip });

// Per logged-in customer (these run after requireAuth).
export const checkoutLimit = limiter(10, 30, WAIT(10), { keyGenerator: userId });
export const orderRequestLimit = limiter(10, 20, WAIT(10), { keyGenerator: userId });
