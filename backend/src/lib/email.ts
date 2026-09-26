import { Resend } from "resend"
import { store } from "./store.js"

const resend = new Resend(process.env.RESEND_API_KEY);

// Resend's shared test sender only delivers to the Resend account owner's own
// address. Once the shop's domain is verified in Resend, set EMAIL_FROM to an
// address on it (e.g. "Mellora Belle <orders@mellorabelle.com>") — no code change.
const FROM = process.env.EMAIL_FROM || "Mellora Belle <onboarding@resend.dev>";

export async function sendEmail(to: string, subject: string, html: string, idempotencyKey?: string) {
    const { error } = await resend.emails.send(
        { from: FROM, replyTo: store.email, to, subject, html },
        idempotencyKey ? { idempotencyKey } : undefined
    );

    // Resend reports a failed send in its return value instead of throwing.
    // Ignoring it made every failure look like a success, so turn it into an
    // exception the caller has to deal with.
    if (error) {
        throw new Error(`Resend ${error.statusCode ?? "?"} ${error.name}: ${error.message}`);
    }
}
