import { API, saveToken } from "./api"
import { getGuestCart, saveGuestCart } from "./guestCart"
import type { GuestCartItem } from "./guestCart"

// Where to go after logging in. Only paths on this site: "?from=https://..."
// (or "//evil.com", which browsers read as another site) must not turn our
// login page into a link that forwards people somewhere else.
export function safeRedirect(from: string | null) {
    if (!from || !from.startsWith("/") || from.startsWith("//") || from.startsWith("/\\")) {
        return "/";
    }
    return from;
}

// Keeps the ?from= target when moving between login, signup and back.
export function withFrom(path: string, from: string | null) {
    return from ? `${path}?from=${encodeURIComponent(from)}` : path;
}

// Used by both login and signup.
export async function finishLogin(accessToken: string) {
    saveToken(accessToken);
    await mergeGuestCart(accessToken);
}

// Moves what a visitor added before logging in into their account cart.
// Items the server refuses (sold out, switched off, over the limit) are
// dropped and listed once on the next cart or checkout page, rather than left
// in the browser where a logged-in customer would never see them. Items that
// didn't get through because the connection dropped stay for the next login.
async function mergeGuestCart(token: string) {
    const guestItems = getGuestCart();
    if (guestItems.length === 0) return;

    const unsent: GuestCartItem[] = [];
    const refused: string[] = [];

    for (const item of guestItems) {
        try {
            const response = await fetch(`${API}/cart/items`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify({ variantId: item.variantId, quantity: item.quantity }),
            });

            const data = await response.json();

            if (data.error) {
                refused.push(`${item.productName} (size ${item.size}): ${data.error}`);
            }
        } catch {
            unsent.push(item);
        }
    }

    saveGuestCart(unsent);
    if (refused.length > 0) saveMergeNotice(refused);
}

const MERGE_NOTICE = "cartMergeNotice";

function saveMergeNotice(lines: string[]) {
    try {
        sessionStorage.setItem(MERGE_NOTICE, JSON.stringify(lines));
    } catch {
        // Storage blocked: the items are simply not added, as before.
    }
}

export function readMergeNotice(): string[] {
    try {
        const lines = JSON.parse(sessionStorage.getItem(MERGE_NOTICE) ?? "[]");
        return Array.isArray(lines) ? lines.filter((l) => typeof l === "string") : [];
    } catch {
        return [];
    }
}

export function clearMergeNotice() {
    try {
        sessionStorage.removeItem(MERGE_NOTICE);
    } catch {
        // Nothing to clear.
    }
}
