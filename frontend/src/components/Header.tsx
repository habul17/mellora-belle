import { Link, useLocation, useNavigate } from "react-router-dom"
import { getToken, logOut } from "../lib/api"

function Header() {
    // Not used directly: subscribing to the location re-renders the header on
    // every page change, so it picks up a login or logout that just happened.
    useLocation();
    const navigate = useNavigate();
    const loggedIn = getToken() !== null;

    async function handleLogOut() {
        await logOut();
        navigate("/");
    }

    return (
        <header>
            <nav>
                <Link to="/" style={{ marginRight: 16 }}>Mellora Belle</Link>
                <Link to="/cart" style={{ marginRight: 16 }}>Cart</Link>
                {loggedIn && <Link to="/orders" style={{ marginRight: 16 }}>My orders</Link>}
                {loggedIn
                    ? <button onClick={handleLogOut}>Log out</button>
                    : <Link to="/login">Log in</Link>}
            </nav>
        </header>
    );
}

export default Header
