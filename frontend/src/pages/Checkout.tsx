import { useState, useEffect } from "react"
import type { FormEvent } from "react"
import { Link, Navigate } from "react-router-dom"
import { getToken, authFetch } from "../lib/api"
import { loadRazorpay } from "../lib/razorpay"
import { announceCartChange } from "../lib/cartCount"
import { INDIAN_STATES } from "../lib/indianStates"
import { formatPrice } from "../lib/format"
import { sized } from "../lib/images"
import { usePageTitle } from "../lib/usePageTitle"
import { trackBeginCheckout, trackPurchase } from "../lib/analytics"
import type { TrackedItem } from "../lib/analytics"
import type { OrderView } from "../lib/orders"
import { returns } from "../lib/business"
import { inputClass, linkClass } from "../lib/styles"
import { Button, ButtonLink, Container, EmptyState, ErrorState, Field, Notice, PageHeader, PageLoading, Spinner } from "../components/ui"
import { MergeNotice } from "../components/MergeNotice"
import { CheckIcon, LockIcon } from "../components/icons"

type Order = {
    id: string;
    number: number;
    subtotal: number;
    shippingCost: number;
    totalAmount: number;
    status: string;
    reservedUntil: string;
    fullName: string;
    phone: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    pincode: string;
};

type Address = Pick<Order, "fullName" | "phone" | "addressLine1" | "city" | "state" | "pincode"> & { addressLine2: string };

const EMPTY_ADDRESS: Address = { fullName: "", phone: "", addressLine1: "", addressLine2: "", city: "", state: "", pincode: "" };

type SummaryLine = { id: string; productId: string; name: string; image: string; size: string; quantity: number; price: number };

type CartResponse = {
    cart?: {
        items: {
            id: string;
            quantity: number;
            variant: { size: string; priceOverride: number | null; product: { id: string; name: string; images: string[]; basePrice: number } };
        }[];
    };
    error?: string;
};

// The Razorpay window, as far as this page uses it.
type RazorpayWindow = { on: (event: string, handler: () => void) => void; open: () => void };
type RazorpayConstructor = new (options: object) => RazorpayWindow;

const toTracked = (line: SummaryLine): TrackedItem =>
    ({ id: line.productId, name: line.name, price: line.price, quantity: line.quantity, size: line.size });

const NETWORK_ERROR = "We couldn't reach the shop. Check your connection and try again.";

function Checkout() {
    usePageTitle("Checkout");
    const token = getToken();

    const [lines, setLines] = useState<SummaryLine[] | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [address, setAddress] = useState<Address>(EMPTY_ADDRESS);
    const [order, setOrder] = useState<Order | null>(null);
    const [message, setMessage] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [paying, setPaying] = useState(false);
    const [confirmation, setConfirmation] = useState<
        "checking" | "paid" | "refund-needed" | "unconfirmed" | null
    >(null);

    useEffect(() => {
        if (!token) return;
        let live = true;

        authFetch("/cart")
            .then((data: CartResponse) => {
                if (!live) return;
                if (!data.cart) {
                    setLoadError(data.error ?? "We couldn't load your cart.");
                    return;
                }
                const found = data.cart.items.map((item) => ({
                    id: item.id,
                    productId: item.variant.product.id,
                    name: item.variant.product.name,
                    image: item.variant.product.images[0] ?? "",
                    size: item.variant.size,
                    quantity: item.quantity,
                    price: item.variant.priceOverride ?? item.variant.product.basePrice,
                }));
                setLines(found);
                if (found.length > 0) trackBeginCheckout(found.map(toTracked));
            })
            .catch(() => { if (live) setLoadError(NETWORK_ERROR); });

        // A returning customer starts with the address from their last order.
        authFetch("/orders")
            .then((data: { orders?: OrderView[] }) => {
                const last = data.orders?.[0]?.address;
                if (!live || !last) return;
                setAddress((current) => current === EMPTY_ADDRESS
                    ? { ...last, addressLine2: last.addressLine2 ?? "" }
                    : current);
            })
            .catch(() => { /* the form just starts empty */ });

        return () => { live = false; };
    }, [token]);

    if (!token) {
        return <Navigate to="/login?from=/checkout" replace />;
    }

    function update(field: keyof Address, value: string) {
        setAddress((current) => ({ ...current, [field]: value }));
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        setMessage("");

        try {
            const data = await authFetch("/checkout", { method: "POST", body: JSON.stringify(address) });

            if (data.error) {
                setMessage(data.error);
                return;
            }

            setOrder(data.order);
            window.scrollTo(0, 0);
        } catch {
            setMessage(NETWORK_ERROR);
        } finally {
            setSubmitting(false);
        }
    }

    async function handlePay() {
        if (!order) return;

        setPaying(true);
        setMessage("");

        const loaded = await loadRazorpay();

        if (!loaded) {
            setPaying(false);
            setMessage("Couldn't open the payment window. Check your connection, turn off any ad blocker, and try again.");
            return;
        }

        let data;
        try {
            data = await authFetch(`/orders/${order.id}/payment`, { method: "POST" });
        } catch {
            setPaying(false);
            setMessage(NETWORK_ERROR);
            return;
        }

        if (data.error) {
            setPaying(false);
            setMessage(data.error);
            return;
        }

        // Razorpay keeps its window open after a failed attempt so the customer
        // can retry inside it. Remember the failure for when they close it.
        let paymentFailed = false;

        const Razorpay = (window as unknown as { Razorpay: RazorpayConstructor }).Razorpay;
        const razorpay = new Razorpay({
            key: data.keyId,
            order_id: data.razorpayOrderId,
            amount: data.amount,
            currency: "INR",
            name: "Mellora Belle",
            description: `Order #${order.number}`,
            prefill: { name: order.fullName, contact: order.phone },
            theme: { color: "#5a2848" },
            // Close the window when the stock hold runs out, so nobody pays for
            // items that have already been released to other customers.
            timeout: data.expiresInSeconds,
            handler: () => {
                setPaying(false);
                confirmPayment(order.id);
            },
            modal: {
                ondismiss: () => {
                    setPaying(false);

                    if (paymentFailed) {
                        setMessage("Your payment didn't go through and no money was taken. You can try again.");
                    }
                },
            },
        });

        razorpay.on("payment.failed", () => {
            paymentFailed = true;
        });

        razorpay.open();
    }

    // Razorpay's window saying "success" is not proof on its own. Ask the
    // backend, which checks with Razorpay directly, a few times before giving up.
    async function confirmPayment(orderId: string) {
        setConfirmation("checking");
        window.scrollTo(0, 0);

        for (let attempt = 0; attempt < 5; attempt++) {
            try {
                const data = await authFetch(`/orders/${orderId}/confirm-payment`, { method: "POST" });

                if (data.status === "PAID") {
                    setConfirmation("paid");
                    if (order && lines) trackPurchase(order, lines.map(toTracked));
                    // The server emptied the cart when the payment landed.
                    announceCartChange();
                    return;
                }

                if (data.status === "CANCELLED" && data.paymentStatus === "PAID") {
                    setConfirmation("refund-needed");
                    return;
                }
            } catch {
                // A dropped connection: just ask again.
            }

            await new Promise((resolve) => setTimeout(resolve, 3000));
        }

        setConfirmation("unconfirmed");
    }

    if (order && confirmation) {
        return <Confirmation order={order} state={confirmation} />;
    }

    if (loadError) return <ErrorState message={loadError} />;
    if (!lines) return <PageLoading />;

    if (lines.length === 0 && !order) {
        return (
            <EmptyState title="Your cart is empty" action={<ButtonLink to="/shop">Shop the collection</ButtonLink>}>
                <MergeNotice className="mb-4 text-left" />
                <p>Add something to your cart before checking out.</p>
            </EmptyState>
        );
    }

    const summary = <OrderSummary lines={lines} order={order} />;

    if (order) {
        return (
            <main>
                <Container className="pt-12 sm:pt-16">
                    <Steps current={2} />
                    <PageHeader title="Review and pay" />

                    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-16">
                        <div className="space-y-6">
                            <section className="border border-stone bg-white p-6">
                                <div className="flex items-start justify-between gap-4">
                                    <h2 className="text-2xl">Delivering to</h2>
                                    <button type="button" onClick={() => { setOrder(null); setMessage(""); }} disabled={paying}
                                        className={`text-sm ${linkClass}`}>
                                        Change address
                                    </button>
                                </div>
                                <p className="mt-3 text-sm leading-relaxed">
                                    {order.fullName}<br />
                                    {order.addressLine1}{order.addressLine2 ? `, ${order.addressLine2}` : ""}<br />
                                    {order.city}, {order.state} {order.pincode}<br />
                                    Phone: {order.phone}
                                </p>
                            </section>

                            <Notice>
                                We're holding your items until{" "}
                                <strong>{new Date(order.reservedUntil).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</strong>.
                                Pay before then to make sure they're yours.
                            </Notice>

                            <p className="text-sm leading-relaxed text-muted">
                                By paying you agree to our <Link to="/terms" className={linkClass}>terms</Link>.
                                You can cancel within {returns.cancelWindow} of paying for a full refund.
                            </p>
                        </div>

                        <aside className="h-fit bg-sand p-6 sm:p-8 lg:sticky lg:top-28">
                            {summary}
                            <Button className="mt-6 w-full" onClick={handlePay} disabled={paying}>
                                {paying ? <><Spinner className="size-4 border-ivory/40 border-t-ivory" /> Opening payment…</> : `Pay ${formatPrice(order.totalAmount)}`}
                            </Button>
                            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted">
                                <LockIcon width={14} height={14} /> Secure payment by Razorpay
                            </p>
                            {message && <Notice tone="error" className="mt-4">{message}</Notice>}
                        </aside>
                    </div>
                </Container>
            </main>
        );
    }

    return (
        <main>
            <Container className="pt-12 sm:pt-16">
                <Steps current={1} />
                <PageHeader title="Shipping address" />

                <MergeNotice className="mb-6" />

                <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-16">
                    <form onSubmit={handleSubmit} className="grid gap-5 sm:grid-cols-2">
                        <Field label="Full name" className="sm:col-span-2">
                            <input className={inputClass} autoComplete="name" required value={address.fullName}
                                onChange={(e) => update("fullName", e.target.value)} />
                        </Field>
                        <Field label="Phone" hint="10 digits. The courier calls this number." className="sm:col-span-2">
                            <input className={inputClass} type="tel" inputMode="numeric" autoComplete="tel-national" required
                                maxLength={10} value={address.phone} onChange={(e) => update("phone", e.target.value.replace(/\D/g, ""))} />
                        </Field>
                        <Field label="Address" className="sm:col-span-2">
                            <input className={inputClass} autoComplete="address-line1" required placeholder="House number, street"
                                value={address.addressLine1} onChange={(e) => update("addressLine1", e.target.value)} />
                        </Field>
                        <Field label="Apartment, area, landmark (optional)" className="sm:col-span-2">
                            <input className={inputClass} autoComplete="address-line2"
                                value={address.addressLine2} onChange={(e) => update("addressLine2", e.target.value)} />
                        </Field>
                        <Field label="City">
                            <input className={inputClass} autoComplete="address-level2" required
                                value={address.city} onChange={(e) => update("city", e.target.value)} />
                        </Field>
                        <Field label="Pincode">
                            <input className={inputClass} inputMode="numeric" autoComplete="postal-code" required maxLength={6}
                                value={address.pincode} onChange={(e) => update("pincode", e.target.value.replace(/\D/g, ""))} />
                        </Field>
                        <Field label="State" className="sm:col-span-2">
                            <select className={inputClass} autoComplete="address-level1" required
                                value={address.state} onChange={(e) => update("state", e.target.value)}>
                                <option value="">Choose your state</option>
                                {/* An older order may have a state typed by hand: keep it selectable. */}
                                {address.state && !INDIAN_STATES.includes(address.state) && <option>{address.state}</option>}
                                {INDIAN_STATES.map((s) => <option key={s}>{s}</option>)}
                            </select>
                        </Field>

                        <div className="sm:col-span-2">
                            {message && <Notice tone="error" className="mb-4">{message}</Notice>}
                            <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
                                {submitting ? "Working out your total…" : "Continue to payment"}
                            </Button>
                            <p className="mt-4 text-sm"><Link to="/cart" className={linkClass}>Back to cart</Link></p>
                        </div>
                    </form>

                    <aside className="h-fit bg-sand p-6 sm:p-8 lg:sticky lg:top-28">{summary}</aside>
                </div>
            </Container>
        </main>
    );
}

function Steps({ current }: { current: 1 | 2 }) {
    const step = (n: number, label: string) => (
        <span className={n === current ? "text-ink" : "text-muted"}>
            <span className={`mr-2 inline-flex size-6 items-center justify-center rounded-full border text-[11px] ${n === current ? "border-ink bg-ink text-ivory" : n < current ? "border-ink" : "border-stone"}`}>
                {n < current ? <CheckIcon width={12} height={12} /> : n}
            </span>
            {label}
        </span>
    );

    return (
        <p className="mb-6 flex items-center gap-3 text-xs tracking-[0.14em] uppercase">
            {step(1, "Address")}
            <span className="h-px w-8 bg-stone" />
            {step(2, "Payment")}
        </p>
    );
}

function OrderSummary({ lines, order }: { lines: SummaryLine[]; order: Order | null }) {
    const subtotal = order?.subtotal ?? lines.reduce((sum, line) => sum + line.price * line.quantity, 0);

    return (
        <>
            <h2 className="text-2xl">Order summary</h2>
            <ul className="mt-5 space-y-4">
                {lines.map((line) => (
                    <li key={line.id} className="flex gap-3 text-sm">
                        <div className="relative shrink-0">
                            {line.image
                                ? <img src={sized(line.image, 160)} alt="" className="aspect-[2/3] w-14 bg-stone object-cover" />
                                : <div className="aspect-[2/3] w-14 bg-stone" />}
                            <span className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-muted text-[10px] text-ivory">
                                {line.quantity}
                            </span>
                        </div>
                        <div className="flex-1">
                            <p className="font-serif text-base leading-snug">{line.name}</p>
                            <p className="text-muted">Size {line.size}</p>
                        </div>
                        <p>{formatPrice(line.price * line.quantity)}</p>
                    </li>
                ))}
            </ul>
            <dl className="mt-6 space-y-3 border-t border-stone pt-5 text-sm">
                <div className="flex justify-between">
                    <dt>Subtotal</dt>
                    <dd>{formatPrice(subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                    <dt>Shipping</dt>
                    <dd className={order ? "" : "text-muted"}>
                        {order ? (order.shippingCost ? formatPrice(order.shippingCost) : "Free") : "Next step"}
                    </dd>
                </div>
                {order && (
                    <div className="flex justify-between border-t border-stone pt-3 text-base font-medium">
                        <dt>Total</dt>
                        <dd>{formatPrice(order.totalAmount)}</dd>
                    </div>
                )}
            </dl>
        </>
    );
}

function Confirmation({ order, state }: { order: Order; state: "checking" | "paid" | "refund-needed" | "unconfirmed" }) {
    return (
        <Container className="flex flex-col items-center py-20 text-center sm:py-28">
            {state === "checking" ? (
                <>
                    <Spinner className="size-8" />
                    <h1 className="mt-6 text-3xl sm:text-4xl">Confirming your payment</h1>
                    <p className="mt-3 text-muted">This takes a few seconds. Please don't close this page.</p>
                </>
            ) : (
                <>
                    {state === "paid" && (
                        <>
                            <span className="flex size-14 items-center justify-center rounded-full bg-olive-soft text-olive">
                                <CheckIcon width={28} height={28} />
                            </span>
                            <h1 className="mt-6 text-4xl sm:text-5xl">Thank you!</h1>
                            <p className="mt-3 max-w-md text-muted">
                                Your order #{order.number} is confirmed. We've emailed you a receipt, and
                                we'll email again when it ships.
                            </p>
                        </>
                    )}

                    {state === "refund-needed" && (
                        <>
                            <h1 className="text-4xl">Sorry, this item sold out</h1>
                            <p className="mt-3 max-w-md text-muted">
                                Your payment arrived after your hold expired, and the item sold out
                                in the meantime. Your full payment will be refunded to your original
                                payment method within {returns.refundDays}.
                            </p>
                        </>
                    )}

                    {state === "unconfirmed" && (
                        <>
                            <h1 className="text-4xl">Payment received</h1>
                            <p className="mt-3 max-w-md text-muted">
                                We're still confirming it with the bank. This can take a few
                                minutes. Please don't pay again.
                            </p>
                        </>
                    )}

                    <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                        <ButtonLink to={`/orders/${order.id}`}>View your order</ButtonLink>
                        <ButtonLink to="/shop" variant="secondary">Continue shopping</ButtonLink>
                    </div>
                </>
            )}
        </Container>
    );
}

export default Checkout
