import { useState, useEffect } from "react"
import { useParams } from "react-router-dom"

function ProductDetail() {  

    const {slug} = useParams();

    const [loading, setLoading] = useState(true);
    const [product, setProduct] = useState(null);
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
            {JSON.stringify(product)}
        </div>
    );

}

export default ProductDetail
