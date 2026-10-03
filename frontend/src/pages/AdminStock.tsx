import { useState, useEffect } from "react"
import { Navigate } from "react-router-dom"
import AdminNav from "../components/AdminNav"
import { authFetch, getToken } from "../lib/api"
import { bySize } from "../lib/products"
import type { Variant } from "../lib/products"

// At or below this, a size is flagged as running low.
const LOW_STOCK = 3;

type AdminProduct = { id: string; name: string; isActive: boolean; variants: Variant[] };

function AdminStock() {
    const token = getToken();
    const [products, setProducts] = useState<AdminProduct[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [editedStock, setEditedStock] = useState<Record<string, string>>({});
    const [rowMessages, setRowMessages] = useState<Record<string, string>>({});
    const [busyId, setBusyId] = useState<string | null>(null);

    useEffect(() => {
        if (!token) return;

        // Every product, including ones switched off, which the shop hides.
        authFetch("/admin/products")
            .then((data) => {
                if (data.products) setProducts(data.products);
                else setError(data.error ?? "Could not load products");
            })
            .catch(() => setError("Could not reach the server"));
    }, [token]);

    if (!token) return <Navigate to="/admin/login?from=/admin" replace />;
    if (error) return <div className="admin">{error}</div>;
    if (!products) return <div className="admin">Loading...</div>;

    async function saveStock(variantId: string) {
        const value = editedStock[variantId];
        if (value === undefined) return;

        setBusyId(variantId);
        setRowMessages((prev) => ({ ...prev, [variantId]: "" }));

        try {
            const data = await authFetch(`/variants/${variantId}/stock`, {
                method: "PATCH",
                body: JSON.stringify({ stockQuantity: Number(value) }),
            });

            if (!data.variant) {
                setRowMessages((prev) => ({ ...prev, [variantId]: data.error ?? "Could not save" }));
                return;
            }

            setProducts((prev) => prev && prev.map((product) => ({
                ...product,
                variants: product.variants.map((v) => (v.id === variantId ? data.variant : v)),
            })));
            setEditedStock((prev) => {
                const next = { ...prev };
                delete next[variantId];
                return next;
            });
            setRowMessages((prev) => ({ ...prev, [variantId]: "Saved" }));
        } catch {
            setRowMessages((prev) => ({ ...prev, [variantId]: "Could not reach the server" }));
        } finally {
            setBusyId(null);
        }
    }

    const rows = products.flatMap((product) =>
        bySize(product.variants).map((variant) => ({ product, variant }))
    );
    const low = rows.filter(({ product, variant }) => product.isActive && variant.stockQuantity <= LOW_STOCK);

    return (
        <main className="admin">
            <AdminNav />
            <h1>Stock</h1>
            {low.length > 0 && (
                <p>
                    <strong>Running low:</strong>{" "}
                    {low.map(({ product, variant }) => `${product.name} ${variant.size} (${variant.stockQuantity === 0 ? "sold out" : `${variant.stockQuantity} left`})`).join(", ")}
                </p>
            )}
            <table>
                <thead>
                    <tr>
                        <th>Product</th>
                        <th>On sale</th>
                        <th>Size</th>
                        <th>Color</th>
                        <th>SKU</th>
                        <th>Stock</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(({ product, variant }) => (
                        <tr key={variant.id}>
                            <td>{product.name}</td>
                            <td>{product.isActive ? "Yes" : "No (hidden)"}</td>
                            <td>{variant.size}</td>
                            <td>{variant.color}</td>
                            <td>{variant.sku}</td>
                            <td>
                                <input
                                    type="number"
                                    min={0}
                                    value={editedStock[variant.id] ?? String(variant.stockQuantity)}
                                    onChange={(e) => setEditedStock((prev) => ({ ...prev, [variant.id]: e.target.value }))}
                                />
                                <button onClick={() => saveStock(variant.id)} disabled={busyId === variant.id || editedStock[variant.id] === undefined}>
                                    Save
                                </button>
                                {variant.stockQuantity <= LOW_STOCK && <strong>{variant.stockQuantity === 0 ? " Sold out " : " Low "}</strong>}
                                {rowMessages[variant.id]}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </main>
    );
}

export default AdminStock
