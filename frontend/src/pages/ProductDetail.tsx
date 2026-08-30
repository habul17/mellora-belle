import { useState, useEffect } from "react"
import { useParams } from "react-router-dom"

function ProductDetail() {

    const { slug } = useParams();

    const [loading, setLoading] = useState(true);
    const [product, setProduct] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function getProduct() {
            try {
                const response = await fetch(`${import.meta.env.VITE_API_URL}/products/${slug}`);
                const data = await response.json();

                setProduct(data.product);

            } catch (err) {
                setError("Could not reach the server");
            } finally {
                setLoading(false);
            }
        }
        getProduct();
    }, [slug])

    if (loading) {
        return <div>Loading...</div>
    }

    if (error) {
        return <div>{error}</div>
    }

    return (
        <div>
            <img src={product.images[0]} alt={product.name} width={400} />
            <h1>{product.name}</h1>
            <p>
                ₹{product.basePrice}
                {product.compareAtPrice && (
                    <span style={{ textDecoration: "line-through", marginLeft: 8 }}>
                        ₹{product.compareAtPrice}
                    </span>
                )}
            </p>
            <p>{product.description}</p>
            <div>
                {product.variants.map((variant: any) => (
                    <span key={variant.id}>
                        {variant.size} {variant.stockQuantity > 0 ? "" : "(Out of stock)"}
                    </span>
                ))}
            </div>
        </div>
    );

}

export default ProductDetail
