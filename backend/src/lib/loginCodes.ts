import crypto from "node:crypto"
import { prisma } from "./prisma.js"
import { Prisma } from "../generated/prisma/client.js"
import { sendEmail } from "./email.js"
import { store } from "./store.js"
import { siteUrl } from "./site.js"
import { findUserByEmail } from "./auth.js"
import { reportError } from "./monitoring.js"

// Customers log in with a 6-digit code emailed to them, so there's no
// password to choose, forget or reuse. The account is created the first time
// a code is typed in, so a mistyped email never leaves an empty account behind.
//
// Only a keyed hash of each code is stored: with a copy of the database alone,
// nobody can work out a code that's still live (there are only a million).

const CODE_MINUTES = 10;
const MAX_TRIES = 5;

export class LoginCodeError extends Error {
    constructor(public httpStatus: number, message: string) {
        super(message);
    }
}

function hashCode(email: string, code: string) {
    return crypto.createHmac("sha256", process.env.JWT_SECRET!).update(`login-code:${email}:${code}`).digest("hex");
}

function sameHash(a: string, b: string) {
    return a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function codeEmail(code: string) {
    return {
        subject: `${code} is your ${store.name} login code`,
        html: `
            <p>Your code to log in to ${store.name}:</p>
            <p style="font-size:28px;letter-spacing:6px;margin:16px 0"><strong>${code}</strong></p>
            <p>It works for ${CODE_MINUTES} minutes. If you didn't ask for it, you can ignore
            this email: nobody can log in to your account without the code.</p>
            <p style="color:#555">${store.name}</p>`
    };
}

// The admin logs in with a password and an authenticator code, which an
// emailed code must not get around. Whoever typed the admin's email gets the
// same "check your email" answer as anyone else, so the page doesn't tell
// visitors which email is the admin's; the email itself says where to go.
function adminNoticeEmail() {
    const link = `${siteUrl()}/admin/login`;
    return {
        subject: `Admin log in – ${store.name}`,
        html: `
            <p>Someone asked for a login code for this email on the shop. This email
            belongs to the admin account, which logs in with its password here:</p>
            <p><a href="${link}">${link}</a></p>
            <p>If that wasn't you, you can ignore this email. No code was sent.</p>
            <p style="color:#555">${store.name}</p>`
    };
}

// Step 1. The email must already be normalized and valid.
export async function sendLoginCode(email: string) {
    const user = await findUserByEmail(email);
    let codeId: string | null = null;
    let message;

    if (user?.role === "ADMIN") {
        message = adminNoticeEmail();
    } else {
        const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
        // Only the newest code works, so an older email can't be used later.
        // Expired codes for anyone are cleared out at the same time.
        const [, , row] = await prisma.$transaction([
            prisma.loginCode.deleteMany({ where: { expiresAt: { lte: new Date() } } }),
            prisma.loginCode.deleteMany({ where: { email } }),
            prisma.loginCode.create({
                data: { email, codeHash: hashCode(email, code), expiresAt: new Date(Date.now() + CODE_MINUTES * 60 * 1000) },
            }),
        ]);
        codeId = row.id;
        message = codeEmail(code);
    }

    try {
        await sendEmail(email, message.subject, message.html);
    } catch (err) {
        reportError(err, "Login code email failed");
        if (codeId) await prisma.loginCode.deleteMany({ where: { id: codeId } });
        throw new LoginCodeError(502, "We couldn't send the email just now. Please try again in a minute.");
    }
}

// Step 2. Returns the customer, creating their account the first time.
export async function verifyLoginCode(email: string, code: string) {
    const row = await prisma.loginCode.findFirst({ where: { email }, orderBy: { createdAt: "desc" } });

    if (!row || row.expiresAt <= new Date()) {
        throw new LoginCodeError(400, "That code has expired. Ask for a new one.");
    }

    // The try is counted before the code is checked, so tries sent at the
    // same moment can't get past the limit between them.
    const counted = await prisma.loginCode.updateMany({
        where: { id: row.id, attempts: { lt: MAX_TRIES } },
        data: { attempts: { increment: 1 } },
    });
    if (counted.count === 0) {
        await prisma.loginCode.deleteMany({ where: { id: row.id } });
        throw new LoginCodeError(400, "Too many wrong tries. Ask for a new code.");
    }

    if (!sameHash(hashCode(email, code), row.codeHash)) {
        if (row.attempts + 1 >= MAX_TRIES) {
            await prisma.loginCode.deleteMany({ where: { id: row.id } });
            throw new LoginCodeError(400, "That code isn't right, and that was the last try. Ask for a new code.");
        }
        throw new LoginCodeError(400, "That code isn't right. Check the newest email from us and try again.");
    }

    // A code logs in once: of two requests with it, only one claims it.
    const claimed = await prisma.loginCode.deleteMany({ where: { id: row.id } });
    if (claimed.count === 0) {
        throw new LoginCodeError(400, "That code has already been used. Ask for a new one.");
    }

    const existing = await findUserByEmail(email);
    if (existing) {
        // Only if the email became the admin's after the code was sent.
        if (existing.role === "ADMIN") {
            throw new LoginCodeError(403, "This is the admin account. Log in with its password at /admin/login.");
        }
        return existing;
    }

    try {
        return await prisma.user.create({ data: { email } });
    } catch (err) {
        // Created a moment ago by another request for the same email.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            const user = await findUserByEmail(email);
            if (user) return user;
        }
        throw err;
    }
}
