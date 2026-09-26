import { useState, useEffect } from "react"
import { Link, Navigate, useParams } from "react-router-dom"
import { getToken, authFetch } from "../lib/api"
import { ORDER_STEPS, statusLabel, formatDate } from "../lib/orders"
import type { OrderView } from "../lib/orders"

function OrderDetail() {
    const token = getToken();
    const { id } = useParams();

    const [order, setOrder] = useState<OrderView | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!token || !id) return;

        authFetch(`/orders/${id}`)
            .then((data) => {
                if (data.order) setOrder(data.order);
                else setError(data.error === "Order not found" ? "We couldn't find that order." : data.error ?? "Could not load this order");
            })
            .catch(() => setError("Could not reach the server"));
    }, [token, id]);

    if (!token) {
        return <Navigate to={`/login?from=/orders/${id}`} replace />;
    }

    if (error) return <div>{error} <Link to="/orders">See all your orders</Link></div>;
    if (!order) return <div>Loading...</div>;

    const reachedIndex = ORDER_STEPS.findIndex((step) => step.status === order.status);
    const shipped = order.status === "SHIPPED" || order.status === "DELIVERED";

    return (
        <main>
            <p><Link to="/orders">← All orders</Link></p>
            <h1>Order #{order.number}</h1>
            <p>Placed on {formatDate(order.paidAt ?? order.createdAt)}</p>
            <p><strong>{statusLabel(order)}</strong></p>

            {order.refundNeeded && (
                <p>
                    Sorry, this item sold out before your payment reached us. Your full payment
                    of ₹{order.totalAmount} will be refunded to your original payment method
                    within 5-7 working days.
                </p>
            )}

            {reachedIndex >= 0 && (
                <ol>
                    {ORDER_STEPS.map((step, index) => (
                        <li key={step.status}>
                            {index <= reachedIndex ? "✓" : "○"} {step.label}
                        </li>
                    ))}
                </ol>
            )}

            {shipped && (
                <section>
                    <h2>Tracking</h2>
                    <p>
                        Courier: {order.courierName}<br />
                        Tracking number: {order.trackingNumber}
                        {order.shippedAt && <><br />Shipped on {formatDate(order.shippedAt)}</>}
                        {order.deliveredAt && <><br />Delivered on {formatDate(order.deliveredAt)}</>}
                    </p>
                    {order.trackingUrl && (
                        <p><a href={order.trackingUrl} target="_blank" rel="noreferrer">Track your parcel</a></p>
                    )}
                </section>
            )}

            <section>
                <h2>Items</h2>
                {order.items.map((item) => (
                    <div key={item.id}>
                        {item.image && <img src={item.image} alt={item.productName} width={80} />}
                        <p>
                            <Link to={`/products/${item.slug}`}>{item.productName}</Link><br />
                            Size {item.size} × {item.quantity} · ₹{item.price * item.quantity}
                        </p>
                    </div>
                ))}
                <p><strong>Total paid: ₹{order.totalAmount}</strong></p>
            </section>

            <section>
                <h2>Delivering to</h2>
                <p>
                    {order.address.fullName}<br />
                    {order.address.addressLine1}<br />
                    {order.address.addressLine2 && <>{order.address.addressLine2}<br /></>}
                    {order.address.city}, {order.address.state} {order.address.pincode}<br />
                    Phone: {order.address.phone}
                </p>
            </section>

            <p>
                Need help with this order? <Link to="/contact">Contact us</Link> and mention
                order #{order.number}.
            </p>
        </main>
    );
}

export default OrderDetail
