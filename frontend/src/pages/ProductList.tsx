import { useState, useEffect } from "react"
import { Link } from "react-router-dom";

function ProductList() {

    const [loading, setLoading] = useState(true);
    const [products, setProducts] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);

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

    if (loading) {
        return <div>Loading...</div>
    }

    if (error) {
        return <div>{error}</div>
    }

    return (
        <div>
            {products.map((product) => (
                <Link key={product.id} to={`/products/${product.slug}`}>
                    <img src={product.images[0]} alt={product.name} width={200} />
                    <h3>{product.name}</h3>
                    <p>
                        ₹{product.basePrice}
                        {product.compareAtPrice && (
                            <span style={{ textDecoration: "line-through", marginLeft: 8 }}>
                                ₹{product.compareAtPrice}
                            </span>
                        )}
                    </p>
                </Link>
            ))}
        </div>
    );

}

export default ProductList
