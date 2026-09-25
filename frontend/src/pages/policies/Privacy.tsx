import { business } from "../../lib/business";
import GrievanceOfficer from "../../components/GrievanceOfficer";

function Privacy() {
    return (
        <main>
            <h1>Privacy Policy</h1>
            <p>Last updated: {business.policiesUpdated}</p>
            <p>
                This policy explains what personal data {business.name} ({business.legalName})
                collects, why, and what you can ask us to do with it.
            </p>

            <section>
                <h2>What we collect</h2>
                <ul>
                    <li>
                        <strong>Your account:</strong> your email address and password. We store
                        only a scrambled (hashed) version of your password, never the password itself.
                    </li>
                    <li>
                        <strong>Your orders:</strong> your name, phone number and delivery address,
                        and what you ordered.
                    </li>
                    <li>
                        <strong>Your payments:</strong> payments are handled by Razorpay. They tell
                        us whether a payment succeeded and share limited details such as the payment
                        method. We never see or store your full card number, CVV or banking passwords.
                    </li>
                </ul>
            </section>

            <section>
                <h2>Why we use it</h2>
                <p>
                    To process and deliver your orders, contact you about them, handle
                    cancellations, returns and refunds, prevent fraud, and keep the records the
                    law requires.
                </p>
            </section>

            <section>
                <h2>Who we share it with</h2>
                <ul>
                    <li>Razorpay, to take your payment.</li>
                    <li>Courier partners, who need your name, phone number and address to deliver your order.</li>
                    <li>The service providers that host our website and database and send our emails.</li>
                    <li>Government authorities, only when the law requires it.</li>
                </ul>
                <p>We never sell your personal data.</p>
            </section>

            <section>
                <h2>Your browser</h2>
                <p>
                    We store your sign-in and your cart in your browser's local storage so you
                    stay signed in and don't lose your cart. We don't use advertising or tracking
                    cookies. Razorpay's payment window may use its own cookies when you pay.
                </p>
            </section>

            <section>
                <h2>How long we keep it</h2>
                <p>
                    We keep your account details while your account exists. We keep order and
                    payment records for as long as tax and accounting laws require.
                </p>
            </section>

            <section>
                <h2>Your rights</h2>
                <p>
                    You can ask us to show you the personal data we hold about you, correct it, or
                    delete your account. We'll delete everything except records the law requires
                    us to keep. Email <a href={`mailto:${business.email}`}>{business.email}</a> to
                    ask.
                </p>
            </section>

            <section>
                <h2>Keeping it safe</h2>
                <p>
                    Our website uses an encrypted (HTTPS) connection, and access to your data is
                    limited to what's needed to run the store.
                </p>
            </section>

            <section>
                <h2>Changes to this policy</h2>
                <p>
                    If we change this policy, we'll update the date at the top of this page.
                </p>
            </section>

            <GrievanceOfficer />
        </main>
    );
}

export default Privacy
