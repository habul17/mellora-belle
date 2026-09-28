// Indian pincodes start with a digit that identifies the postal region.
// 1-8 are civilian regions. 9 is the Army Postal Service (APO/FPO), which
// commercial couriers do not deliver to, so we cannot fulfil those orders.

const SERVICEABLE_FIRST_DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8"];

export function isServiceablePincode(pincode: string) {
    return SERVICEABLE_FIRST_DIGITS.includes(pincode.charAt(0));
}

// What the customer pays for shipping, in rupees: a price for the first kilo,
// then a price for each extra kilo or part of one. Parcels ship from
// Coimbatore, so Tamil Nadu is cheaper. Change the numbers here; the Shipping
// policy page shows them from frontend/src/lib/business.ts, which must match.
export const SHIPPING_RATES = {
    tamilNadu: { firstKg: 60, perExtraKg: 30 },
    restOfIndia: { firstKg: 90, perExtraKg: 50 },
};

export type ShippingZone = keyof typeof SHIPPING_RATES;

// Pincodes 600000-643999 are Tamil Nadu. 605xxx and 609xxx include
// Puducherry, which couriers price the same as Tamil Nadu from Coimbatore.
export function shippingZone(pincode: string): ShippingZone {
    const region = Number(pincode.slice(0, 2));
    return region >= 60 && region <= 64 ? "tamilNadu" : "restOfIndia";
}

export function shippingCost(weightGrams: number, pincode: string) {
    const rate = SHIPPING_RATES[shippingZone(pincode)];
    const kilos = Math.max(1, Math.ceil(weightGrams / 1000));
    return rate.firstKg + (kilos - 1) * rate.perExtraKg;
}

// Total weight of order or cart lines, from each product's weight in grams.
export function totalWeight(lines: { quantity: number; variant: { product: { weight: number } } }[]) {
    return lines.reduce((sum, line) => sum + line.variant.product.weight * line.quantity, 0);
}
