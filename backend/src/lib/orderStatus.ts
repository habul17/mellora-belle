import type { OrderStatus } from "../generated/prisma/enums.js"

// The steps the admin moves a paid order through, in order. PAID is only ever
// set by the payment code and CANCELLED only by the reservation sweep, so the
// admin can move an order forward one step at a time and nothing else: no
// skipping (PAID -> DELIVERED) and no going back.
const ADMIN_STEPS: OrderStatus[] = ["PAID", "PACKED", "SHIPPED", "DELIVERED"];

// The status an order must be in right now for the admin to move it to
// `target`, or null if `target` isn't a step the admin can take by hand.
export function statusBefore(target: unknown): OrderStatus | null {
    const index = ADMIN_STEPS.indexOf(target as OrderStatus);
    return index > 0 ? ADMIN_STEPS[index - 1]! : null;
}
