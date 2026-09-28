import { useEffect, useState } from "react"
import { fetchProducts } from "./products"
import type { Product } from "./products"

// Moving between the homepage and the shop reuses the list for a minute
// instead of asking the server again each time.
const FRESH_FOR_MS = 60_000;
let cached: { at: number; request: Promise<Product[]> } | null = null;

function loadProducts() {
    if (!cached || Date.now() - cached.at > FRESH_FOR_MS) {
        const request = fetchProducts();
        cached = { at: Date.now(), request };
        // A failed request mustn't be reused: the next page gets a fresh try.
        request.catch(() => { if (cached?.request === request) cached = null; });
    }
    return cached.request;
}

export function useProducts() {
    const [products, setProducts] = useState<Product[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let live = true;
        loadProducts()
            .then((list) => { if (live) setProducts(list); })
            .catch(() => { if (live) setError("We couldn't load the collection. Check your connection and try again."); });
        return () => { live = false; };
    }, []);

    return { products, error };
}
