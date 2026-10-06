import { useState, useEffect, useRef } from "react"
import type { ReactNode } from "react"
import { Link, useParams } from "react-router-dom"
import { addToGuestCart } from "../lib/guestCart"
import { getToken, authFetch } from "../lib/api"
import { announceCartChange } from "../lib/cartCount"
import { bySize, fetchProduct, isSoldOut } from "../lib/products"
import type { Product } from "../lib/products"
import { formatPrice, percentOff } from "../lib/format"
import { sized, srcSet } from "../lib/images"
import { usePageTitle } from "../lib/usePageTitle"
import { trackAddToCart, trackViewItem } from "../lib/analytics"
import { business, returns, shipping } from "../lib/business"
import { eyebrowClass, linkClass } from "../lib/styles"
import { Button, ButtonLink, Container, EmptyState, ErrorState, Notice, Skeleton, SlowHint } from "../components/ui"
import { ChevronLeft, ChevronRight } from "../components/icons"

// "Only 2 left" shows at this stock level or below.
const LOW_STOCK = 3;

function ProductDetail() {
    const { slug } = useParams();

    // undefined while loading, null when there's no such product.
    const [product, setProduct] = useState<Product | null | undefined>(undefined);
    const [error, setError] = useState<string | null>(null);
    const [loadedSlug, setLoadedSlug] = useState(slug);
    const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
    const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
    const [adding, setAdding] = useState(false);

    // Moving to another product starts over: nothing selected, no old message.
    if (loadedSlug !== slug) {
        setLoadedSlug(slug);
        setProduct(undefined);
        setError(null);
        setSelectedVariantId(null);
        setMessage(null);
    }

    usePageTitle(product === null ? "Not found" : product?.name);

    useEffect(() => {
        if (!slug) return;
        let live = true;
        fetchProduct(slug)
            .then((found) => {
                if (!live) return;
                setProduct(found);
                if (found) trackViewItem({ id: found.id, name: found.name, price: found.basePrice, quantity: 1 });
            })
            .catch(() => { if (live) setError("We couldn't load this piece. Check your connection and try again."); });
        return () => { live = false; };
    }, [slug]);

    if (error) return <ErrorState message={error} />;
    if (product === undefined) return <ProductSkeleton />;
    if (product === null) {
        return (
            <EmptyState title="We couldn't find that piece"
                action={<ButtonLink to="/shop">Shop all</ButtonLink>}>
                <p>It may have sold out for good, or the link may be incomplete.</p>
            </EmptyState>
        );
    }

    const variants = bySize(product.variants);
    const selected = variants.find((v) => v.id === selectedVariantId) ?? null;
    const price = selected?.priceOverride ?? product.basePrice;
    const off = percentOff(price, product.compareAtPrice);
    const soldOut = isSoldOut(product);
    const colours = [...new Set(variants.map((v) => v.color))];

    async function handleAddToCart() {
        if (!product) return;
        if (!selected) {
            setMessage({ tone: "error", text: "Please choose a size." });
            return;
        }

        setAdding(true);
        setMessage(null);

        try {
            if (getToken()) {
                const data = await authFetch("/cart/items", {
                    method: "POST",
                    body: JSON.stringify({ variantId: selected.id, quantity: 1 }),
                });

                if (data.error) {
                    setMessage({ tone: "error", text: data.error });
                    return;
                }
                announceCartChange();
            } else {
                addToGuestCart({
                    variantId: selected.id,
                    quantity: 1,
                    productName: product.name,
                    slug: product.slug,
                    image: product.images[0] ?? "",
                    price: selected.priceOverride ?? product.basePrice,
                    size: selected.size,
                    color: selected.color,
                });
            }

            setMessage({ tone: "success", text: `Added size ${selected.size} to your cart.` });
            trackAddToCart({ id: product.id, name: product.name, price: selected.priceOverride ?? product.basePrice, quantity: 1, size: selected.size });
        } catch {
            setMessage({ tone: "error", text: "We couldn't reach the shop. Check your connection and try again." });
        } finally {
            setAdding(false);
        }
    }

    return (
        <main>
            <Container className="pt-6 sm:pt-10">
                <nav className="mb-6 text-xs tracking-[0.14em] text-muted uppercase" aria-label="Breadcrumb">
                    <Link to="/shop" className="hover:text-ink">Shop</Link>
                    <span className="mx-2">/</span>
                    <span className="text-ink">{product.name}</span>
                </nav>

                <div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14">
                    <Gallery key={product.id} images={product.images} name={product.name} />

                    <div className="lg:sticky lg:top-28 lg:self-start">
                        {product.category && <p className={eyebrowClass}>{product.category.name}</p>}
                        <h1 className="mt-3 text-4xl leading-tight sm:text-5xl">{product.name}</h1>

                        <p className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xl">
                            {formatPrice(price)}
                            {off > 0 && (
                                <>
                                    <span className="text-base text-muted line-through">{formatPrice(product.compareAtPrice!)}</span>
                                    <span className="bg-plum-soft px-2 py-0.5 text-xs font-medium tracking-wide text-plum">Save {off}%</span>
                                </>
                            )}
                        </p>
                        <p className="mt-2 text-sm text-muted">
                            Free shipping on {shipping.freeFromItems} or more items. <Link to="/shipping" className={linkClass}>See rates</Link>
                        </p>

                        {colours.length > 0 && (
                            <p className="mt-8 text-sm"><span className="text-muted">Colour:</span> {colours.join(", ")}</p>
                        )}

                        <fieldset className="mt-5">
                            <legend className="mb-3 text-sm">
                                <span className="text-muted">Size:</span> {selected?.size ?? "choose one"}
                            </legend>
                            <div className="grid grid-cols-5 gap-2">
                                {variants.map((variant) => {
                                    const out = variant.stockQuantity <= 0;
                                    const isSelected = variant.id === selectedVariantId;
                                    return (
                                        <button key={variant.id} type="button" disabled={out} aria-pressed={isSelected}
                                            onClick={() => { setSelectedVariantId(variant.id); setMessage(null); }}
                                            aria-label={out ? `${variant.size}, sold out` : variant.size}
                                            className={`h-12 border text-sm transition-colors ${isSelected
                                                ? "border-ink bg-ink text-ivory"
                                                : out
                                                    ? "cursor-not-allowed border-stone text-muted/60 line-through"
                                                    : "border-stone bg-white hover:border-ink"}`}>
                                            {variant.size}
                                        </button>
                                    );
                                })}
                            </div>
                        </fieldset>

                        {selected && selected.stockQuantity <= LOW_STOCK && (
                            <p className="mt-3 text-sm text-plum">Only {selected.stockQuantity} left in this size.</p>
                        )}

                        <Button className="mt-6 w-full" onClick={handleAddToCart} disabled={adding || soldOut}>
                            {soldOut ? "Sold out" : adding ? "Adding…" : "Add to cart"}
                        </Button>

                        {message && (
                            <Notice tone={message.tone} className="mt-4">
                                {message.text}
                                {message.tone === "success" && <> <Link to="/cart" className="font-medium underline underline-offset-4">View cart</Link></>}
                            </Notice>
                        )}

                        <div className="mt-10 divide-y divide-stone border-y border-stone">
                            <Details title="Description" open>
                                <p className="whitespace-pre-line">{product.description}</p>
                            </Details>
                            <Details title="Delivery">
                                <p>
                                    We dispatch within {shipping.dispatchDays}, and it usually reaches you
                                    within {shipping.deliveryDays} after that. Orders of {shipping.freeFromItems} or
                                    more items ship free. For a single item, shipping is
                                    {" "}{formatPrice(shipping.rates.tamilNadu)} in Tamil Nadu
                                    and {formatPrice(shipping.rates.restOfIndia)} for most of India.
                                    {" "}<Link to="/shipping" className={linkClass}>Shipping policy</Link>
                                </p>
                            </Details>
                            <Details title="Product details">
                                <p>
                                    Country of origin: {business.countryOfOrigin}<br />
                                    Sold by: {business.legalName}, {business.city}
                                </p>
                            </Details>
                            <Details title="Cancellations and returns">
                                <p>
                                    Cancel within {returns.cancelWindow} of paying for a full refund. We don't
                                    take returns or exchanges for a change of mind or the wrong size ordered.
                                    If it arrives damaged or defective, or we send the wrong item or size,
                                    tell us within {returns.returnWindowDays} days of delivery and we'll
                                    replace it, or refund you.
                                    {" "}<Link to="/refunds" className={linkClass}>Returns policy</Link>
                                </p>
                            </Details>
                        </div>
                    </div>
                </div>
            </Container>
        </main>
    );
}

function Details({ title, open, children }: { title: string; open?: boolean; children: ReactNode }) {
    return (
        <details open={open} className="group py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm tracking-[0.14em] uppercase [&::-webkit-details-marker]:hidden">
                {title}
                <span aria-hidden="true" className="text-lg leading-none transition-transform group-open:rotate-45">+</span>
            </summary>
            <div className="mt-3 text-sm leading-relaxed text-muted">{children}</div>
        </details>
    );
}

// Phones swipe between photos; computers click a thumbnail or the arrows.
function Gallery({ images, name }: { images: string[]; name: string }) {
    const [index, setIndex] = useState(0);
    const track = useRef<HTMLDivElement>(null);

    function show(i: number) {
        const el = track.current;
        if (!el) return;
        const target = Math.max(0, Math.min(images.length - 1, i));
        el.scrollTo({ left: target * el.clientWidth, behavior: "smooth" });
    }

    function handleScroll() {
        const el = track.current;
        if (el) setIndex(Math.round(el.scrollLeft / el.clientWidth));
    }

    if (images.length === 0) return <div className="aspect-[2/3] bg-sand" />;

    return (
        <div className="-mx-4 sm:mx-0 lg:grid lg:grid-cols-[72px_minmax(0,1fr)] lg:gap-4">
            {images.length > 1 && (
                <div className="hidden flex-col gap-3 lg:flex">
                    {images.map((src, i) => (
                        <button key={src} type="button" onClick={() => show(i)} aria-label={`Photo ${i + 1}`}
                            aria-current={i === index}
                            className={`border transition-opacity ${i === index ? "border-ink" : "border-transparent opacity-60 hover:opacity-100"}`}>
                            <img src={sized(src, 150)} alt="" className="aspect-[2/3] w-full object-cover" />
                        </button>
                    ))}
                </div>
            )}

            <div className="relative">
                <div ref={track} onScroll={handleScroll}
                    className="flex snap-x snap-mandatory overflow-x-auto bg-sand [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {images.map((src, i) => (
                        <img key={src} src={sized(src, 900)} srcSet={srcSet(src, [500, 700, 900, 1200, 1600])}
                            sizes="(min-width: 1024px) 50vw, 100vw" alt={`${name}, photo ${i + 1} of ${images.length}`}
                            loading={i === 0 ? "eager" : "lazy"} fetchPriority={i === 0 ? "high" : "auto"}
                            className="aspect-[2/3] w-full shrink-0 snap-center object-cover" />
                    ))}
                </div>

                {images.length > 1 && (
                    <>
                        <button type="button" onClick={() => show(index - 1)} disabled={index === 0} aria-label="Previous photo"
                            className="absolute top-1/2 left-3 hidden size-10 -translate-y-1/2 items-center justify-center bg-ivory/85 transition-opacity hover:bg-ivory disabled:opacity-0 sm:flex">
                            <ChevronLeft />
                        </button>
                        <button type="button" onClick={() => show(index + 1)} disabled={index === images.length - 1} aria-label="Next photo"
                            className="absolute top-1/2 right-3 hidden size-10 -translate-y-1/2 items-center justify-center bg-ivory/85 transition-opacity hover:bg-ivory disabled:opacity-0 sm:flex">
                            <ChevronRight />
                        </button>
                        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5 lg:hidden" aria-hidden="true">
                            {images.map((src, i) => (
                                <span key={src} className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-ink" : "w-1.5 bg-ink/30"}`} />
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function ProductSkeleton() {
    return (
        <Container className="pt-6 sm:pt-10">
            <Skeleton className="mb-6 h-4 w-40" />
            <div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14">
                <Skeleton className="-mx-4 aspect-[2/3] sm:mx-0 lg:ml-[88px]" />
                <div>
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="mt-4 h-10 w-4/5" />
                    <Skeleton className="mt-5 h-6 w-32" />
                    <Skeleton className="mt-10 h-12 w-full" />
                    <Skeleton className="mt-6 h-12 w-full" />
                </div>
            </div>
            <SlowHint />
        </Container>
    );
}

export default ProductDetail
