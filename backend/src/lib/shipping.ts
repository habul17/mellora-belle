// Indian pincodes start with a digit that identifies the postal region.
// 1-8 are civilian regions. 9 is the Army Postal Service (APO/FPO), which
// commercial couriers do not deliver to, so we cannot fulfil those orders.
//
// Phase 7 will extend this file with the weight x zone rate table that
// calculates actual shipping cost. This is only the "can we ship here" gate.

const SERVICEABLE_FIRST_DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8"];

export function isServiceablePincode(pincode: string) {
    return SERVICEABLE_FIRST_DIGITS.includes(pincode.charAt(0));
}
