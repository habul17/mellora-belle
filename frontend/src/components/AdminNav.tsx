import { NavLink } from "react-router-dom"

const LINKS = [
    { to: "/admin", label: "Stock" },
    { to: "/admin/orders", label: "Orders" },
    { to: "/admin/security", label: "Security" },
];

// The admin pages' own menu (they aren't linked from the shop).
function AdminNav() {
    return (
        <p>
            {LINKS.map((link, i) => (
                <span key={link.to}>
                    {i > 0 && " · "}
                    <NavLink to={link.to} end style={({ isActive }) => (isActive ? { fontWeight: 600, textDecoration: "none", color: "inherit" } : undefined)}>
                        {link.label}
                    </NavLink>
                </span>
            ))}
        </p>
    );
}

export default AdminNav
