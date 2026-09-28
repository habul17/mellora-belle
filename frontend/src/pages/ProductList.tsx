import { useState } from "react"
import { Container, ErrorState, PageHeader, SlowHint } from "../components/ui"
import { ProductGrid, ProductGridSkeleton } from "../components/ProductCard"
import { SearchIcon } from "../components/icons"
import { useProducts } from "../lib/useProducts"
import { usePageTitle } from "../lib/usePageTitle"
import { inputClass, linkClass } from "../lib/styles"

function ProductList() {
    usePageTitle("Shop all");
    const { products, error } = useProducts();
    const [searchTerm, setSearchTerm] = useState("");
    const [sortOrder, setSortOrder] = useState("");

    if (error) return <ErrorState message={error} />;

    const search = searchTerm.trim().toLowerCase();
    const shown = (products ?? [])
        .filter((product) => product.name.toLowerCase().includes(search))
        .sort((a, b) => {
            if (sortOrder === "price-asc") return a.basePrice - b.basePrice;
            if (sortOrder === "price-desc") return b.basePrice - a.basePrice;
            return 0;
        });

    return (
        <main>
            <Container className="pt-12 sm:pt-16">
                <PageHeader eyebrow="Mellora Belle" title="Shop all">
                    <p>Designer kurthis and co-ord sets in bold floral prints.</p>
                </PageHeader>

                <div className="mb-10 flex flex-col gap-3 border-y border-stone py-4 sm:flex-row sm:items-center sm:justify-between">
                    <label className="relative block sm:w-72">
                        <span className="sr-only">Search products</span>
                        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" width={18} height={18} />
                        <input type="search" placeholder="Search" value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)} className={`${inputClass} pl-10`} />
                    </label>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                        {products && (
                            <p className="text-sm text-muted">{shown.length} {shown.length === 1 ? "piece" : "pieces"}</p>
                        )}
                        <label className="flex items-center gap-2 text-sm">
                            <span className="text-muted">Sort</span>
                            <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}
                                className={`${inputClass} w-auto py-2`}>
                                <option value="">Featured</option>
                                <option value="price-asc">Price: low to high</option>
                                <option value="price-desc">Price: high to low</option>
                            </select>
                        </label>
                    </div>
                </div>

                {!products ? (
                    <>
                        <ProductGridSkeleton />
                        <SlowHint />
                    </>
                ) : shown.length === 0 ? (
                    <div className="py-16 text-center">
                        <p className="font-serif text-2xl">Nothing matches “{searchTerm.trim()}”</p>
                        <p className="mt-2 text-muted">
                            Try another word, or{" "}
                            <button type="button" className={linkClass} onClick={() => setSearchTerm("")}>see everything</button>.
                        </p>
                    </div>
                ) : (
                    <ProductGrid products={shown} />
                )}
            </Container>
        </main>
    );
}

export default ProductList
