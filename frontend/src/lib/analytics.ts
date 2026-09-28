// Google Analytics 4 and the Meta Pixel. Each switches on only when its ID is
// set as a Vercel environment variable (VITE_GA4_ID, VITE_META_PIXEL_ID), so
// until then nothing loads and nothing is sent.
//
// Everything here is fire-and-forget. An ad blocker, a script that fails to
// load or a mistake in a tag must never stop a page from working, least of
// all checkout, so every call is wrapped and every failure is swallowed.

export type TrackedItem = { id: string; name: string; price: number; quantity: number; size?: string };

type Tag = ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue?: unknown[]; push?: unknown; loaded?: boolean; version?: string };

declare global {
    interface Window {
        dataLayer?: unknown[];
        gtag?: Tag;
        fbq?: Tag;
        _fbq?: Tag;
    }
}

// Only well-formed IDs, so a typo in Vercel can't inject anything into a URL.
function validId(value: unknown, pattern: RegExp) {
    return typeof value === "string" && pattern.test(value.trim()) ? value.trim() : null;
}

const GA_ID = validId(import.meta.env.VITE_GA4_ID, /^G-[A-Z0-9]{4,20}$/);
const PIXEL_ID = validId(import.meta.env.VITE_META_PIXEL_ID, /^\d{5,20}$/);

export const googleAnalyticsOn = GA_ID !== null;
export const metaPixelOn = PIXEL_ID !== null;

function safely(fn: () => void) {
    try {
        fn();
    } catch (err) {
        if (import.meta.env.DEV) console.warn("Analytics call failed", err);
    }
}

function loadScript(src: string) {
    const script = document.createElement("script");
    script.async = true;
    script.src = src;
    // Blocked or offline: the queued calls just never leave the browser.
    script.onerror = () => script.remove();
    document.head.appendChild(script);
}

export function initAnalytics() {
    safely(() => {
        if (GA_ID && !window.gtag) {
            window.dataLayer = window.dataLayer || [];
            // gtag.js reads the `arguments` object itself, not an array copy.
            window.gtag = function gtag() {
                // eslint-disable-next-line prefer-rest-params
                window.dataLayer!.push(arguments);
            };
            window.gtag("js", new Date());
            // Page views are sent by trackPageView on every route change.
            window.gtag("config", GA_ID, { send_page_view: false });
            loadScript(`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`);
        }

        if (PIXEL_ID && !window.fbq) {
            // Meta's standard snippet: queue calls until fbevents.js arrives.
            const fbq = ((...args: unknown[]) => {
                if (fbq.callMethod) fbq.callMethod(...args);
                else fbq.queue!.push(args);
            }) as Tag;
            fbq.push = fbq;
            fbq.loaded = true;
            fbq.version = "2.0";
            fbq.queue = [];
            window.fbq = fbq;
            window._fbq = fbq;
            loadScript("https://connect.facebook.net/en_US/fbevents.js");
            fbq("init", PIXEL_ID);
        }
    });
}

const gaItems = (items: TrackedItem[]) =>
    items.map((item) => ({ item_id: item.id, item_name: item.name, price: item.price, quantity: item.quantity, ...(item.size && { item_variant: item.size }) }));

const total = (items: TrackedItem[]) => items.reduce((sum, item) => sum + item.price * item.quantity, 0);

export function trackPageView() {
    safely(() => {
        window.gtag?.("event", "page_view", { page_location: window.location.href, page_title: document.title });
        window.fbq?.("track", "PageView");
    });
}

export function trackViewItem(item: TrackedItem) {
    safely(() => {
        window.gtag?.("event", "view_item", { currency: "INR", value: item.price, items: gaItems([item]) });
        window.fbq?.("track", "ViewContent", { content_ids: [item.id], content_name: item.name, content_type: "product", value: item.price, currency: "INR" });
    });
}

export function trackAddToCart(item: TrackedItem) {
    safely(() => {
        window.gtag?.("event", "add_to_cart", { currency: "INR", value: total([item]), items: gaItems([item]) });
        window.fbq?.("track", "AddToCart", { content_ids: [item.id], content_name: item.name, content_type: "product", value: total([item]), currency: "INR" });
    });
}

export function trackBeginCheckout(items: TrackedItem[]) {
    safely(() => {
        window.gtag?.("event", "begin_checkout", { currency: "INR", value: total(items), items: gaItems(items) });
        window.fbq?.("track", "InitiateCheckout", { content_ids: items.map((i) => i.id), content_type: "product", num_items: items.reduce((n, i) => n + i.quantity, 0), value: total(items), currency: "INR" });
    });
}

// A purchase is reported once per order, even if the confirmation screen is
// shown again (a reload, or Back then Forward), so revenue isn't counted twice.
const REPORTED_KEY = "reportedOrders";

export function trackPurchase(order: { id: string; number: number; totalAmount: number; shippingCost: number }, items: TrackedItem[]) {
    safely(() => {
        if (!window.gtag && !window.fbq) return;

        let reported: string[] = [];
        try { reported = JSON.parse(localStorage.getItem(REPORTED_KEY) ?? "[]"); } catch { /* start fresh */ }
        if (!Array.isArray(reported)) reported = [];
        if (reported.includes(order.id)) return;
        try { localStorage.setItem(REPORTED_KEY, JSON.stringify([...reported, order.id].slice(-20))); } catch { /* storage full or blocked */ }

        window.gtag?.("event", "purchase", {
            transaction_id: String(order.number),
            currency: "INR",
            value: order.totalAmount,
            shipping: order.shippingCost,
            items: gaItems(items),
        });
        window.fbq?.("track", "Purchase", { content_ids: items.map((i) => i.id), content_type: "product", value: order.totalAmount, currency: "INR" }, { eventID: order.id });
    });
}
