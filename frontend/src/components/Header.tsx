import { useEffect, useState, useSyncExternalStore } from "react"
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom"
import { getToken, logOut, authFetchQuiet } from "../lib/api"
import { getGuestCart } from "../lib/guestCart"
import { onCartChange } from "../lib/cartCount"
import { containerClass } from "../lib/styles"
import { shipping } from "../lib/business"
import { BagIcon, CloseIcon, MenuIcon, UserIcon } from "./icons"

const guestCartCount = () => getGuestCart().reduce((sum, item) => sum + item.quantity, 0);

// Guests: counted from the browser. Logged in: asked from the server, again
// whenever something announces a cart change.
function useCartCount(loggedIn: boolean) {
    const guestCount = useSyncExternalStore(onCartChange, guestCartCount);
    const [serverCount, setServerCount] = useState<number | null>(null);

    useEffect(() => {
        if (!loggedIn) return;
        let live = true;

        const load = () => authFetchQuiet("/cart")
            .then((data) => {
                if (live && data?.cart) {
                    setServerCount(data.cart.items.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0));
                }
            })
            .catch(() => { /* the count just stays as it was */ });

        load();
        const stop = onCartChange(load);
        return () => { live = false; stop(); };
    }, [loggedIn]);

    return loggedIn ? serverCount ?? 0 : guestCount;
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `text-[13px] uppercase tracking-[0.16em] transition-colors hover:text-plum ${isActive ? "text-plum" : ""}`;

function Header() {
    // Re-renders the header on every page change, so it picks up a login or
    // logout that just happened.
    const location = useLocation();
    const navigate = useNavigate();
    const loggedIn = getToken() !== null;
    const count = useCartCount(loggedIn);
    const [menuOpen, setMenuOpen] = useState(false);
    const [menuPath, setMenuPath] = useState(location.pathname);

    // Close the mobile menu once a link in it has been followed.
    if (menuPath !== location.pathname) {
        setMenuPath(location.pathname);
        setMenuOpen(false);
    }

    async function handleLogOut() {
        setMenuOpen(false);
        await logOut();
        navigate("/");
    }

    return (
        <>
            <p className="bg-ink px-4 py-2 text-center text-[11px] tracking-[0.18em] text-ivory uppercase">
                Free shipping across India on {shipping.freeFromItems}+ items
            </p>

            <header className="sticky top-0 z-40 border-b border-stone bg-ivory/95 backdrop-blur">
                <div className={`${containerClass} grid h-16 grid-cols-[1fr_auto_1fr] items-center sm:h-20`}>
                    <div className="flex items-center gap-8">
                        <button type="button" className="-ml-2 p-2 lg:hidden" aria-label="Open menu"
                            aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
                            <MenuIcon />
                        </button>
                        <nav className="hidden items-center gap-8 lg:flex">
                            <NavLink to="/shop" className={navLinkClass}>Shop</NavLink>
                            <NavLink to="/contact" className={navLinkClass}>Contact</NavLink>
                        </nav>
                    </div>

                    <Link to="/" className="font-serif text-2xl tracking-[0.06em] sm:text-3xl">Mellora Belle</Link>

                    <div className="flex items-center justify-end gap-6">
                        <nav className="hidden items-center gap-6 lg:flex">
                            {loggedIn ? (
                                <>
                                    <NavLink to="/orders" className={navLinkClass}>My orders</NavLink>
                                    <button type="button" onClick={handleLogOut} className={navLinkClass({ isActive: false })}>
                                        Log out
                                    </button>
                                </>
                            ) : (
                                <NavLink to="/login" className={navLinkClass}>Log in</NavLink>
                            )}
                        </nav>
                        <Link to={loggedIn ? "/orders" : "/login"} className="p-1 lg:hidden"
                            aria-label={loggedIn ? "My orders" : "Log in"}>
                            <UserIcon />
                        </Link>
                        <Link to="/cart" className="relative -mr-1 p-1" aria-label={`Cart, ${count} ${count === 1 ? "item" : "items"}`}>
                            <BagIcon />
                            {count > 0 && (
                                <span className="absolute -top-0.5 -right-1 flex size-[18px] items-center justify-center rounded-full bg-plum text-[10px] font-medium text-ivory">
                                    {count > 99 ? "99+" : count}
                                </span>
                            )}
                        </Link>
                    </div>
                </div>
            </header>

            {menuOpen && (
                <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
                    <div className="absolute inset-0 bg-ink/40" onClick={() => setMenuOpen(false)} />
                    <nav className="absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col bg-ivory px-6 py-5 shadow-xl">
                        <div className="mb-8 flex items-center justify-between">
                            <span className="font-serif text-2xl">Mellora Belle</span>
                            <button type="button" className="-mr-2 p-2" aria-label="Close menu" onClick={() => setMenuOpen(false)}>
                                <CloseIcon />
                            </button>
                        </div>
                        <div className="flex flex-col gap-5 font-serif text-2xl">
                            <Link to="/">Home</Link>
                            <Link to="/shop">Shop all</Link>
                            <Link to="/cart">Cart{count > 0 && ` (${count})`}</Link>
                            {loggedIn && <Link to="/orders">My orders</Link>}
                            <Link to="/contact">Contact</Link>
                        </div>
                        <div className="mt-auto border-t border-stone pt-5 text-sm">
                            {loggedIn
                                ? <button type="button" onClick={handleLogOut} className="uppercase tracking-[0.16em]">Log out</button>
                                : <Link to="/login" className="uppercase tracking-[0.16em]">Log in</Link>}
                        </div>
                    </nav>
                </div>
            )}
        </>
    );
}

export default Header
