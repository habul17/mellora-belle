import { Link } from "react-router-dom"
import type { Product } from "../lib/products"
import { isSoldOut } from "../lib/products"
import { formatPrice, percentOff } from "../lib/format"
import { sized, srcSet } from "../lib/images"
import { Skeleton } from "./ui"

const GRID = "grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-3 lg:gap-x-8";
const SIZES = "(min-width: 1024px) 30vw, 50vw";

export function ProductGrid({ products }: { products: Product[] }) {
    return (
        <div className={GRID}>
            {products.map((product, i) => <ProductCard key={product.id} product={product} eager={i < 2} />)}
        </div>
    );
}

export function ProductGridSkeleton({ count = 3 }: { count?: number }) {
    return (
        <div className={GRID}>
            {Array.from({ length: count }, (_, i) => (
                <div key={i}>
                    <Skeleton className="aspect-[2/3]" />
                    <Skeleton className="mt-4 h-5 w-3/4" />
                    <Skeleton className="mt-2 h-4 w-1/3" />
                </div>
            ))}
        </div>
    );
}

// A photo, the name and the price. On a computer, hovering shows the second photo.
function ProductCard({ product, eager }: { product: Product; eager: boolean }) {
    const soldOut = isSoldOut(product);
    const off = percentOff(product.basePrice, product.compareAtPrice);
    const [first, second] = product.images;

    return (
        <Link to={`/products/${product.slug}`} className="group block">
            <div className="relative aspect-[2/3] overflow-hidden bg-sand">
                {first && (
                    <img src={sized(first, 600)} srcSet={srcSet(first, [300, 450, 600, 900])} sizes={SIZES}
                        alt={product.name} loading={eager ? "eager" : "lazy"}
                        className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
                )}
                {second && (
                    <img src={sized(second, 600)} srcSet={srcSet(second, [300, 450, 600, 900])} sizes={SIZES}
                        alt="" aria-hidden="true" loading="lazy"
                        className="absolute inset-0 hidden size-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100 sm:block" />
                )}
                {(soldOut || off > 0) && (
                    <span className={`absolute top-3 left-3 px-2.5 py-1 text-[10px] font-medium tracking-[0.16em] uppercase ${soldOut ? "bg-ink text-ivory" : "bg-ivory text-plum"}`}>
                        {soldOut ? "Sold out" : `${off}% off`}
                    </span>
                )}
            </div>
            <h3 className="mt-4 font-serif text-lg leading-snug sm:text-xl">{product.name}</h3>
            <p className="mt-1 text-sm">
                {formatPrice(product.basePrice)}
                {product.compareAtPrice && product.compareAtPrice > product.basePrice && (
                    <span className="ml-2 text-muted line-through">{formatPrice(product.compareAtPrice)}</span>
                )}
            </p>
        </Link>
    );
}
