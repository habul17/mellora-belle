// The shape GET /products and GET /products/:slug send back.
import { API } from "./api"

export type Variant = {
    id: string;
    size: string;
    color: string;
    sku: string;
    stockQuantity: number;
    priceOverride: number | null;
};

export type Product = {
    id: string;
    name: string;
    slug: string;
    description: string;
    basePrice: number;
    compareAtPrice: number | null;
    images: string[];
    category: { name: string; slug: string } | null;
    variants: Variant[];
};

const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];

// The database returns sizes in whatever order they were added (XL, M, L...).
export function bySize(variants: Variant[]) {
    const rank = (size: string) => {
        const i = SIZE_ORDER.indexOf(size);
        return i === -1 ? SIZE_ORDER.length : i;
    };
    return [...variants].sort((a, b) => rank(a.size) - rank(b.size));
}

export function isSoldOut(product: Product) {
    return product.variants.every((v) => v.stockQuantity <= 0);
}

export async function fetchProducts(): Promise<Product[]> {
    const response = await fetch(`${API}/products`);
    const data = await response.json();
    if (!Array.isArray(data.products)) throw new Error(data.error ?? "Could not load products");
    return data.products;
}

// Null when there's no such product (a mistyped or old link).
export async function fetchProduct(slug: string): Promise<Product | null> {
    const response = await fetch(`${API}/products/${encodeURIComponent(slug)}`);
    if (response.status === 404) return null;
    const data = await response.json();
    if (!data.product) throw new Error(data.error ?? "Could not load this product");
    return data.product;
}
