import { useState, useEffect } from "react"
import { Link } from "react-router-dom";

function ProductList() {

    const [loading, setLoading] = useState(true);
    const [products, setProducts] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [sortOrder, setSortOrder] = useState("");

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

    const filteredProducts = products.filter((product) =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const sortedProducts = [...filteredProducts].sort((a,b) => {
        if (sortOrder === "price-asc") return a.basePrice - b.basePrice;
        if (sortOrder === "price-desc") return b.basePrice - a.basePrice;
        return 0;
    });

    return (
        <div>
            <input type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)} />

                <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
                    <option value="">Default</option>
                    <option value="price-asc">Price: Low to High</option>
                    <option value="price-desc">Price: High to Low</option>
                </select>

            {sortedProducts.map((product) => (
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
