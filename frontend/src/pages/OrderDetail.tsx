import { useState, useEffect } from "react"
import type { ReactNode } from "react"
import { Link, Navigate, useParams } from "react-router-dom"
import { getToken, authFetch } from "../lib/api"
import { ORDER_STEPS, RETURN_REASONS, formatDate, formatDateTime, soldOutBeforePayment } from "../lib/orders"
import type { OrderView } from "../lib/orders"
import { returns } from "../lib/business"
import { formatPrice } from "../lib/format"
import { sized } from "../lib/images"
import { usePageTitle } from "../lib/usePageTitle"
import { inputClass, linkClass } from "../lib/styles"
import { Button, ButtonLink, Container, EmptyState, Field, Notice, PageLoading } from "../components/ui"
import { CheckIcon } from "../components/icons"
import StatusBadge from "../components/StatusBadge"

function OrderDetail() {
    const token = getToken();
    const { id } = useParams();

    const [order, setOrder] = useState<OrderView | null>(null);
    const [error, setError] = useState<string | null>(null);
    usePageTitle(order ? `Order #${order.number}` : "Your order");

    useEffect(() => {
        if (!token || !id) return;

        authFetch(`/orders/${id}`)
            .then((data) => {
                if (data.order) setOrder(data.order);
                else setError(data.error === "Order not found" ? "We couldn't find that order." : data.error ?? "Could not load this order");
            })
            .catch(() => setError("We couldn't reach the shop. Check your connection and try again."));
    }, [token, id]);

    if (!token) {
        return <Navigate to={`/login?from=/orders/${id}`} replace />;
    }

    if (error) {
        return (
            <EmptyState title="Something went wrong" action={<ButtonLink to="/orders">See all your orders</ButtonLink>}>
                <p>{error}</p>
            </EmptyState>
        );
    }
    if (!order) return <PageLoading />;

    // A return request or a return happens after delivery, so every step was reached.
    const stepStatus = order.status === "RETURN_REQUESTED" || order.status === "RETURNED" ? "DELIVERED" : order.status;
    const reachedIndex = ORDER_STEPS.findIndex((step) => step.status === stepStatus);
    const shipped = order.shippedAt !== null;

    return (
        <main>
            <Container className="max-w-4xl pt-10 sm:pt-14">
                <p className="mb-6 text-xs tracking-[0.14em] uppercase">
                    <Link to="/orders" className="text-muted hover:text-ink">← All orders</Link>
                </p>

                <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-stone pb-6">
                    <div>
                        <h1 className="text-4xl sm:text-5xl">Order #{order.number}</h1>
                        <p className="mt-2 text-sm text-muted">Placed on {formatDate(order.paidAt ?? order.createdAt)}</p>
                    </div>
                    <StatusBadge order={order} />
                </header>

                <div className="space-y-6">
                    <OrderOutcome order={order} />

                    {reachedIndex >= 0 && (
                        <ol className="grid grid-cols-4 gap-2" aria-label="Order progress">
                            {ORDER_STEPS.map((step, index) => {
                                const done = index <= reachedIndex;
                                return (
                                    <li key={step.status} className="flex flex-col gap-2">
                                        <span className={`h-1 ${done ? "bg-plum" : "bg-stone"}`} />
                                        <span className={`flex items-center gap-1 text-xs tracking-[0.1em] uppercase sm:text-[13px] ${done ? "text-ink" : "text-muted"}`}>
                                            {done && <CheckIcon width={14} height={14} className="hidden text-plum sm:block" />}
                                            <span className="sr-only">{done ? "Done: " : "Not yet: "}</span>
                                            {step.label}
                                        </span>
                                    </li>
                                );
                            })}
                        </ol>
                    )}

                    {order.cancelUntil && <CancelForm order={order} onChange={setOrder} />}
                    {order.returnUntil && <ReturnForm order={order} onChange={setOrder} />}

                    {shipped && (
                        <Card title="Tracking">
                            <p>
                                Courier: {order.courierName}<br />
                                Tracking number: {order.trackingNumber}
                                {order.shippedAt && <><br />Shipped on {formatDate(order.shippedAt)}</>}
                                {order.deliveredAt && <><br />Delivered on {formatDate(order.deliveredAt)}</>}
                            </p>
                            {order.trackingUrl && (
                                <p className="mt-3"><a href={order.trackingUrl} target="_blank" rel="noreferrer" className={linkClass}>Track your parcel</a></p>
                            )}
                        </Card>
                    )}

                    <div className="grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                        <Card title="Items">
                            <ul className="divide-y divide-stone">
                                {order.items.map((item) => (
                                    <li key={item.id} className="flex gap-4 py-3 first:pt-0">
                                        {item.image
                                            ? <img src={sized(item.image, 160)} alt={item.productName} className="aspect-[2/3] w-16 shrink-0 bg-sand object-cover" />
                                            : <div className="aspect-[2/3] w-16 shrink-0 bg-sand" />}
                                        <p className="flex-1">
                                            <Link to={`/products/${item.slug}`} className="font-serif text-lg hover:text-plum">{item.productName}</Link><br />
                                            <span className="text-muted">Size {item.size} × {item.quantity}</span>
                                        </p>
                                        <p>{formatPrice(item.price * item.quantity)}</p>
                                    </li>
                                ))}
                            </ul>
                            <dl className="mt-3 space-y-2 border-t border-stone pt-4">
                                <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatPrice(order.subtotal)}</dd></div>
                                <div className="flex justify-between"><dt>Shipping</dt><dd>{order.shippingCost ? formatPrice(order.shippingCost) : "Free"}</dd></div>
                                <div className="flex justify-between border-t border-stone pt-2 font-medium"><dt>Total paid</dt><dd>{formatPrice(order.totalAmount)}</dd></div>
                            </dl>
                        </Card>

                        <Card title="Delivering to">
                            <p>
                                {order.address.fullName}<br />
                                {order.address.addressLine1}<br />
                                {order.address.addressLine2 && <>{order.address.addressLine2}<br /></>}
                                {order.address.city}, {order.address.state} {order.address.pincode}<br />
                                Phone: {order.address.phone}
                            </p>
                        </Card>
                    </div>

                    <p className="text-sm text-muted">
                        Need help with this order? <Link to="/contact" className={linkClass}>Contact us</Link> and mention
                        order #{order.number}.
                    </p>
                </div>
            </Container>
        </main>
    );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="border border-stone bg-white p-5 text-sm leading-relaxed sm:p-6">
            <h2 className="mb-4 text-2xl">{title}</h2>
            {children}
        </section>
    );
}

// What happened with a cancellation, return or refund, in plain words.
function OrderOutcome({ order }: { order: OrderView }) {
    const refund = order.refundedAt
        ? <p>We refunded {formatPrice(order.refundAmount ?? 0)} on {formatDate(order.refundedAt)} to your original payment
            method{order.refundReference && <> (reference {order.refundReference})</>}. Banks can take
            {" "}{returns.refundDays} to show it.</p>
        : order.refundNeeded
            ? <p>We'll refund you to your original payment method within {returns.refundDays}, and email you when it's done.</p>
            : null;

    if (order.status === "CANCELLED" && soldOutBeforePayment(order)) {
        return (
            <Notice>
                <p>
                    Sorry, this item sold out before your payment reached us, so the order was
                    cancelled. Your full payment of {formatPrice(order.totalAmount)} will be refunded.
                </p>
                {refund}
            </Notice>
        );
    }

    const declined = order.requestDeclineNote && order.status !== "CANCELLATION_REQUESTED" && order.status !== "RETURN_REQUESTED";
    const hasNews = order.status === "CANCELLATION_REQUESTED" || order.status === "RETURN_REQUESTED"
        || order.status === "CANCELLED" || order.status === "RETURNED" || declined || refund;
    if (!hasNews) return null;

    return (
        <Notice className="space-y-2">
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
            {declined && <p>We couldn't accept your request: {order.requestDeclineNote}</p>}
            {refund}
        </Notice>
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
        <Card title="Cancel this order">
            <p className="text-muted">You can cancel until {formatDateTime(order.cancelUntil!)}. You'll get a full refund.</p>
            <Field label="Reason (optional)" className="mt-4">
                <textarea value={reason} maxLength={500} rows={3} className={inputClass} onChange={(e) => setReason(e.target.value)} />
            </Field>
            <Button variant="secondary" className="mt-4" onClick={submit} disabled={busy}>{busy ? "Sending…" : "Cancel order"}</Button>
            {message && <Notice tone="error" className="mt-4">{message}</Notice>}
        </Card>
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
        <Card title="Return this order">
            <p className="text-muted">
                You can ask for a return until {formatDate(order.returnUntil!)}. Items must be unworn
                and unwashed, with their tags attached. See our <Link to="/refunds" className={linkClass}>returns policy</Link>.
            </p>
            <Field label="Reason" className="mt-4">
                <select value={reason} className={inputClass} onChange={(e) => setReason(e.target.value)}>
                    <option value="">Choose one…</option>
                    {RETURN_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
            </Field>
            <Field label="Anything we should know? (optional)" className="mt-4">
                <textarea value={details} maxLength={500} rows={3} className={inputClass} onChange={(e) => setDetails(e.target.value)} />
            </Field>
            <Button variant="secondary" className="mt-4" onClick={submit} disabled={busy}>{busy ? "Sending…" : "Request a return"}</Button>
            {message && <Notice tone="error" className="mt-4">{message}</Notice>}
        </Card>
    );
}

export default OrderDetail
