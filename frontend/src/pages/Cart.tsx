import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { getGuestCart, updateGuestCartItem, removeFromGuestCart } from "../lib/guestCart"
import { getToken, authFetch } from "../lib/api"

type CartLine = {
    id: string;
    variantId: string;
    quantity: number;
    productName: string;
    image: string;
    price: number;
    size: string;
    color: string;
};

function Cart() {
    const [lines, setLines] = useState<CartLine[]>([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState("");


    async function loadCart() {
        if (getToken()) {
            const data = await authFetch("/cart");

            setLines(
                data.cart.items.map((item: any) => ({
                    id: item.id,
                    variantId: item.variantId,
                    quantity: item.quantity,
                    productName: item.variant.product.name,
                    image: item.variant.product.images[0],
                    price: item.variant.priceOverride ?? item.variant.product.basePrice,
                    size: item.variant.size,
                    color: item.variant.color,
                }))
            );
        } else {
            const guestItems = getGuestCart();

            setLines(
                guestItems.map((item) => ({
                    id: item.variantId,
                    variantId: item.variantId,
                    quantity: item.quantity,
                    productName: item.productName,
                    image: item.image,
                    price: item.price,
                    size: item.size,
                    color: item.color,
                }))
            );
        }

        setLoading(false);
    }

    async function changeQuantity(line: CartLine, newQuantity: number) {
        if (newQuantity < 1) return;

        if (getToken()) {
            const data = await authFetch(`/cart/items/${line.id}`, {
                method: "PATCH",
                body: JSON.stringify({ quantity: newQuantity }),
            });

            if (data.error) {
                setMessage(data.error);
                return;
            }
        } else {
            updateGuestCartItem(line.variantId, newQuantity);
        }

        setMessage("");
        loadCart();
    }

    async function removeLine(line: CartLine) {
        if (getToken()) {
            await authFetch(`/cart/items/${line.id}`, { method: "DELETE" });
        } else {
            removeFromGuestCart(line.variantId);
        }

        setMessage("");
        loadCart();
    }

    useEffect(() => {
        loadCart();
    }, []);

    if (loading) return <div>Loading...</div>;

    if (lines.length === 0) return <div>Your cart is empty</div>;

    const total = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);

    return (
        <div>
            <h1>Your Cart</h1>
            {message && <p>{message}</p>}
            {lines.map((line) => (
                <div key={line.id}>
                    <img src={line.image} alt={line.productName} width={100} />
                    <p>{line.productName}</p>
                    <p>{line.size} / {line.color}</p>
                    <p>₹{line.price}</p>
                    <div>
                        <button onClick={() => changeQuantity(line, line.quantity - 1)}>-</button>
                        <span style={{ margin: "0 8px" }}>{line.quantity}</span>
                        <button onClick={() => changeQuantity(line, line.quantity + 1)}>+</button>
                    </div>
                    <p>₹{line.price * line.quantity}</p>
                    <button onClick={() => removeLine(line)}>Remove</button>
                </div>
            ))}
            <h2>Total: ₹{total}</h2>
            <Link to="/checkout">Proceed to Checkout</Link>
        </div>
    );
}

export default Cart