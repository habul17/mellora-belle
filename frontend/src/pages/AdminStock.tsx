import { useState, useEffect } from "react"

function AdminStock() {

    const [loading, setLoading] = useState(true);
    const [products, setProducts] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [editedStock, setEditedStock] = useState<Record<string, number>>({});

    async function saveStock(variantId: string) {
        const newValue = editedStock[variantId];
        if (newValue === undefined) return;

        const response = await fetch(`${import.meta.env.VITE_API_URL}/variants/${variantId}/stock`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stockQuantity: newValue }),
        });
        const data = await response.json();

        setProducts((prevProducts) =>
            prevProducts.map((product) => ({
                    ...product,
                    variants: product.variants.map((v: any) =>
                        v.id === variantId ? data.variant : v
                    ),
                }))
            );
    }

    useEffect(() => {
        async function getProducts() {
            try {
                const response = await fetch(`${import.meta.env.VITE_API_URL}/products`);
                const data = await response.json();
                setProducts(data.products);
            } catch (err) {
                setError("Could not reach the server");
            } finally {
                setLoading(false);
            }
        }
        getProducts();
    }, [])

    if (loading) return <div>Loading...</div>;
    if (error) return <div>{error}</div>;

    const rows = products.flatMap((product) =>
        product.variants.map((variant: any) => ({
            productName: product.name,
            ...variant,
        }))
    );

    return (
        <table>
            <thead>
                <tr>
                    <th>Product</th>
                    <th>Size</th>
                    <th>Color</th>
                    <th>SKU</th>
                    <th>Stock</th>
                </tr>
            </thead>
            <tbody>
                {rows.map((row) => (
                    <tr key={row.id}>
                        <td>{row.productName}</td>
                        <td>{row.size}</td>
                        <td>{row.color}</td>
                        <td>{row.sku}</td>
                        <td>
                            <input
                                type="number"
                                value={editedStock[row.id] ?? row.stockQuantity}
                                onChange={(e) =>
                                    setEditedStock({ ...editedStock, [row.id]: Number(e.target.value) })
                                }
                            />
                            <button onClick={() => saveStock(row.id)}>Save</button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

export default AdminStock