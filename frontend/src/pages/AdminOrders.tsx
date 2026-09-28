import { useState, useEffect } from "react"
import { Link, Navigate } from "react-router-dom"
import { getToken, authFetch } from "../lib/api"
import { statusLabel, formatDate } from "../lib/orders"
import type { AdminOrderView, OrderStatus } from "../lib/orders"

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

type ShipForm = { courierName: string; trackingNumber: string; trackingUrl: string };
const EMPTY_SHIP_FORM: ShipForm = { courierName: "", trackingNumber: "", trackingUrl: "" };
type RefundForm = { amount: string; reference: string };

function AdminOrders() {
    const token = getToken();

    const [orders, setOrders] = useState<AdminOrderView[] | null>(null);
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
                // A customer waiting on an answer comes first.
                if (data.orders.some(VIEWS[0]!.matches)) setView("requests");
            })
            .catch(() => setError("Could not reach the server"));
    }, [token]);

    if (!token) {
        return <Navigate to="/login?from=/admin/orders" replace />;
    }

    if (error) return <div>{error}</div>;
    if (!orders) return <div>Loading...</div>;

    function updateShipForm(orderId: string, field: keyof ShipForm, value: string) {
        setShipForms((prev) => ({ ...prev, [orderId]: { ...(prev[orderId] ?? EMPTY_SHIP_FORM), [field]: value } }));
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
        act(order, "status", {
            method: "PATCH",
            body: JSON.stringify({ status, ...(status === "SHIPPED" && shipForms[order.id]) }),
        }, DONE_NOTICE[status] ?? "updated.");
    }

    function cancel(order: AdminOrderView) {
        if (!window.confirm(`Cancel order #${order.number}? Its stock goes back on sale and the customer is emailed. You then refund them in Razorpay.`)) {
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
        act(order, "returned", { method: "POST" }, "marked returned. Refund it next: it's under Refund needed.");
    }

    function markRefunded(order: AdminOrderView) {
        const form = refundFormFor(order);
        act(order, "refund", { method: "POST", body: JSON.stringify({ amount: Number(form.amount), reference: form.reference }) },
            "marked refunded, and the customer is being emailed.");
    }

    const current = VIEWS.find((v) => v.key === view) ?? VIEWS[0]!;
    const visible = orders.filter(current.matches);

    return (
        <main>
            <p><Link to="/admin">Stock</Link> · <strong>Orders</strong></p>
            <h1>Orders</h1>

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
                const form = shipForms[order.id] ?? EMPTY_SHIP_FORM;
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
                                        Arrange the return with the customer. Once the parcel is back and checked:{" "}
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
                                <input placeholder="Courier (e.g. Delhivery)" value={form.courierName}
                                    onChange={(e) => updateShipForm(order.id, "courierName", e.target.value)} />
                                <input placeholder="Tracking number" value={form.trackingNumber}
                                    onChange={(e) => updateShipForm(order.id, "trackingNumber", e.target.value)} />
                                <input placeholder="Tracking link (optional)" value={form.trackingUrl}
                                    onChange={(e) => updateShipForm(order.id, "trackingUrl", e.target.value)} />
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
                            </div>
                        )}

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
