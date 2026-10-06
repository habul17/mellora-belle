import { Link } from "react-router-dom";
import { business, shipping } from "../../lib/business";
import PolicyPage from "../../components/PolicyPage";

function Pricing() {
    return (
        <PolicyPage title="Pricing">
            <h1>Pricing</h1>
            <p>Last updated: {business.policiesUpdated}</p>

            <section>
                <h2>Prices</h2>
                <p>
                    All prices are in Indian Rupees (₹) and are shown on each product's page.
                    See our full range on the <Link to="/shop">shop page</Link>.
                </p>
                <p>
                    When a product shows a struck-out price next to its price, the struck-out
                    amount is its original price and the other is what you pay.
                </p>
                <p>
                    {business.name} is not registered under GST, so no GST is added to the prices
                    you see.
                </p>
            </section>

            <section>
                <h2>What you pay</h2>
                <p>
                    You pay the product price plus shipping. Orders of {shipping.freeFromItems} or
                    more items ship free; for a single item, shipping depends on your pincode
                    (see <Link to="/shipping">Shipping &amp; Delivery</Link>).
                    Your checkout page shows the full total before you pay. There are no hidden
                    charges.
                </p>
                <p>
                    Prices can change over time. You always pay the price shown when you place
                    your order.
                </p>
            </section>

            <section>
                <h2>How to pay</h2>
                <p>
                    All orders are paid online at checkout through Razorpay, using a debit or
                    credit card, net banking, a wallet or any other method Razorpay offers
                    there. We don't offer cash on delivery yet.
                </p>
            </section>
        </PolicyPage>
    );
}

export default Pricing
