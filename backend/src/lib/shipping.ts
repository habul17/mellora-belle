// Indian pincodes start with a digit that identifies the postal region.
// 1-8 are civilian regions. 9 is the Army Postal Service (APO/FPO), which
// commercial couriers do not deliver to, so we cannot fulfil those orders.

const SERVICEABLE_FIRST_DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8"];

export function isServiceablePincode(pincode: string) {
    return SERVICEABLE_FIRST_DIGITS.includes(pincode.charAt(0));
}

// What the customer pays for shipping, in rupees, per order. A single item
// pays about what the courier charges to get it there: parcels ship from
// Coimbatore, so Tamil Nadu is cheapest, and the North-East, Sikkim, Jammu &
// Kashmir and Ladakh cost the most. Two or more items ship free. Change the
// numbers here; the Shipping policy page shows them from
// frontend/src/lib/business.ts, which must match.
export const SHIPPING_RATES = {
    tamilNadu: 89,
    restOfIndia: 109,
    remote: 149,
};

export const FREE_SHIPPING_FROM_ITEMS = 2;

export type ShippingZone = keyof typeof SHIPPING_RATES;

// Pincodes 600000-643999 are Tamil Nadu. 605xxx and 609xxx include
// Puducherry, which couriers price the same as Tamil Nadu from Coimbatore.
// 18xxxx-19xxxx are Jammu & Kashmir and Ladakh, 78xxxx-79xxxx the North-East
// states, and 737xxx Sikkim.
export function shippingZone(pincode: string): ShippingZone {
    const region = Number(pincode.slice(0, 2));
    if (region >= 60 && region <= 64) return "tamilNadu";
    if (region === 18 || region === 19 || region === 78 || region === 79 || pincode.startsWith("737")) return "remote";
    return "restOfIndia";
}

export function shippingCost(items: number, pincode: string) {
    return items >= FREE_SHIPPING_FROM_ITEMS ? 0 : SHIPPING_RATES[shippingZone(pincode)];
}

export function itemCount(lines: { quantity: number }[]) {
    return lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function totalWeight(lines: { quantity: number; variant: { product: { weight: number } } }[]) {
    return lines.reduce((sum, line) => sum + line.variant.product.weight * line.quantity, 0);
}

// The poly bag an order ships in, sent to Shiprocket with each booking.
// Couriers charge for the larger of the real weight and the parcel's size
// (length × breadth × height / 5000 kg). This size works out to 0.45 kg, so a
// single outfit stays in the cheapest 0.5 kg slab. Measure a packed parcel and
// put its real size here.
export const PARCEL_CM = { length: 30, breadth: 25, height: 3 };
