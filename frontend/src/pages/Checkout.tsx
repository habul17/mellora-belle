import { useState } from "react"
import { Link, Navigate } from "react-router-dom"
import { getToken, authFetch } from "../lib/api"
import { loadRazorpay } from "../lib/razorpay"

type Order = {
    id: string;
    totalAmount: number;
    status: string;
    reservedUntil: string;
    fullName: string;
    phone: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    pincode: string;
};

function Checkout() {
    const token = getToken();

    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");
    const [addressLine1, setAddressLine1] = useState("");
    const [addressLine2, setAddressLine2] = useState("");
    const [city, setCity] = useState("");
    const [state, setState] = useState("");
    const [pincode, setPincode] = useState("");

    const [order, setOrder] = useState<Order | null>(null);
    const [message, setMessage] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [paying, setPaying] = useState(false);
    const [paymentDone, setPaymentDone] = useState(false);

    if (!token) {
        return <Navigate to="/login?from=/checkout" replace />;
    }

    async function handleSubmit() {
        setSubmitting(true);
        setMessage("");

        const data = await authFetch("/checkout", {
            method: "POST",
            body: JSON.stringify({
                fullName, phone, addressLine1, addressLine2, city, state, pincode
            }),
        });

        setSubmitting(false);

        if (data.error) {
            setMessage(data.error);
            return;
        }

        setOrder(data.order);
    }

    async function handlePay() {
        if (!order) return;

        setPaying(true);
        setMessage("");

        const loaded = await loadRazorpay();

        if (!loaded) {
            setPaying(false);
            setMessage("Couldn't open the payment window. Check your connection, turn off any ad blocker, and try again.");
            return;
        }

        const data = await authFetch(`/orders/${order.id}/payment`, { method: "POST" });

        if (data.error) {
            setPaying(false);
            setMessage(data.error);
            return;
        }

        const razorpay = new (window as any).Razorpay({
            key: data.keyId,
            order_id: data.razorpayOrderId,
            amount: data.amount,
            currency: "INR",
            name: "Mellora Belle",
            description: `Order ${order.id}`,
            prefill: { name: order.fullName, contact: order.phone },
            // Close the window when the stock hold runs out, so nobody pays for
            // items that have already been released to other customers.
            timeout: data.expiresInSeconds,
            handler: () => {
                setPaying(false);
                setPaymentDone(true);
            },
            modal: {
                ondismiss: () => setPaying(false),
            },
        });

        razorpay.open();
    }

    if (order && paymentDone) {
        return (
            <div>
                <h1>Thank you!</h1>
                <p>Your payment went through. We're confirming it now.</p>
                <p>Order id: {order.id}</p>
                <p><Link to="/">Continue shopping</Link></p>
            </div>
        );
    }

    if (order) {
        return (
            <div>
                <h1>Review and pay</h1>
                <p>Order id: {order.id}</p>
                <p>Status: {order.status}</p>
                <p>Total: Rs {order.totalAmount}</p>
                <p>
                    Shipping to: {order.fullName}, {order.addressLine1}
                    {order.addressLine2 ? `, ${order.addressLine2}` : ""}, {order.city},{" "}
                    {order.state} - {order.pincode}
                </p>
                <p>Stock held until {new Date(order.reservedUntil).toLocaleTimeString()}</p>

                <button onClick={handlePay} disabled={paying}>
                    {paying ? "Opening payment..." : `Pay Rs ${order.totalAmount}`}
                </button>

                {message && <p>{message}</p>}
            </div>
        );
    }

    return (
        <div>
            <h1>Shipping address</h1>

            <input placeholder="Full name" value={fullName}
                onChange={(e) => setFullName(e.target.value)} />
            <input placeholder="Phone (10 digits)" value={phone}
                onChange={(e) => setPhone(e.target.value)} />
            <input placeholder="Address line 1" value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)} />
            <input placeholder="Address line 2 (optional)" value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)} />
            <input placeholder="City" value={city}
                onChange={(e) => setCity(e.target.value)} />
            <input placeholder="State" value={state}
                onChange={(e) => setState(e.target.value)} />
            <input placeholder="Pincode" value={pincode}
                onChange={(e) => setPincode(e.target.value)} />

            <button onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Placing order..." : "Place order"}
            </button>

            {message && <p>{message}</p>}

            <p><Link to="/cart">Back to cart</Link></p>
        </div>
    );
}

export default Checkout
