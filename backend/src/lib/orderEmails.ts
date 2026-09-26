import { prisma } from "./prisma.js"
import { sendEmail } from "./email.js"
import { store } from "./store.js"

// Every order email is a row in OrderEmail, written in the same transaction
// that moved the order to PAID or SHIPPED. This file sends the rows that are
// still owed. A failed send is retried with growing gaps (2, 4, 8 ... 128
// minutes) and given up after MAX_ATTEMPTS, about four hours in total.
const MAX_ATTEMPTS = 8;

// While one sweep is sending an email, nextAttemptAt is pushed this far ahead
// so a second sweep running at the same moment skips it.
const LEASE_MINUTES = 5;

const orderForEmail = {
    user: true,
    items: { include: { variant: { include: { product: true } } } }
} as const;

type EmailOrder = Awaited<ReturnType<typeof loadOrder>>;

function loadOrder(orderId: string) {
    return prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: orderForEmail });
}

// Customer-typed text (name, address) and admin-typed text (courier, tracking)
// go into HTML. Unescaped, a name like <a href=...> would become a live link
// inside an email sent under the shop's name.
function escapeHtml(text: string) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function rupees(amount: number) {
    return `₹${amount.toLocaleString("en-IN")}`;
}

function orderLink(order: EmailOrder) {
    return `${process.env.FRONTEND_URL || "http://localhost:5173"}/orders/${order.id}`;
}

function itemsTable(order: EmailOrder) {
    const rows = order.items.map((item) => `
        <tr>
            <td style="padding:4px 12px 4px 0">${escapeHtml(item.variant.product.name)} (${item.variant.size}) × ${item.quantity}</td>
            <td style="padding:4px 0;text-align:right">${rupees(item.price * item.quantity)}</td>
        </tr>`).join("");

    return `
        <table style="border-collapse:collapse">
            ${rows}
            <tr>
                <td style="padding:8px 12px 4px 0"><strong>Total paid</strong></td>
                <td style="padding:8px 0 4px;text-align:right"><strong>${rupees(order.totalAmount)}</strong></td>
            </tr>
        </table>`;
}

function address(order: EmailOrder) {
    const lines = [
        order.fullName,
        order.addressLine1,
        order.addressLine2,
        `${order.city}, ${order.state} ${order.pincode}`,
        `Phone: ${order.phone}`
    ].filter((line): line is string => Boolean(line));

    return lines.map(escapeHtml).join("<br>");
}

function footer() {
    return `
        <p style="color:#555">
            Questions? Reply to this email, write to ${store.email} or call ${store.phone}.
            Please mention your order number.
        </p>
        <p style="color:#555">${store.name}</p>`;
}

export function orderConfirmedEmail(order: EmailOrder) {
    return {
        subject: `Order #${order.number} confirmed – ${store.name}`,
        html: `
            <p>Hi ${escapeHtml(order.fullName)},</p>
            <p>Thank you for your order! We've received your payment. We'll dispatch it within
            ${store.dispatchDays} and email you the tracking details when it ships.</p>
            <h3>Order #${order.number}</h3>
            ${itemsTable(order)}
            <p><strong>Delivering to</strong><br>${address(order)}</p>
            <p><a href="${orderLink(order)}">View your order</a></p>
            ${footer()}`
    };
}

export function orderShippedEmail(order: EmailOrder) {
    const tracking = order.trackingUrl
        ? `<p><a href="${escapeHtml(order.trackingUrl)}">Track your parcel</a></p>`
        : "";

    return {
        subject: `Order #${order.number} is on its way – ${store.name}`,
        html: `
            <p>Hi ${escapeHtml(order.fullName)},</p>
            <p>Good news: your order #${order.number} has been dispatched. It usually arrives
            within ${store.deliveryDays}.</p>
            <p>
                Courier: ${escapeHtml(order.courierName ?? "")}<br>
                Tracking number: ${escapeHtml(order.trackingNumber ?? "")}
            </p>
            ${tracking}
            <p><a href="${orderLink(order)}">View your order</a></p>
            ${footer()}`
    };
}

async function sendOne(emailId: string) {
    // Claim it: only the sweep whose update succeeds sends it. Postgres makes a
    // second, simultaneous claim wait and then re-check nextAttemptAt, which by
    // then is five minutes in the future, so it matches nothing.
    const claimed = await prisma.orderEmail.updateMany({
        where: { id: emailId, sentAt: null, nextAttemptAt: { lte: new Date() } },
        data: { nextAttemptAt: new Date(Date.now() + LEASE_MINUTES * 60 * 1000) }
    });

    if (claimed.count === 0) return;

    const email = await prisma.orderEmail.findUniqueOrThrow({ where: { id: emailId } });
    const order = await loadOrder(email.orderId);

    try {
        const { subject, html } = email.kind === "ORDER_CONFIRMED"
            ? orderConfirmedEmail(order)
            : orderShippedEmail(order);

        // Same key for a retry of the same attempt. If the email went out but
        // saving sentAt failed, Resend recognises the retry and doesn't send
        // it twice. A genuine failure bumps attempts, so the next try is new.
        await sendEmail(order.user.email, subject, html, `order-email/${email.id}/${email.attempts}`);

        await prisma.orderEmail.update({
            where: { id: email.id },
            data: { sentAt: new Date(), lastError: null }
        });
    } catch (err) {
        const attempts = email.attempts + 1;
        const message = err instanceof Error ? err.message : String(err);

        console.log(`Order #${order.number} ${email.kind} email failed (attempt ${attempts} of ${MAX_ATTEMPTS}): ${message}`);

        await prisma.orderEmail.update({
            where: { id: email.id },
            data: {
                attempts,
                lastError: message.slice(0, 500),
                nextAttemptAt: new Date(Date.now() + 2 ** attempts * 60 * 1000)
            }
        });
    }
}

export async function sendQueuedOrderEmails() {
    const due = await prisma.orderEmail.findMany({
        where: {
            sentAt: null,
            attempts: { lt: MAX_ATTEMPTS },
            nextAttemptAt: { lte: new Date() }
        },
        select: { id: true },
        orderBy: { createdAt: "asc" },
        take: 20
    });

    for (const { id } of due) {
        try {
            await sendOne(id);
        } catch (err) {
            // A database error on one email must not stop the rest.
            console.log("Could not process order email", id, err);
        }
    }
}
