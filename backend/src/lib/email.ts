import { Resend } from "resend"
import { store } from "./store.js"
import { siteUrl } from "./site.js"

const resend = new Resend(process.env.RESEND_API_KEY);

// Resend's shared test sender only delivers to the Resend account owner's own
// address. Once the shop's domain is verified in Resend, set EMAIL_FROM to an
// address on it (e.g. "Mellora Belle <orders@mellorabelle.com>") — no code change.
const FROM = process.env.EMAIL_FROM || "Mellora Belle <onboarding@resend.dev>";

// Every email opens with the shop's logo (the monogram and name, gold on wine),
// served from the site (frontend/public/email-logo.png). A mail app that holds
// back images shows the shop's name in its place.
function withLogo(html: string) {
    return `
        <div style="background:#48012b;padding:20px 0;text-align:center">
            <img src="${siteUrl()}/email-logo.png" width="120" height="99" alt="${store.name}"
                style="display:inline-block;border:0;color:#d6a65c;font-family:Georgia,serif;font-size:20px">
        </div>
        ${html}`;
}

export async function sendEmail(to: string, subject: string, html: string, idempotencyKey?: string) {
    const { error } = await resend.emails.send(
        { from: FROM, replyTo: store.email, to, subject, html: withLogo(html) },
        idempotencyKey ? { idempotencyKey } : undefined
    );

    // Resend reports a failed send in its return value instead of throwing.
    // Ignoring it made every failure look like a success, so turn it into an
    // exception the caller has to deal with.
    if (error) {
        throw new Error(`Resend ${error.statusCode ?? "?"} ${error.name}: ${error.message}`);
    }
}
