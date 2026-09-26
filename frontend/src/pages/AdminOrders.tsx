import { useState, useEffect } from "react"
import { Link, Navigate } from "react-router-dom"
import { getToken, authFetch } from "../lib/api"
import { statusLabel, formatDate } from "../lib/orders"
import type { AdminOrderView, OrderStatus } from "../lib/orders"

// Tabs across the top, each a filter over the same list.
const VIEWS: { key: string; label: string; matches: (order: AdminOrderView) => boolean }[] = [
    { key: "to-pack", label: "To pack", matches: (o) => o.status === "PAID" },
    { key: "to-ship", label: "To ship", matches: (o) => o.status === "PACKED" },
    { key: "shipped", label: "Shipped", matches: (o) => o.status === "SHIPPED" },
    { key: "delivered", label: "Delivered", matches: (o) => o.status === "DELIVERED" },
    { key: "refund", label: "Refund needed", matches: (o) => o.refundNeeded },
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

function AdminOrders() {
    const token = getToken();

    const [orders, setOrders] = useState<AdminOrderView[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [view, setView] = useState("to-pack");
    const [shipForms, setShipForms] = useState<Record<string, ShipForm>>({});
    // Errors stay on the order: it didn't move, so it's still on screen.
    const [errors, setErrors] = useState<Record<string, string>>({});
    // Success goes at the top: a moved order leaves the current tab at once.
    const [notice, setNotice] = useState("");
    const [busyId, setBusyId] = useState<string | null>(null);

    useEffect(() => {
        if (!token) return;

        authFetch("/admin/orders")
            .then((data) => {
                if (data.orders) setOrders(data.orders);
                else setError(data.error ?? "Could not load orders");
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

    async function moveTo(order: AdminOrderView, status: OrderStatus) {
        if (status === "DELIVERED" && !window.confirm(`Mark order #${order.number} as delivered? This can't be undone.`)) {
            return;
        }

        setBusyId(order.id);
        setNotice("");
        setErrors((prev) => ({ ...prev, [order.id]: "" }));

        try {
            const data = await authFetch(`/admin/orders/${order.id}/status`, {
                method: "PATCH",
                body: JSON.stringify({ status, ...(status === "SHIPPED" && shipForms[order.id]) }),
            });

            if (data.order) {
                setOrders((prev) => prev && prev.map((o) => (o.id === order.id ? data.order : o)));
                setNotice(`Order #${order.number} ${DONE_NOTICE[status]}`);
            } else {
                setErrors((prev) => ({ ...prev, [order.id]: data.error ?? "Something went wrong" }));
            }
        } catch {
            setErrors((prev) => ({ ...prev, [order.id]: "Could not reach the server" }));
        } finally {
            setBusyId(null);
        }
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
                const busy = busyId === order.id;

                return (
                    <section key={order.id} style={{ borderTop: "1px solid #ccc", marginTop: 16 }}>
                        <h2>Order #{order.number} — {statusLabel(order)}</h2>
                        <p>
                            Paid {order.paidAt ? formatDate(order.paidAt) : "-"} · ₹{order.totalAmount} ·
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

                        {order.status === "SHIPPED" && (
                            <button disabled={busy} onClick={() => moveTo(order, "DELIVERED")}>Mark as delivered</button>
                        )}

                        {order.refundNeeded && (
                            <p>
                                <strong>Refund ₹{order.totalAmount}</strong> to payment {order.razorpayPaymentId} from
                                the Razorpay dashboard. The customer was told to expect it within 5-7 working days.
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
