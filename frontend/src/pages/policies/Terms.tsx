import { Link } from "react-router-dom";
import { business } from "../../lib/business";
import GrievanceOfficer from "../../components/GrievanceOfficer";

function Terms() {
    return (
        <main>
            <h1>Terms &amp; Conditions</h1>
            <p>Last updated: {business.policiesUpdated}</p>

            <section>
                <h2>About us</h2>
                <p>
                    This website is run by {business.legalName}, trading as {business.name},
                    based in {business.city}, India. By using this website or placing an order,
                    you agree to these terms.
                </p>
            </section>

            <section>
                <h2>Who can order</h2>
                <p>
                    You must be at least 18 years old to place an order, or be using the site
                    with a parent or guardian's permission.
                </p>
            </section>

            <section>
                <h2>Your account</h2>
                <p>
                    Please give accurate details and keep your password to yourself. You're
                    responsible for orders placed from your account.
                </p>
            </section>

            <section>
                <h2>Products</h2>
                <p>
                    We try to show every product's colour and details as accurately as we can,
                    but colours can look slightly different depending on your screen and lighting.
                </p>
            </section>

            <section>
                <h2>Orders and payment</h2>
                <p>
                    Prices and payment methods are explained on our <Link to="/pricing">Pricing</Link> page.
                    Your order is confirmed only once your payment is confirmed.
                </p>
                <p>
                    When you go to pay, we hold your items for a short time. If the payment isn't
                    completed in that time, the order is cancelled automatically. If money is
                    taken after that and the item has sold out, we refund it in full.
                </p>
                <p>
                    We may cancel an order if an item is out of stock, a price was shown wrongly,
                    or the order looks fraudulent. If you've already paid, we refund you in full.
                </p>
            </section>

            <section>
                <h2>Shipping, cancellations and returns</h2>
                <p>
                    See our <Link to="/shipping">Shipping &amp; Delivery</Link> and{" "}
                    <Link to="/refunds">Cancellation &amp; Refunds</Link> policies.
                </p>
            </section>

            <section>
                <h2>Using this website</h2>
                <p>
                    Please don't misuse the website: no unlawful use, and no attempts to break,
                    overload or gain unauthorised access to it.
                </p>
                <p>
                    The photos, text and designs on this website belong to {business.name}. Please
                    don't copy or reuse them without our written permission.
                </p>
            </section>

            <section>
                <h2>Our responsibility</h2>
                <p>
                    As far as the law allows, our responsibility for any order is limited to the
                    amount you paid for it. Nothing in these terms takes away your rights under
                    the Consumer Protection Act, 2019.
                </p>
            </section>

            <section>
                <h2>Governing law</h2>
                <p>
                    These terms are governed by the laws of India. Subject to your rights as a
                    consumer, any dispute will be handled by the courts in {business.jurisdiction}.
                </p>
            </section>

            <section>
                <h2>Changes to these terms</h2>
                <p>
                    We may update these terms from time to time. The date at the top shows when
                    they last changed. The terms in place when you placed an order apply to that order.
                </p>
            </section>

            <GrievanceOfficer />
        </main>
    );
}

export default Terms
