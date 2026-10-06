import { useState, useEffect, useRef } from "react"
import { Link, Navigate } from "react-router-dom"
import { getToken, authFetch } from "../lib/api"
import { statusLabel, formatDate, formatDateTime, courierProblem } from "../lib/orders"
import type { AdminOrderView, OrderStatus } from "../lib/orders"
import AdminNav from "../components/AdminNav"

// Tabs across the top, each a filter over the same list.
const VIEWS: { key: string; label: string; matches: (order: AdminOrderView) => boolean }[] = [
    { key: "requests", label: "Requests", matches: (o) => o.status === "CANCELLATION_REQUESTED" || o.status === "RETURN_REQUESTED" },
    { key: "to-pack", label: "To pack", matches: (o) => o.status === "PAID" },
    { key: "to-ship", label: "To ship", matches: (o) => o.status === "PACKED" },
    { key: "shipped", label: "Shipped", matches: (o) => o.status === "SHIPPED" },
    { key: "delivered", label: "Delivered", matches: (o) => o.status === "DELIVERED" },
    { key: "refund", label: "Refund needed", matches: (o) => o.refundNeeded },
    { key: "closed", label: "Cancelled & returned", matches: (o) => (o.status === "CANCELLED" || o.status === "RETURNED") && !o.refundNeeded },
    { key: "all", label: "All", matches: () => true },
];

// Where an order lands after each step, for the notice shown once it has
// moved out of the tab the admin is looking at.
const DONE_NOTICE: Partial<Record<OrderStatus, string>> = {
    PACKED: "marked packed. It's now under To ship.",
    SHIPPED: "marked shipped, and the customer is being emailed. It's now under Shipped.",
    DELIVERED: "marked delivered. It's now under Delivered.",
};

const DAY_MS = 24 * 60 * 60 * 1000;

// Orders paid in the last `days` days, and what they brought in after refunds.
function sales(orders: AdminOrderView[], days: number) {
    const recent = orders.filter((o) => o.paidAt && Date.now() - Date.parse(o.paidAt) < days * DAY_MS);
    const revenue = recent.reduce((sum, o) => sum + o.totalAmount - (o.refundAmount ?? 0), 0);
    return `${recent.length} ${recent.length === 1 ? "order" : "orders"}, ₹${revenue.toLocaleString("en-IN")}`;
}

type ShipForm = { courierName: string; trackingNumber: string; trackingUrl: string };
type RefundForm = { amount: string; reference: string };

// A booking takes a few seconds: while one is under way, the list is fetched
// again every few seconds, up to this many times.
const POLL_MS = 4000;
const MAX_POLLS = 30;

function shipmentUnderWay(order: AdminOrderView) {
    const s = order.shipment;
    return !!s && ((s.status === "BOOKING" && s.attempts === 0 && order.status === "PACKED") || s.status === "CANCELLING");
}

// The Shiprocket booking, and what to do about it.
function ShipmentInfo({ order, shiprocket, busy, onBook }: { order: AdminOrderView; shiprocket: boolean; busy: boolean; onBook: () => void }) {
    const s = order.shipment;
    const packed = order.status === "PACKED";

    if (!s) {
        if (!shiprocket || !packed) return null;
        return <p>Not booked with Shiprocket. <button disabled={busy} onClick={onBook}>Book with Shiprocket</button></p>;
    }

    const update = s.courierStatus && (
        <p>
            Courier update: <strong>{s.courierStatus}</strong>
            {s.courierStatusAt && <> ({formatDateTime(s.courierStatusAt)})</>}
            {courierProblem(s.courierStatus) && <> · <strong>needs attention in the Shiprocket panel</strong></>}
        </p>
    );

    let message;
    switch (s.status) {
        case "BOOKING":
            message = order.status === "CANCELLATION_REQUESTED"
                ? <p>Shiprocket booking paused until you answer the cancellation request.</p>
                : s.attempts === 0
                    ? <p>Booking with Shiprocket…</p>
                    : <p>Shiprocket booking failed {s.attempts} {s.attempts === 1 ? "time" : "times"}, trying again automatically. Last error: {s.lastError}</p>;
            break;
        case "BOOKED":
            message = (
                <p>
                    Booked with Shiprocket: {s.courierName}, AWB {s.awb}.{" "}
                    {s.pickupScheduledFor ? `Pickup on ${formatDateTime(s.pickupScheduledFor)}.` : s.pickupRequestedAt && "Pickup requested."}{" "}
                    {s.labelUrl && <a href={s.labelUrl} target="_blank" rel="noreferrer">Print the label</a>}
                    {packed && <><br />It moves to Shipped by itself when the courier collects it.</>}
                </p>
            );
            break;
        case "FAILED":
            message = packed ? (
                <p>
                    <strong>Shiprocket booking failed:</strong> {s.lastError}<br />
                    Fix it in Shiprocket (for example, add money to the wallet), then{" "}
                    <button disabled={busy} onClick={onBook}>Try again</button>, or ship it another way and fill in the form below.
                </p>
            ) : order.status === "CANCELLED" ? (
                <p>
                    <strong>Couldn't cancel the Shiprocket booking:</strong> {s.lastError}<br />
                    <button disabled={busy} onClick={onBook}>Try again</button> or cancel it in the Shiprocket panel.
                </p>
            ) : (
                <p><strong>Shiprocket booking failed:</strong> {s.lastError}</p>
            );
            break;
        case "CANCELLING":
            message = <p>Cancelling the Shiprocket booking…</p>;
            break;
        case "CANCELLED":
            message = packed
                ? <p>The Shiprocket booking was cancelled. <button disabled={busy} onClick={onBook}>Book again</button></p>
                : <p>Shiprocket booking cancelled.</p>;
            break;
    }

    return <>{message}{update}</>;
}

function AdminOrders() {
    const token = getToken();

    const [orders, setOrders] = useState<AdminOrderView[] | null>(null);
    // Whether marking an order packed books it with Shiprocket.
    const [shiprocket, setShiprocket] = useState(false);
    const pollsLeft = useRef(MAX_POLLS);
    const [error, setError] = useState<string | null>(null);
    const [view, setView] = useState("to-pack");
    const [shipForms, setShipForms] = useState<Record<string, ShipForm>>({});
    const [declineNotes, setDeclineNotes] = useState<Record<string, string>>({});
    const [refundForms, setRefundForms] = useState<Record<string, RefundForm>>({});
    // Errors stay on the order: it didn't move, so it's still on screen.
    const [errors, setErrors] = useState<Record<string, string>>({});
    // Success goes at the top: a moved order leaves the current tab at once.
    const [notice, setNotice] = useState("");
    const [busyId, setBusyId] = useState<string | null>(null);

    useEffect(() => {
        if (!token) return;

        authFetch("/admin/orders")
            .then((data) => {
                if (!data.orders) {
                    setError(data.error ?? "Could not load orders");
                    return;
                }
                setOrders(data.orders);
                setShiprocket(Boolean(data.shiprocket));
                // A customer waiting on an answer comes first.
                if (data.orders.some(VIEWS[0]!.matches)) setView("requests");
            })
            .catch(() => setError("Could not reach the server"));
    }, [token]);

    const underWay = orders?.some(shipmentUnderWay) ?? false;

    useEffect(() => {
        if (!underWay || pollsLeft.current <= 0) return;

        const timer = setTimeout(() => {
            pollsLeft.current -= 1;
            authFetch("/admin/orders")
                .then((data) => { if (data.orders) setOrders(data.orders); })
                .catch(() => { /* try again on the next tick */ });
        }, POLL_MS);

        return () => clearTimeout(timer);
    }, [underWay, orders]);

    if (!token) {
        return <Navigate to="/admin/login?from=/admin/orders" replace />;
    }

    if (error) return <div className="admin">{error}</div>;
    if (!orders) return <div className="admin">Loading...</div>;

    // Filled in from the Shiprocket booking when there is one.
    function shipFormFor(order: AdminOrderView): ShipForm {
        return shipForms[order.id] ?? { courierName: order.courierName ?? "", trackingNumber: order.trackingNumber ?? "", trackingUrl: order.trackingUrl ?? "" };
    }

    function updateShipForm(order: AdminOrderView, field: keyof ShipForm, value: string) {
        setShipForms((prev) => ({ ...prev, [order.id]: { ...shipFormFor(order), [field]: value } }));
    }

    function refundFormFor(order: AdminOrderView): RefundForm {
        return refundForms[order.id] ?? { amount: String(order.totalAmount), reference: "" };
    }

    function updateRefundForm(order: AdminOrderView, field: keyof RefundForm, value: string) {
        setRefundForms((prev) => ({ ...prev, [order.id]: { ...refundFormFor(order), [field]: value } }));
    }

    // Sends one change for one order, swaps in the order the server sends back,
    // and says what happened.
    async function act(order: AdminOrderView, path: string, init: RequestInit, done: string) {
        setBusyId(order.id);
        setNotice("");
        setErrors((prev) => ({ ...prev, [order.id]: "" }));

        try {
            const data = await authFetch(`/admin/orders/${order.id}/${path}`, init);

            if (data.order) {
                pollsLeft.current = MAX_POLLS;
                setOrders((prev) => prev && prev.map((o) => (o.id === order.id ? data.order : o)));
                setNotice(`Order #${order.number} ${done}`);
            } else {
                setErrors((prev) => ({ ...prev, [order.id]: data.error ?? "Something went wrong" }));
            }
        } catch {
            setErrors((prev) => ({ ...prev, [order.id]: "Could not reach the server" }));
        } finally {
            setBusyId(null);
        }
    }

    function moveTo(order: AdminOrderView, status: OrderStatus) {
        if (status === "DELIVERED" && !window.confirm(`Mark order #${order.number} as delivered? This can't be undone.`)) {
            return;
        }
        const done = status === "PACKED" && shiprocket
            ? "marked packed and is being booked with Shiprocket. It's now under To ship."
            : DONE_NOTICE[status] ?? "updated.";
        act(order, "status", {
            method: "PATCH",
            body: JSON.stringify({ status, ...(status === "SHIPPED" && shipFormFor(order)) }),
        }, done);
    }

    function book(order: AdminOrderView) {
        act(order, "shipment", { method: "POST" }, "is being booked with Shiprocket.");
    }

    function cancel(order: AdminOrderView) {
        const booked = order.shipment?.status === "BOOKED" || order.shipment?.status === "BOOKING";
        if (!window.confirm(`Cancel order #${order.number}? Its stock goes back on sale and the customer is emailed.${booked ? " The Shiprocket booking is cancelled too." : ""} You then refund them in Razorpay.`)) {
            return;
        }
        act(order, "cancel", { method: "POST" }, "cancelled and the customer is being emailed. Refund it next: it's under Refund needed.");
    }

    function decline(order: AdminOrderView) {
        act(order, "decline", { method: "POST", body: JSON.stringify({ note: declineNotes[order.id] ?? "" }) },
            "request declined, and the customer is being emailed your note.");
    }

    function markReturned(order: AdminOrderView) {
        if (!window.confirm(`Has the parcel for order #${order.number} arrived and been checked?`)) return;
        act(order, "returned", { method: "POST" }, "marked returned. Send a replacement or refund it next: it's under Refund needed.");
    }

    function markReplaced(order: AdminOrderView) {
        if (!window.confirm(`Have you sent a replacement for order #${order.number}? It won't be refunded.`)) return;
        act(order, "replaced", { method: "POST" }, "marked as replaced, so no refund is owed.");
    }

    function markRefunded(order: AdminOrderView) {
        const form = refundFormFor(order);
        act(order, "refund", { method: "POST", body: JSON.stringify({ amount: Number(form.amount), reference: form.reference }) },
            "marked refunded, and the customer is being emailed.");
    }

    const current = VIEWS.find((v) => v.key === view) ?? VIEWS[0]!;
    const visible = orders.filter(current.matches);

    return (
        <main className="admin">
            <AdminNav />
            <h1>Orders</h1>
            <p>
                Last 7 days: {sales(orders, 7)} · Last 30 days: {sales(orders, 30)} (after refunds).
                Visitor numbers are in Google Analytics once it's switched on.
            </p>

            <nav>
                {VIEWS.map((v) => (
                    <button key={v.key} onClick={() => setView(v.key)} disabled={v.key === view} style={{ marginRight: 8 }}>
                        {v.label} ({orders.filter(v.matches).length})
                    </button>
                ))}
            </nav>

            {notice && <p><strong>{notice}</strong></p>}

            {visible.length === 0 && <p>Nothing here.</p>}

            {visible.map((order) => {
                const form = shipFormFor(order);
                const refund = refundFormFor(order);
                const busy = busyId === order.id;
                const openRequest = order.status === "CANCELLATION_REQUESTED" || order.status === "RETURN_REQUESTED";

                return (
                    <section key={order.id} style={{ borderTop: "1px solid #ccc", marginTop: 16 }}>
                        <h2>Order #{order.number} — {statusLabel(order)}</h2>
                        <p>
                            Paid {order.paidAt ? formatDate(order.paidAt) : "-"} · ₹{order.totalAmount}
                            {" "}(₹{order.subtotal} + ₹{order.shippingCost} shipping) ·
                            Razorpay payment {order.razorpayPaymentId ?? "-"}
                        </p>

                        <ul>
                            {order.items.map((item) => (
                                <li key={item.id}>{item.productName} — size {item.size} × {item.quantity}</li>
                            ))}
                        </ul>

                        <p>
                            {order.address.fullName} · {order.address.phone} · {order.customerEmail}<br />
                            {order.address.addressLine1}
                            {order.address.addressLine2 && `, ${order.address.addressLine2}`},{" "}
                            {order.address.city}, {order.address.state} {order.address.pincode}
                        </p>

                        {order.courierName && (
                            <p>
                                {order.courierName} · {order.trackingNumber}
                                {order.trackingUrl && <> · <a href={order.trackingUrl} target="_blank" rel="noreferrer">track</a></>}
                            </p>
                        )}

                        <ShipmentInfo order={order} shiprocket={shiprocket} busy={busy} onBook={() => book(order)} />

                        {openRequest && (
                            <div>
                                <p>
                                    <strong>{order.status === "CANCELLATION_REQUESTED" ? "Wants to cancel" : "Wants to return"}:</strong>{" "}
                                    {order.requestReason ?? "no reason given"}
                                </p>
                                {order.status === "CANCELLATION_REQUESTED" ? (
                                    <button disabled={busy} onClick={() => cancel(order)}>Approve: cancel the order</button>
                                ) : (
                                    <p>
                                        Ask for photos or an unboxing video if they haven't sent them. Arrange the
                                        return with the customer: we pay its shipping. Once the parcel is back and checked:{" "}
                                        <button disabled={busy} onClick={() => markReturned(order)}>Mark as returned</button>
                                    </p>
                                )}
                                <p>
                                    <input placeholder="Why not? (emailed to the customer)" value={declineNotes[order.id] ?? ""} maxLength={500}
                                        onChange={(e) => setDeclineNotes((prev) => ({ ...prev, [order.id]: e.target.value }))} />
                                    <button disabled={busy} onClick={() => decline(order)}>Decline</button>
                                </p>
                            </div>
                        )}

                        {order.status === "PAID" && (
                            <button disabled={busy} onClick={() => moveTo(order, "PACKED")}>Mark as packed</button>
                        )}

                        {order.status === "PACKED" && (
                            <div>
                                {order.shipment?.status === "BOOKED" && (
                                    <p>Only if the courier has collected it and the order hasn't moved by itself:</p>
                                )}
                                <input placeholder="Courier (e.g. Delhivery)" value={form.courierName}
                                    onChange={(e) => updateShipForm(order, "courierName", e.target.value)} />
                                <input placeholder="Tracking number" value={form.trackingNumber}
                                    onChange={(e) => updateShipForm(order, "trackingNumber", e.target.value)} />
                                <input placeholder="Tracking link (optional)" value={form.trackingUrl}
                                    onChange={(e) => updateShipForm(order, "trackingUrl", e.target.value)} />
                                <button disabled={busy} onClick={() => moveTo(order, "SHIPPED")}>
                                    Mark as shipped and email the customer
                                </button>
                            </div>
                        )}

                        {(order.status === "PAID" || order.status === "PACKED") && (
                            <p><button disabled={busy} onClick={() => cancel(order)}>Cancel order</button></p>
                        )}

                        {order.status === "SHIPPED" && (
                            <button disabled={busy} onClick={() => moveTo(order, "DELIVERED")}>Mark as delivered</button>
                        )}

                        {order.status === "RETURNED" && (
                            <p>If the returned item can be sold again, add it back on the <Link to="/admin">Stock</Link> page.</p>
                        )}

                        {order.refundNeeded && (
                            <div>
                                <p>
                                    <strong>Refund needed.</strong> In the Razorpay dashboard, open Payments, find
                                    payment {order.razorpayPaymentId} and click Refund. Then record it here:
                                </p>
                                <p>
                                    <label>
                                        Amount refunded (₹)
                                        <input type="number" min={1} max={order.totalAmount} value={refund.amount}
                                            onChange={(e) => updateRefundForm(order, "amount", e.target.value)} />
                                    </label>
                                    <input placeholder="Razorpay refund ID (optional, rfnd_...)" value={refund.reference} maxLength={100}
                                        onChange={(e) => updateRefundForm(order, "reference", e.target.value)} />
                                    <button disabled={busy} onClick={() => markRefunded(order)}>Mark as refunded and email the customer</button>
                                </p>
                                {order.status === "RETURNED" && (
                                    <p>
                                        Or, if you sent a replacement instead (take it off on the <Link to="/admin">Stock</Link> page):{" "}
                                        <button disabled={busy} onClick={() => markReplaced(order)}>Mark as replaced (no refund)</button>
                                    </p>
                                )}
                            </div>
                        )}

                        {order.replacementSentAt && <p>Replacement sent on {formatDate(order.replacementSentAt)}</p>}

                        {order.refundedAt && (
                            <p>
                                Refunded ₹{order.refundAmount} on {formatDate(order.refundedAt)}
                                {order.refundReference && <> · {order.refundReference}</>}
                            </p>
                        )}

                        {errors[order.id] && <p>{errors[order.id]}</p>}
                    </section>
                );
            })}
        </main>
    );
}

export default AdminOrders
