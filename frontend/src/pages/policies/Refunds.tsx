import { Link } from "react-router-dom";
import { business, returns } from "../../lib/business";
import PolicyPage from "../../components/PolicyPage";

function Refunds() {
    return (
        <PolicyPage title="Cancellation & Refunds">
            <h1>Cancellation &amp; Refunds</h1>
            <p>Last updated: {business.policiesUpdated}</p>

            <section>
                <h2>Cancelling an order</h2>
                <p>
                    You can cancel an order within {returns.cancelWindow} of placing it, as long as
                    it hasn't shipped. Use the Cancel button on the order in{" "}
                    <Link to="/orders">My orders</Link>, or email us
                    at <a href={`mailto:${business.email}`}>{business.email}</a> or
                    call <a href={business.phoneHref}>{business.phone}</a> with your order number.
                    We'll refund the full amount. There is no cancellation charge.
                </p>
                <p>
                    After {returns.cancelWindow}, your order may already be packed, so it can't be
                    cancelled.
                </p>
            </section>

            <section>
                <h2>If we cancel your order</h2>
                <p>
                    If an item becomes unavailable after you've paid, or we can't deliver to your
                    address, we'll cancel the order and refund the full amount.
                </p>
            </section>

            <section>
                <h2>Returns</h2>
                <p>
                    We don't accept returns or exchanges if you change your mind or order the wrong
                    size. If you're not sure of your size, contact us before you order and we'll help.
                </p>
                <p>
                    We do take back items that are damaged or defective, different from their
                    description, or not what you ordered (the wrong item or size). Tell us
                    within {returns.returnWindowDays} days of delivery:
                </p>
                <ul>
                    <li>
                        Use the Return button on the order in <Link to="/orders">My orders</Link>, or
                        contact us with your order number.
                    </li>
                    <li>
                        Email photos of the problem, or an unboxing video,
                        to <a href={`mailto:${business.email}`}>{business.email}</a>.
                    </li>
                    <li>
                        Keep the item unworn and unwashed, with its tags and packaging.
                    </li>
                </ul>
                <p>
                    We'll arrange the return and pay its shipping. Once it's back with us, we'll send
                    you a replacement, or a full refund if that item is out of stock.
                </p>
            </section>

            <section>
                <h2>Refunds</h2>
                <p>
                    When we refund a return, the money goes back to your original payment method
                    within {returns.refundDays} of us receiving and checking the item. For a cancelled order,
                    the refund starts as soon as it's cancelled. Your bank may take a few extra
                    days to show it.
                </p>
                <p>
                    If a returned item has been worn or washed, or doesn't have the problem
                    reported, we can't accept the return. We'll contact you to arrange sending it back.
                </p>
            </section>
        </PolicyPage>
    );
}

export default Refunds
