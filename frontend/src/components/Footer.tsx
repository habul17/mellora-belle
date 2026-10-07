import { Link } from "react-router-dom";
import { business, policyLinks } from "../lib/business";
import { containerClass, eyebrowClass } from "../lib/styles";
import { Logo } from "./Logo";

function Footer() {
    return (
        <footer className="mt-24 border-t border-stone bg-sand">
            <div className={`${containerClass} grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4`}>
                <div className="lg:col-span-2">
                    <Link to="/" className="inline-block"><Logo size="footer" /></Link>
                    <p className="mt-4 font-serif text-xl text-plum italic">{business.tagline}</p>
                    <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
                        Designer kurthis and co-ord sets from {business.city}, shipped across India.
                    </p>
                </div>

                <div>
                    <h2 className={`${eyebrowClass} mb-4 font-sans`}>Help</h2>
                    <ul className="space-y-2.5 text-sm">
                        {policyLinks.map((link) => (
                            <li key={link.to}>
                                <Link to={link.to} className="transition-colors hover:text-plum">{link.label}</Link>
                            </li>
                        ))}
                    </ul>
                </div>

                <div>
                    <h2 className={`${eyebrowClass} mb-4 font-sans`}>Get in touch</h2>
                    <ul className="space-y-2.5 text-sm">
                        <li><a href={`mailto:${business.email}`} className="break-all transition-colors hover:text-plum">{business.email}</a></li>
                        <li><a href={business.phoneHref} className="transition-colors hover:text-plum">{business.phone}</a></li>
                        <li className="text-muted">Payments secured by Razorpay</li>
                    </ul>
                </div>
            </div>

            <div className="border-t border-stone">
                <p className={`${containerClass} py-5 text-xs text-muted`}>
                    © {new Date().getFullYear()} {business.name}. Run by {business.legalName}.
                </p>
            </div>
        </footer>
    );
}

export default Footer
