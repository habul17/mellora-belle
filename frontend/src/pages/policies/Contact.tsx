import { business } from "../../lib/business";
import GrievanceOfficer from "../../components/GrievanceOfficer";

function Contact() {
    return (
        <main>
            <h1>Contact Us</h1>
            <p>Questions about an order, a size or a return? We're happy to help.</p>

            <section>
                <h2>Reach us</h2>
                <p>
                    Email: <a href={`mailto:${business.email}`}>{business.email}</a><br />
                    Phone: <a href={business.phoneHref}>{business.phone}</a>
                </p>
                <p>Please include your order ID if your question is about an order.</p>
            </section>

            <section>
                <h2>Who we are</h2>
                <p>
                    {business.name} is run by {business.legalName}.<br />
                    {business.address || business.city}
                </p>
            </section>

            <GrievanceOfficer />
        </main>
    );
}

export default Contact
