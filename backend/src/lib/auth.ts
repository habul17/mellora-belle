import jwt from "jsonwebtoken"
import crypto from "node:crypto"
import type { Request, Response } from "express"
import { prisma } from "./prisma.js"

// Two tokens:
// - access token: a 15-minute JWT the page sends as a Bearer header.
// - refresh token: a random value in an httpOnly cookie that JavaScript can't
//   read, traded at /auth/refresh for a new access token. Customers stay
//   logged in for 30 days of activity; an admin session ends 12 hours after
//   the 2FA login no matter what, so a stolen admin cookie is short-lived.

const COOKIE_NAME = "mb_refresh";
const COOKIE_PATH = "/auth";
const CUSTOMER_SESSION_DAYS = 30;
const ADMIN_SESSION_HOURS = 12;

// When two tabs refresh at the same moment they both send the same cookie.
// The first one rotates it; the second arrives with a token that was just
// replaced. Within this window that's treated as the same browser, not theft.
const ROTATION_GRACE_MS = 60_000;

type SessionUser = { id: string; role: string };

export function normalizeEmail(email: unknown) {
    return typeof email === "string" ? email.trim().toLowerCase() : "";
}

export function isValidEmail(email: string) {
    return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// bcrypt only reads the first 72 bytes, so anything longer would silently
// match on its first 72 bytes alone.
export function passwordProblem(password: unknown) {
    if (typeof password !== "string" || password.length < 8) {
        return "Password must be at least 8 characters";
    }
    if (Buffer.byteLength(password) > 72) {
        return "Password is too long (72 characters at most)";
    }
    return null;
}

// Looks a login email up without caring about case, so accounts created
// before emails were lowercased still match.
export function findUserByEmail(email: string) {
    return prisma.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
    });
}

function hashToken(raw: string) {
    return crypto.createHash("sha256").update(raw).digest("hex");
}

export function issueAccessToken(user: SessionUser) {
    return jwt.sign(
        { userId: user.id, role: user.role },
        process.env.JWT_SECRET!,
        { expiresIn: "15m", algorithm: "HS256" }
    );
}

function sessionExpiry(role: string) {
    return role === "ADMIN"
        ? new Date(Date.now() + ADMIN_SESSION_HOURS * 60 * 60 * 1000)
        : new Date(Date.now() + CUSTOMER_SESSION_DAYS * 24 * 60 * 60 * 1000);
}

// Production: the site (vercel.app) and the API (onrender.com) are different
// sites, so the cookie must be SameSite=None + Secure to be sent at all, and
// Partitioned so browsers that block third-party cookies still keep it for
// this one site. Locally both are on localhost over http.
function cookieOptions(expires: Date) {
    const crossSite = (process.env.FRONTEND_URL ?? "").startsWith("https://");
    return {
        httpOnly: true,
        path: COOKIE_PATH,
        expires,
        secure: crossSite,
        sameSite: crossSite ? ("none" as const) : ("lax" as const),
        partitioned: crossSite,
    };
}

function clearCookie(res: Response) {
    const { expires: _expires, ...options } = cookieOptions(new Date(0));
    res.clearCookie(COOKIE_NAME, options);
}

function readCookie(req: Request) {
    const header = req.headers.cookie ?? "";
    for (const part of header.split(";")) {
        const [name, ...rest] = part.trim().split("=");
        if (name === COOKIE_NAME) return rest.join("=");
    }
    return null;
}

async function setRefreshCookie(res: Response, userId: string, expiresAt: Date) {
    const raw = crypto.randomBytes(32).toString("hex");
    await prisma.refreshToken.create({
        data: { tokenHash: hashToken(raw), userId, expiresAt },
    });
    res.cookie(COOKIE_NAME, raw, cookieOptions(expiresAt));
}

// Called after a successful login or signup. Returns the access token.
export async function startSession(res: Response, user: SessionUser) {
    await setRefreshCookie(res, user.id, sessionExpiry(user.role));
    return issueAccessToken(user);
}

// Trades the refresh cookie for a new access token, rotating the cookie.
// Returns null when there's no valid session and the user must log in.
export async function refreshSession(req: Request, res: Response) {
    const raw = readCookie(req);
    if (!raw) return null;

    const token = await prisma.refreshToken.findUnique({
        where: { tokenHash: hashToken(raw) },
        include: { user: true },
    });
    const now = new Date();

    if (!token || token.revokedAt || token.expiresAt <= now) {
        clearCookie(res);
        return null;
    }

    if (token.rotatedAt) {
        if (now.getTime() - token.rotatedAt.getTime() < ROTATION_GRACE_MS) {
            // A second tab racing the first. Its browser already has the new
            // cookie from the winning response, so only an access token is owed.
            return issueAccessToken(token.user);
        }
        // A replaced token turning up long afterwards means someone kept a
        // copy of it. End every session this user has.
        await revokeAllSessions(token.userId);
        clearCookie(res);
        return null;
    }

    // Claim the rotation. Only one request can win this for a given token.
    const claimed = await prisma.refreshToken.updateMany({
        where: { id: token.id, rotatedAt: null, revokedAt: null },
        data: { rotatedAt: now },
    });
    if (claimed.count === 0) return issueAccessToken(token.user);

    // Customers slide forward with activity; an admin session keeps its
    // original end time so 2FA is asked for again every 12 hours.
    const expiresAt = token.user.role === "ADMIN" ? token.expiresAt : sessionExpiry(token.user.role);
    await setRefreshCookie(res, token.userId, expiresAt);
    return issueAccessToken(token.user);
}

export async function endSession(req: Request, res: Response) {
    const raw = readCookie(req);
    if (raw) {
        await prisma.refreshToken.updateMany({
            where: { tokenHash: hashToken(raw), revokedAt: null },
            data: { revokedAt: new Date() },
        });
    }
    clearCookie(res);
}

export function revokeAllSessions(userId: string) {
    return prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
    });
}
