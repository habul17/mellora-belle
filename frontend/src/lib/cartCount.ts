// The header shows how many items are in the cart. Anything that changes the
// cart announces it, and the header counts again.
const CART_CHANGED = "mellora:cart-changed";

export function announceCartChange() {
    window.dispatchEvent(new Event(CART_CHANGED));
}

export function onCartChange(listener: () => void) {
    window.addEventListener(CART_CHANGED, listener);
    // The guest cart lives in localStorage, so another tab can change it too.
    window.addEventListener("storage", listener);
    return () => {
        window.removeEventListener(CART_CHANGED, listener);
        window.removeEventListener("storage", listener);
    };
}
