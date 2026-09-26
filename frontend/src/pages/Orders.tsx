import { useState, useEffect } from "react"
import { Link, Navigate } from "react-router-dom"
import { getToken, authFetch } from "../lib/api"
import { statusLabel, formatDate, itemsSummary } from "../lib/orders"
import type { OrderView } from "../lib/orders"

function Orders() {
    const token = getToken();

    const [orders, setOrders] = useState<OrderView[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!token) return;

        authFetch("/orders")
            .then((data) => {
                if (data.orders) setOrders(data.orders);
                else setError(data.error ?? "Could not load your orders");
            })
            .catch(() => setError("Could not reach the server"));
    }, [token]);

    if (!token) {
        return <Navigate to="/login?from=/orders" replace />;
    }

    if (error) return <div>{error}</div>;
    if (!orders) return <div>Loading...</div>;

    return (
        <main>
            <h1>My orders</h1>

            {orders.length === 0 && (
                <p>You haven't placed any orders yet. <Link to="/">Start shopping</Link></p>
            )}

            {orders.map((order) => (
                <section key={order.id}>
                    <h2><Link to={`/orders/${order.id}`}>Order #{order.number}</Link></h2>
                    <p>
                        {formatDate(order.paidAt ?? order.createdAt)} · {statusLabel(order)} · ₹{order.totalAmount}
                    </p>
                    <p>{itemsSummary(order)}</p>
                </section>
            ))}
        </main>
    );
}

export default Orders
