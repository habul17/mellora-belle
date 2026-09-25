import { business, returns } from "../../lib/business";

function Refunds() {
    return (
        <main>
            <h1>Cancellation &amp; Refunds</h1>
            <p>Last updated: {business.policiesUpdated}</p>

            <section>
                <h2>Cancelling an order</h2>
                <p>
                    You can cancel an order within {returns.cancelWindow} of placing it. Email us
                    at <a href={`mailto:${business.email}`}>{business.email}</a> or
                    call <a href={business.phoneHref}>{business.phone}</a> with your order ID.
                    We'll refund the full amount. There is no cancellation charge.
                </p>
                <p>
                    After {returns.cancelWindow}, your order may already be packed, so it can't be
                    cancelled. You can return it after delivery instead (see below).
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
                    You can return an item within {returns.returnWindowDays} days of delivery. It
                    must be unworn and unwashed, with its original tags still attached.
                </p>
                <p>To start a return, contact us with your order ID within those {returns.returnWindowDays} days.</p>
                <ul>
                    <li>
                        <strong>Damaged, defective or wrong item:</strong> send us a photo when you
                        contact us. We'll arrange the return and pay the return shipping.
                    </li>
                    <li>
                        <strong>Changed your mind (including size):</strong> you send the item back
                        to us and pay the return shipping.
                    </li>
                </ul>
                <p>
                    We don't offer direct exchanges yet. To get a different size, return the item
                    for a refund and place a new order.
                </p>
            </section>

            <section>
                <h2>Refunds</h2>
                <p>
                    Once we receive and check the returned item, we refund the amount to your
                    original payment method within {returns.refundDays}. For a cancelled order,
                    the refund starts as soon as it's cancelled. Your bank may take a few extra
                    days to show it.
                </p>
                <p>
                    If a returned item isn't unworn, unwashed and tagged, we can't accept the
                    return. We'll contact you to arrange sending it back.
                </p>
            </section>
        </main>
    );
}

export default Refunds
