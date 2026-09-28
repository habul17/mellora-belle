import { statusLabel } from "../lib/orders"
import type { OrderView } from "../lib/orders"

// Olive once it's arrived, plum while something needs doing, grey when it's over.
function toneFor(order: OrderView) {
    if (order.status === "DELIVERED") return "bg-olive-soft text-olive";
    if (order.status === "CANCELLED" || order.status === "RETURNED") return "bg-stone/60 text-muted";
    if (order.status === "PENDING") return "bg-rust-soft text-rust";
    return "bg-plum-soft text-plum";
}

function StatusBadge({ order }: { order: OrderView }) {
    return (
        <span className={`inline-block px-2.5 py-1 text-[11px] font-medium tracking-[0.12em] uppercase ${toneFor(order)}`}>
            {statusLabel(order)}
        </span>
    );
}

export default StatusBadge
