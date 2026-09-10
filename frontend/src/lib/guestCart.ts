export type GuestCartItem = {
    variantId: string;
    quantity: number;
    productName: string;
    image: string;
    price: number;
    size: string;
    color: string;
};

export function getGuestCart(): GuestCartItem[] {
    const raw = localStorage.getItem("guestCart");
    if (!raw) return [];
    return JSON.parse(raw);
}

export function saveGuestCart(items: GuestCartItem[]) {
    localStorage.setItem("guestCart", JSON.stringify(items));
}

export function addToGuestCart(item: GuestCartItem) {
    const cart = getGuestCart();
    const existing = cart.find((i) => i.variantId === item.variantId);

    if (existing) {
        existing.quantity += item.quantity;
    } else {
        cart.push(item);
    }

    saveGuestCart(cart);
}

export function updateGuestCartItem(variantId: string, quantity: number) {
    const cart = getGuestCart();
    const item = cart.find((i) => i.variantId === variantId);
    if (!item) return;

    item.quantity = quantity;
    saveGuestCart(cart);
}

export function removeFromGuestCart(variantId: string) {
    const cart = getGuestCart();
    saveGuestCart(cart.filter((i) => i.variantId !== variantId));
}

export function clearGuestCart() {
    localStorage.removeItem("guestCart");
}