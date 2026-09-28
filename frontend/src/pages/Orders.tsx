import { useState, useEffect } from "react"
import { Link, Navigate } from "react-router-dom"
import { getToken, authFetch } from "../lib/api"
import { formatDate, itemsSummary } from "../lib/orders"
import type { OrderView } from "../lib/orders"
import { formatPrice } from "../lib/format"
import { sized } from "../lib/images"
import { usePageTitle } from "../lib/usePageTitle"
import { ButtonLink, Container, EmptyState, ErrorState, PageHeader, PageLoading } from "../components/ui"
import { ChevronRight } from "../components/icons"
import StatusBadge from "../components/StatusBadge"

function Orders() {
    usePageTitle("My orders");
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
            .catch(() => setError("We couldn't reach the shop. Check your connection and try again."));
    }, [token]);

    if (!token) {
        return <Navigate to="/login?from=/orders" replace />;
    }

    if (error) return <ErrorState message={error} />;
    if (!orders) return <PageLoading />;

    if (orders.length === 0) {
        return (
            <EmptyState title="No orders yet" action={<ButtonLink to="/shop">Start shopping</ButtonLink>}>
                <p>When you place an order, you can follow it here.</p>
            </EmptyState>
        );
    }

    return (
        <main>
            <Container className="max-w-4xl pt-12 sm:pt-16">
                <PageHeader title="My orders" />

                <ul className="space-y-4">
                    {orders.map((order) => (
                        <li key={order.id}>
                            <Link to={`/orders/${order.id}`}
                                className="flex items-center gap-4 border border-stone bg-white p-4 transition-colors hover:border-ink sm:gap-6 sm:p-5">
                                <div className="flex shrink-0 -space-x-6">
                                    {order.items.slice(0, 2).map((item) => item.image
                                        ? <img key={item.id} src={sized(item.image, 160)} alt="" className="aspect-[2/3] w-14 border-2 border-white bg-sand object-cover" />
                                        : <div key={item.id} className="aspect-[2/3] w-14 border-2 border-white bg-sand" />)}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                        <h2 className="font-serif text-xl">Order #{order.number}</h2>
                                        <StatusBadge order={order} />
                                    </div>
                                    <p className="mt-1 truncate text-sm text-muted">{itemsSummary(order)}</p>
                                    <p className="mt-1 text-sm">
                                        {formatDate(order.paidAt ?? order.createdAt)} · {formatPrice(order.totalAmount)}
                                    </p>
                                </div>
                                <ChevronRight className="shrink-0 text-muted" />
                            </Link>
                        </li>
                    ))}
                </ul>
            </Container>
        </main>
    );
}

export default Orders
