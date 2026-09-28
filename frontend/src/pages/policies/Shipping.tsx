import { Link } from "react-router-dom";
import { business, shipping } from "../../lib/business";
import PolicyPage from "../../components/PolicyPage";

function Shipping() {
    return (
        <PolicyPage title="Shipping & Delivery">
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
                <p>
                    Shipping depends on where you are and how heavy your order is. We ship from
                    Coimbatore, so orders within Tamil Nadu cost less.
                </p>
                <table>
                    <thead>
                        <tr><th>Delivering to</th><th>Up to 1 kg</th><th>Each extra kg (or part of one)</th></tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Tamil Nadu and Puducherry</td>
                            <td>₹{shipping.rates.tamilNadu.firstKg}</td>
                            <td>₹{shipping.rates.tamilNadu.perExtraKg}</td>
                        </tr>
                        <tr>
                            <td>Rest of India</td>
                            <td>₹{shipping.rates.restOfIndia.firstKg}</td>
                            <td>₹{shipping.rates.restOfIndia.perExtraKg}</td>
                        </tr>
                    </tbody>
                </table>
                <p>
                    Your exact shipping charge is worked out from your pincode and shown at
                    checkout, before you pay.
                </p>
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
        </PolicyPage>
    );
}

export default Shipping
