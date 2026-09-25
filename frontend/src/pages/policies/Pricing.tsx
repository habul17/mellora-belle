import { Link } from "react-router-dom";
import { business } from "../../lib/business";

function Pricing() {
    return (
        <main>
            <h1>Pricing</h1>
            <p>Last updated: {business.policiesUpdated}</p>

            <section>
                <h2>Prices</h2>
                <p>
                    All prices are in Indian Rupees (₹) and are shown on each product's page.
                    See our full range on the <Link to="/">shop page</Link>.
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
                    You pay the product price plus shipping charges, if any. Your checkout page
                    shows the full total before you pay. There are no hidden charges.
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
        </main>
    );
}

export default Pricing
