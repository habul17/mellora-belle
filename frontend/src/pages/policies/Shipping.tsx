import { Link } from "react-router-dom";
import { business, shipping } from "../../lib/business";

function Shipping() {
    return (
        <main>
            <h1>Shipping &amp; Delivery</h1>
            <p>Last updated: {business.policiesUpdated}</p>

            <section>
                <h2>Where we ship</h2>
                <p>
                    We ship to addresses across India. We can't deliver to APO/FPO (military)
                    addresses or outside India yet.
                </p>
            </section>

            <section>
                <h2>How long it takes</h2>
                <p>
                    We dispatch your order within {shipping.dispatchDays} of your payment being
                    confirmed. Once dispatched, it usually reaches you within {shipping.deliveryDays},
                    depending on your location.
                </p>
                <p>
                    Remote areas, public holidays, bad weather or courier delays can occasionally
                    make it take longer. If your order is running late, contact us and we'll chase it.
                </p>
            </section>

            <section>
                <h2>Shipping charges</h2>
                <p>Shipping charges, if any, are shown at checkout before you pay.</p>
            </section>

            <section>
                <h2>Tracking</h2>
                <p>Once your order ships, we'll share the courier's tracking details with you.</p>
            </section>

            <section>
                <h2>Your address</h2>
                <p>
                    Please check your address, pincode and phone number carefully at checkout.
                    If something is wrong, contact us as soon as possible. We can only change it
                    before the order is dispatched.
                </p>
            </section>

            <section>
                <h2>Damaged or wrong item</h2>
                <p>
                    If your parcel arrives damaged or you receive the wrong item, see
                    our <Link to="/refunds">Cancellation &amp; Refunds</Link> policy. We'll cover the
                    return shipping.
                </p>
            </section>

            <p>
                Questions? Email <a href={`mailto:${business.email}`}>{business.email}</a> or
                call <a href={business.phoneHref}>{business.phone}</a>.
            </p>
        </main>
    );
}

export default Shipping
