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
// Items the server refuses (e.g. now out of stock) stay in the browser cart.
async function mergeGuestCart(token: string) {
    const guestItems = getGuestCart();
    if (guestItems.length === 0) return;

    const failed: GuestCartItem[] = [];

    for (const item of guestItems) {
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
            failed.push(item);
        }
    }

    saveGuestCart(failed);
}
