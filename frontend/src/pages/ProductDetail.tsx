import { useState, useEffect } from "react"
import { useParams } from "react-router-dom"
import { addToGuestCart } from "../lib/guestCart"

function ProductDetail() {

    const { slug } = useParams();

    const [loading, setLoading] = useState(true);
    const [product, setProduct] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
    const [message, setMessage] = useState("");

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

    async function handleAddToCart() {
        if (!selectedVariantId) {
            setMessage("Please select a size");
            return;
        }

        const variant = product.variants.find((v: any) => v.id === selectedVariantId);
        const token = localStorage.getItem("accessToken");

        if (token) {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/cart/items`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify({ variantId: selectedVariantId, quantity: 1 }),
            });

            const data = await response.json();

            if (data.error) {
                setMessage(data.error);
                return;
            }
        } else {
            addToGuestCart({
                variantId: variant.id,
                quantity: 1,
                productName: product.name,
                image: product.images[0],
                price: variant.priceOverride ?? product.basePrice,
                size: variant.size,
                color: variant.color,
            });
        }

        setMessage("Added to cart");
    }

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
                    <button
                        key={variant.id}
                        disabled={variant.stockQuantity === 0}
                        onClick={() => setSelectedVariantId(variant.id)}
                        style={{
                            marginRight: 8,
                            fontWeight: selectedVariantId === variant.id ? "bold" : "normal",
                        }}
                    >
                        {variant.size} {variant.stockQuantity === 0 ? "(Out of stock)" : ""}
                    </button>
                ))}
            </div>
            <div>
                <button onClick={handleAddToCart}>Add to Cart</button>
                {message && <p>{message}</p>}
            </div>
        </div>
    );

}

export default ProductDetail
