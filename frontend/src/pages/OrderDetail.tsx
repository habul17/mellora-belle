import { useState, useEffect } from "react"
import { Link, Navigate, useParams } from "react-router-dom"
import { getToken, authFetch } from "../lib/api"
import { ORDER_STEPS, RETURN_REASONS, statusLabel, formatDate, formatDateTime, soldOutBeforePayment } from "../lib/orders"
import type { OrderView } from "../lib/orders"
import { returns } from "../lib/business"

function OrderDetail() {
    const token = getToken();
    const { id } = useParams();

    const [order, setOrder] = useState<OrderView | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!token || !id) return;

        authFetch(`/orders/${id}`)
            .then((data) => {
                if (data.order) setOrder(data.order);
                else setError(data.error === "Order not found" ? "We couldn't find that order." : data.error ?? "Could not load this order");
            })
            .catch(() => setError("Could not reach the server"));
    }, [token, id]);

    if (!token) {
        return <Navigate to={`/login?from=/orders/${id}`} replace />;
    }

    if (error) return <div>{error} <Link to="/orders">See all your orders</Link></div>;
    if (!order) return <div>Loading...</div>;

    // A return request or a return happens after delivery, so every step was reached.
    const stepStatus = order.status === "RETURN_REQUESTED" || order.status === "RETURNED" ? "DELIVERED" : order.status;
    const reachedIndex = ORDER_STEPS.findIndex((step) => step.status === stepStatus);
    const shipped = order.shippedAt !== null;

    return (
        <main>
            <p><Link to="/orders">← All orders</Link></p>
            <h1>Order #{order.number}</h1>
            <p>Placed on {formatDate(order.paidAt ?? order.createdAt)}</p>
            <p><strong>{statusLabel(order)}</strong></p>

            <OrderOutcome order={order} />

            {reachedIndex >= 0 && (
                <ol>
                    {ORDER_STEPS.map((step, index) => (
                        <li key={step.status}>
                            {index <= reachedIndex ? "✓" : "○"} {step.label}
                        </li>
                    ))}
                </ol>
            )}

            {order.cancelUntil && <CancelForm order={order} onChange={setOrder} />}
            {order.returnUntil && <ReturnForm order={order} onChange={setOrder} />}

            {shipped && (
                <section>
                    <h2>Tracking</h2>
                    <p>
                        Courier: {order.courierName}<br />
                        Tracking number: {order.trackingNumber}
                        {order.shippedAt && <><br />Shipped on {formatDate(order.shippedAt)}</>}
                        {order.deliveredAt && <><br />Delivered on {formatDate(order.deliveredAt)}</>}
                    </p>
                    {order.trackingUrl && (
                        <p><a href={order.trackingUrl} target="_blank" rel="noreferrer">Track your parcel</a></p>
                    )}
                </section>
            )}

            <section>
                <h2>Items</h2>
                {order.items.map((item) => (
                    <div key={item.id}>
                        {item.image && <img src={item.image} alt={item.productName} width={80} />}
                        <p>
                            <Link to={`/products/${item.slug}`}>{item.productName}</Link><br />
                            Size {item.size} × {item.quantity} · ₹{item.price * item.quantity}
                        </p>
                    </div>
                ))}
                <p>
                    Subtotal: ₹{order.subtotal}<br />
                    Shipping: {order.shippingCost ? `₹${order.shippingCost}` : "Free"}<br />
                    <strong>Total paid: ₹{order.totalAmount}</strong>
                </p>
            </section>

            <section>
                <h2>Delivering to</h2>
                <p>
                    {order.address.fullName}<br />
                    {order.address.addressLine1}<br />
                    {order.address.addressLine2 && <>{order.address.addressLine2}<br /></>}
                    {order.address.city}, {order.address.state} {order.address.pincode}<br />
                    Phone: {order.address.phone}
                </p>
            </section>

            <p>
                Need help with this order? <Link to="/contact">Contact us</Link> and mention
                order #{order.number}.
            </p>
        </main>
    );
}

// What happened with a cancellation, return or refund, in plain words.
function OrderOutcome({ order }: { order: OrderView }) {
    const refund = order.refundedAt
        ? <p>We refunded ₹{order.refundAmount} on {formatDate(order.refundedAt)} to your original payment
            method{order.refundReference && <> (reference {order.refundReference})</>}. Banks can take
            {" "}{returns.refundDays} to show it.</p>
        : order.refundNeeded
            ? <p>We'll refund you to your original payment method within {returns.refundDays}, and email you when it's done.</p>
            : null;

    if (order.status === "CANCELLED" && soldOutBeforePayment(order)) {
        return (
            <>
                <p>
                    Sorry, this item sold out before your payment reached us, so the order was
                    cancelled. Your full payment of ₹{order.totalAmount} will be refunded.
                </p>
                {refund}
            </>
        );
    }

    return (
        <>
            {order.status === "CANCELLATION_REQUESTED" && order.cancelRequestedAt && (
                <p>You asked to cancel this order on {formatDateTime(order.cancelRequestedAt)}. We'll confirm by email shortly.</p>
            )}
            {order.status === "RETURN_REQUESTED" && order.returnRequestedAt && (
                <p>
                    You asked to return this order on {formatDate(order.returnRequestedAt)}. We'll email
                    you with how to send it back.
                </p>
            )}
            {order.status === "CANCELLED" && order.cancelledAt && <p>This order was cancelled on {formatDate(order.cancelledAt)}.</p>}
            {order.status === "RETURNED" && order.returnedAt && <p>We received your return on {formatDate(order.returnedAt)}.</p>}
            {order.requestDeclineNote && order.status !== "CANCELLATION_REQUESTED" && order.status !== "RETURN_REQUESTED" && (
                <p>We couldn't accept your request: {order.requestDeclineNote}</p>
            )}
            {refund}
        </>
    );
}

type FormProps = { order: OrderView; onChange: (order: OrderView) => void };

function CancelForm({ order, onChange }: FormProps) {
    const [reason, setReason] = useState("");
    const [message, setMessage] = useState("");
    const [busy, setBusy] = useState(false);

    async function submit() {
        if (!window.confirm(`Cancel order #${order.number}?`)) return;

        setBusy(true);
        setMessage("");
        try {
            const data = await authFetch(`/orders/${order.id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) });
            if (data.order) onChange(data.order);
            else setMessage(data.error ?? "Something went wrong");
        } catch {
            setMessage("Could not reach the server. Please try again.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <section>
            <h2>Cancel this order</h2>
            <p>You can cancel until {formatDateTime(order.cancelUntil!)}. You'll get a full refund.</p>
            <p>
                <label>
                    Reason (optional)
                    <textarea value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
                </label>
            </p>
            <button onClick={submit} disabled={busy}>{busy ? "Sending…" : "Cancel order"}</button>
            {message && <p role="alert">{message}</p>}
        </section>
    );
}

function ReturnForm({ order, onChange }: FormProps) {
    const [reason, setReason] = useState("");
    const [details, setDetails] = useState("");
    const [message, setMessage] = useState("");
    const [busy, setBusy] = useState(false);

    async function submit() {
        if (!reason) {
            setMessage("Choose a reason for the return.");
            return;
        }

        setBusy(true);
        setMessage("");
        try {
            const data = await authFetch(`/orders/${order.id}/return`, { method: "POST", body: JSON.stringify({ reason, details }) });
            if (data.order) onChange(data.order);
            else setMessage(data.error ?? "Something went wrong");
        } catch {
            setMessage("Could not reach the server. Please try again.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <section>
            <h2>Return this order</h2>
            <p>
                You can ask for a return until {formatDate(order.returnUntil!)}. Items must be unworn
                and unwashed, with their tags attached. See our <Link to="/refunds">returns policy</Link>.
            </p>
            <p>
                <label>
                    Reason
                    <select value={reason} onChange={(e) => setReason(e.target.value)}>
                        <option value="">Choose one…</option>
                        {RETURN_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                </label>
            </p>
            <p>
                <label>
                    Anything we should know? (optional)
                    <textarea value={details} maxLength={500} onChange={(e) => setDetails(e.target.value)} />
                </label>
            </p>
            <button onClick={submit} disabled={busy}>{busy ? "Sending…" : "Request a return"}</button>
            {message && <p role="alert">{message}</p>}
        </section>
    );
}

export default OrderDetail
