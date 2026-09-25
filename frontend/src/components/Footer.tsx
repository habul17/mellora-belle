import { Link } from "react-router-dom";
import { business, policyLinks } from "../lib/business";

function Footer() {
    return (
        <footer>
            <nav>
                {policyLinks.map((link) => (
                    <Link key={link.to} to={link.to} style={{ marginRight: 16 }}>
                        {link.label}
                    </Link>
                ))}
            </nav>
            <p>
                <a href={`mailto:${business.email}`}>{business.email}</a> · <a href={business.phoneHref}>{business.phone}</a>
            </p>
            <p>© {new Date().getFullYear()} {business.name}</p>
        </footer>
    );
}

export default Footer
