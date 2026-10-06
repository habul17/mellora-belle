import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { getGuestCart, updateGuestCartItem, removeFromGuestCart } from "../lib/guestCart"
import { getToken, authFetch } from "../lib/api"
import { announceCartChange } from "../lib/cartCount"
import { shipping } from "../lib/business"
import { formatPrice } from "../lib/format"
import { sized } from "../lib/images"
import { usePageTitle } from "../lib/usePageTitle"
import { Button, ButtonLink, Container, EmptyState, ErrorState, Notice, PageHeader, PageLoading } from "../components/ui"
import { BagIcon } from "../components/icons"
import { MergeNotice } from "../components/MergeNotice"

type CartLine = {
    id: string;
    variantId: string;
    quantity: number;
    productName: string;
    slug: string | null;
    image: string;
    price: number;
    size: string;
    color: string;
    // Why this line can't be bought as it is (logged-in carts only: the
    // browser's guest cart doesn't know the current stock).
    problem: string | null;
};

// What GET /cart sends back for each item.
type ServerCartItem = {
    id: string;
    variantId: string;
    quantity: number;
    variant: {
        size: string;
        color: string;
        priceOverride: number | null;
        stockQuantity: number;
        product: { name: string; slug: string; images: string[]; basePrice: number; isActive: boolean };
    };
};

async function fetchLines(): Promise<CartLine[]> {
    if (getToken()) {
        const data = await authFetch("/cart");
        if (!data.cart) throw new Error(data.error ?? "Could not load your cart");

        return data.cart.items.map((item: ServerCartItem) => ({
            id: item.id,
            variantId: item.variantId,
            quantity: item.quantity,
            productName: item.variant.product.name,
            slug: item.variant.product.slug,
            image: item.variant.product.images[0] ?? "",
            price: item.variant.priceOverride ?? item.variant.product.basePrice,
            size: item.variant.size,
            color: item.variant.color,
            problem: !item.variant.product.isActive
                ? "No longer available. Please remove it."
                : item.variant.stockQuantity <= 0
                    ? "Sold out in this size. Please remove it."
                    : item.variant.stockQuantity < item.quantity
                        ? `Only ${item.variant.stockQuantity} left. Please lower the quantity.`
                        : null,
        }));
    }

    return getGuestCart().map((item) => ({ ...item, id: item.variantId, slug: item.slug ?? null, problem: null }));
}

function Cart() {
    usePageTitle("Your cart");
    const [lines, setLines] = useState<CartLine[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState("");
    const [busyId, setBusyId] = useState<string | null>(null);

    function reload() {
        return fetchLines()
            .then(setLines)
            .catch(() => setError("We couldn't load your cart. Check your connection and try again."));
    }

    useEffect(() => {
        let live = true;
        fetchLines()
            .then((found) => { if (live) setLines(found); })
            .catch(() => { if (live) setError("We couldn't load your cart. Check your connection and try again."); });
        return () => { live = false; };
    }, []);

    async function changeQuantity(line: CartLine, newQuantity: number) {
        if (newQuantity < 1) return;
        setBusyId(line.id);
        setMessage("");

        try {
            if (getToken()) {
                const data = await authFetch(`/cart/items/${line.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({ quantity: newQuantity }),
                });

                if (data.error) {
                    setMessage(data.error);
                    return;
                }
                announceCartChange();
            } else {
                updateGuestCartItem(line.variantId, newQuantity);
            }
            await reload();
        } catch {
            setMessage("We couldn't reach the shop. Check your connection and try again.");
        } finally {
            setBusyId(null);
        }
    }

    async function removeLine(line: CartLine) {
        setBusyId(line.id);
        setMessage("");

        try {
            if (getToken()) {
                await authFetch(`/cart/items/${line.id}`, { method: "DELETE" });
                announceCartChange();
            } else {
                removeFromGuestCart(line.variantId);
            }
            await reload();
        } catch {
            setMessage("We couldn't reach the shop. Check your connection and try again.");
        } finally {
            setBusyId(null);
        }
    }

    if (error) return <ErrorState message={error} />;
    if (!lines) return <PageLoading />;

    if (lines.length === 0) {
        return (
            <EmptyState title="Your cart is empty" icon={<BagIcon width={40} height={40} />}
                action={<ButtonLink to="/shop">Shop the collection</ButtonLink>}>
                <MergeNotice className="mb-4 text-left" />
                <p>Once you add something, it'll wait for you here.</p>
            </EmptyState>
        );
    }

    const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
    const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
    const freeShipping = itemCount >= shipping.freeFromItems;
    const blocked = lines.some((line) => line.problem);

    return (
        <main>
            <Container className="pt-12 sm:pt-16">
                <PageHeader title="Your cart" />

                <MergeNotice className="mb-6" />

                {message && <Notice tone="error" className="mb-6">{message}</Notice>}

                <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-16">
                    <ul className="divide-y divide-stone border-y border-stone">
                        {lines.map((line) => {
                            const busy = busyId === line.id;
                            const name = line.slug
                                ? <Link to={`/products/${line.slug}`} className="hover:text-plum">{line.productName}</Link>
                                : line.productName;

                            return (
                                <li key={line.id} className={`flex gap-4 py-6 transition-opacity sm:gap-6 ${busy ? "opacity-60" : ""}`}>
                                    {line.image
                                        ? <img src={sized(line.image, 240)} alt={line.productName} className="aspect-[2/3] w-24 shrink-0 bg-sand object-cover sm:w-28" />
                                        : <div className="aspect-[2/3] w-24 shrink-0 bg-sand sm:w-28" />}

                                    <div className="flex min-w-0 flex-1 flex-col">
                                        <div className="flex justify-between gap-4">
                                            <div>
                                                <h2 className="font-serif text-xl leading-snug">{name}</h2>
                                                <p className="mt-1 text-sm text-muted">Size {line.size} · {line.color}</p>
                                                <p className="mt-1 text-sm text-muted">{formatPrice(line.price)} each</p>
                                                {line.problem && <p className="mt-2 text-sm text-rust">{line.problem}</p>}
                                            </div>
                                            <p className="shrink-0 text-sm">{formatPrice(line.price * line.quantity)}</p>
                                        </div>

                                        <div className="mt-auto flex items-center justify-between pt-4">
                                            <div className="flex items-center border border-stone">
                                                <button type="button" aria-label="One fewer" disabled={busy || line.quantity <= 1}
                                                    onClick={() => changeQuantity(line, line.quantity - 1)}
                                                    className="size-10 text-lg transition-colors hover:bg-sand disabled:text-muted/50 disabled:hover:bg-transparent">−</button>
                                                <span className="w-8 text-center text-sm" aria-live="polite">{line.quantity}</span>
                                                <button type="button" aria-label="One more" disabled={busy}
                                                    onClick={() => changeQuantity(line, line.quantity + 1)}
                                                    className="size-10 text-lg transition-colors hover:bg-sand disabled:text-muted/50">+</button>
                                            </div>
                                            <button type="button" disabled={busy} onClick={() => removeLine(line)}
                                                className="text-xs tracking-[0.14em] text-muted uppercase underline-offset-4 hover:text-ink hover:underline">
                                                Remove
                                            </button>
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>

                    <aside className="h-fit bg-sand p-6 sm:p-8 lg:sticky lg:top-28">
                        <h2 className="text-2xl">Order summary</h2>
                        <dl className="mt-6 space-y-3 text-sm">
                            <div className="flex justify-between">
                                <dt>Subtotal ({itemCount} {itemCount === 1 ? "item" : "items"})</dt>
                                <dd>{formatPrice(subtotal)}</dd>
                            </div>
                            {freeShipping ? (
                                <div className="flex justify-between">
                                    <dt>Shipping</dt>
                                    <dd>Free</dd>
                                </div>
                            ) : (
                                <div className="flex justify-between text-muted">
                                    <dt>Shipping</dt>
                                    <dd>At checkout</dd>
                                </div>
                            )}
                        </dl>
                        <p className="mt-4 border-t border-stone pt-4 text-xs leading-relaxed text-muted">
                            {freeShipping
                                ? `Free shipping on orders of ${shipping.freeFromItems} or more items.`
                                : `Add one more item for free shipping. For a single item, shipping is ${formatPrice(shipping.rates.tamilNadu)} in Tamil Nadu and ${formatPrice(shipping.rates.restOfIndia)} for most of India.`}
                        </p>
                        {blocked ? (
                            <>
                                <Button className="mt-6 w-full" disabled>Checkout</Button>
                                <p className="mt-3 text-center text-xs text-rust">Fix the items marked in red to continue.</p>
                            </>
                        ) : (
                            <ButtonLink to="/checkout" className="mt-6 w-full">Checkout</ButtonLink>
                        )}
                        {!getToken() && (
                            <p className="mt-3 text-center text-xs text-muted">Next, you'll log in with a code we email you.</p>
                        )}
                        <p className="mt-4 text-center">
                            <Link to="/shop" className="text-xs tracking-[0.14em] uppercase underline-offset-4 hover:underline">Continue shopping</Link>
                        </p>
                    </aside>
                </div>
            </Container>
        </main>
    );
}

export default Cart
