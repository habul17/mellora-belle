// ₹1,299 rather than ₹1299: Indian digit grouping, no paise (prices are whole rupees).
export function formatPrice(rupees: number) {
    return `₹${rupees.toLocaleString("en-IN")}`;
}

// How much cheaper than the struck-out price, rounded down so it never overstates.
export function percentOff(price: number, compareAtPrice: number | null | undefined) {
    if (!compareAtPrice || compareAtPrice <= price) return 0;
    return Math.floor(((compareAtPrice - price) / compareAtPrice) * 100);
}
