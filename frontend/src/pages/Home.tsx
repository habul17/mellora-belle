import { Link } from "react-router-dom"
import { ButtonLink, Container, ErrorState, SlowHint } from "../components/ui"
import { ProductGrid, ProductGridSkeleton } from "../components/ProductCard"
import { ChatIcon, LockIcon, ReturnIcon, TruckIcon } from "../components/icons"
import { useProducts } from "../lib/useProducts"
import { usePageTitle } from "../lib/usePageTitle"
import { sized, srcSet } from "../lib/images"
import { business, returns, shipping } from "../lib/business"
import { eyebrowClass } from "../lib/styles"

// Hardcoded on purpose (Phase 9): the hero shows before the server answers,
// which matters when the free server is waking up. Each photo opens its product.
const PHOTO = "https://res.cloudinary.com/ozdnlp8w/image/upload";
const HERO = [
    { src: `${PHOTO}/v1787977479/IMG_6654.jpg`, name: "Midnight Bloom", slug: "midnight-bloom-designer-kurthi" },
    { src: `${PHOTO}/v1787977551/IMG_6514.jpg`, name: "Ocean Bloom", slug: "ocean-bloom-designer-kurthi" },
    { src: `${PHOTO}/v1787977601/IMG_6701.jpg`, name: "Olive Aura", slug: "olive-aura-co-ordset" },
];
const STORY_PHOTO = `${PHOTO}/v1787977591/IMG_6692.jpg`;

const PROMISES = [
    { Icon: TruckIcon, title: "Ships across India", text: `Free shipping on ${shipping.freeFromItems} or more items. Dispatched within ${shipping.dispatchDays}.` },
    { Icon: ReturnIcon, title: "Easy returns", text: `Ask for a return within ${returns.returnWindowDays} days of delivery.` },
    { Icon: LockIcon, title: "Secure payment", text: "UPI, cards and netbanking through Razorpay." },
    { Icon: ChatIcon, title: "Here to help", text: "Email or call us, and a real person answers." },
];

function Home() {
    usePageTitle(null);
    const { products, error } = useProducts();

    return (
        <main>
            <section className="pt-12 sm:pt-16">
                <Container className="text-center">
                    <p className={eyebrowClass}>The first collection</p>
                    <h1 className="mx-auto mt-4 max-w-3xl text-5xl leading-[1.05] sm:text-6xl lg:text-7xl">
                        Designed to <em className="text-plum">bloom</em>
                    </h1>
                    <p className="mx-auto mt-5 max-w-xl leading-relaxed text-muted sm:text-lg">
                        Designer kurthis and co-ord sets in bold floral prints, made for long days
                        and easy evenings. Shipped across India from {business.city.split(",")[0]}.
                    </p>
                    <ButtonLink to="/shop" className="mt-8">Shop the collection</ButtonLink>
                </Container>

                {/* Phones swipe through the three; wider screens see them side by side. */}
                <div className="mx-auto mt-12 flex max-w-[1400px] snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mt-16 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-6 lg:px-8">
                    {HERO.map((photo, i) => (
                        <Link key={photo.slug} to={`/products/${photo.slug}`}
                            className="group relative w-[78%] shrink-0 snap-center overflow-hidden bg-sand sm:w-auto">
                            <img src={sized(photo.src, 800)} srcSet={srcSet(photo.src, [400, 600, 800, 1200])}
                                sizes="(min-width: 640px) 33vw, 78vw" alt={`${photo.name}, worn outdoors`}
                                loading={i === 0 ? "eager" : "lazy"} fetchPriority={i === 0 ? "high" : "auto"}
                                className="aspect-[3/4] w-full object-cover object-top transition-transform duration-700 group-hover:scale-[1.03]" />
                            <span className="absolute bottom-4 left-4 bg-ivory/90 px-3 py-1.5 text-[11px] font-medium tracking-[0.18em] uppercase">
                                {photo.name}
                            </span>
                        </Link>
                    ))}
                </div>
            </section>

            <section className="border-y border-stone bg-sand mt-16 sm:mt-24">
                <Container className="grid grid-cols-2 gap-x-6 gap-y-8 py-10 lg:grid-cols-4">
                    {PROMISES.map(({ Icon, title, text }) => (
                        <div key={title} className="flex flex-col items-start gap-3 sm:flex-row">
                            <Icon className="shrink-0 text-plum" width={26} height={26} />
                            <div>
                                <h2 className="font-sans text-sm font-medium">{title}</h2>
                                <p className="mt-1 text-sm leading-relaxed text-muted">{text}</p>
                            </div>
                        </div>
                    ))}
                </Container>
            </section>

            <section className="pt-16 sm:pt-24">
                <Container>
                    <div className="mb-10 flex items-end justify-between gap-4">
                        <div>
                            <p className={eyebrowClass}>Shop</p>
                            <h2 className="mt-3 text-4xl sm:text-5xl">The collection</h2>
                        </div>
                        <Link to="/shop" className="shrink-0 border-b border-ink pb-0.5 text-[13px] tracking-[0.16em] uppercase transition-colors hover:border-plum hover:text-plum">
                            View all
                        </Link>
                    </div>

                    {error ? <ErrorState message={error} /> : products ? (
                        <ProductGrid products={products} />
                    ) : (
                        <>
                            <ProductGridSkeleton />
                            <SlowHint />
                        </>
                    )}
                </Container>
            </section>

            <section className="pt-20 sm:pt-28">
                <Container className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
                    <img src={sized(STORY_PHOTO, 900)} srcSet={srcSet(STORY_PHOTO, [450, 700, 900, 1200])}
                        sizes="(min-width: 1024px) 45vw, 100vw" alt="The Olive Aura co-ord set" loading="lazy"
                        className="aspect-[4/5] w-full bg-sand object-cover" />
                    <div className="lg:max-w-md">
                        <p className={eyebrowClass}>Our story</p>
                        <h2 className="mt-3 text-4xl leading-tight sm:text-5xl">A small label from {business.city.split(",")[0]}</h2>
                        <p className="mt-5 leading-relaxed text-muted">
                            {business.name} makes clothes you reach for every day that still feel special.
                            We choose every print for its colour, check each piece before it's packed, and
                            reply to every message ourselves.
                        </p>
                        <ButtonLink to="/shop" variant="secondary" className="mt-8">Explore the prints</ButtonLink>
                    </div>
                </Container>
            </section>
        </main>
    );
}

export default Home
