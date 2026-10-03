import { rateLimit, ipKeyGenerator } from "express-rate-limit"
import type { Request } from "express"
import { normalizeEmail } from "./auth.js"

// Limits on the endpoints worth attacking: guessing passwords or login codes,
// flooding someone's inbox with codes or reset emails, and hammering checkout
// (each attempt holds stock for 15 minutes).
//
// Counts live in memory, so they reset when the server restarts. That's fine
// for one server; move them to a shared store if there are ever several.

const MINUTE = 60 * 1000;

const ip = (req: Request) => ipKeyGenerator(req.ip ?? "unknown");
const userId = (req: Request) => (req as { user?: { userId?: string } }).user?.userId ?? ip(req);
const ipAndEmail = (req: Request) => `${ip(req)}|${normalizeEmail(req.body?.email)}`;
const email = (req: Request) => `email|${normalizeEmail(req.body?.email) || ip(req)}`;

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

// Each request emails a code. Per email, whoever is asking, so nobody can
// flood one inbox from many addresses or get more than 5 codes (25 guesses)
// an hour for one account. Per address too, but loosely: every customer login
// passes through here, and many phones on one mobile network share an address.
export const loginCodeLimits = [
    limiter(60, 5, "We've already sent several codes to this email. Use the newest one, or try again in an hour.", { keyGenerator: email }),
    limiter(60, 50, WAIT(60), { keyGenerator: ip }),
];

// Wrong codes only. Each code also stops working after 5 wrong tries.
export const verifyLoginCodeLimit = limiter(15, 30, WAIT(15), { keyGenerator: ip, skipSuccessfulRequests: true });

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
