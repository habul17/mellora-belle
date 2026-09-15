import { useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { getGuestCart, saveGuestCart } from "../lib/guestCart"
import type { GuestCartItem } from "../lib/guestCart"

function Login() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const redirectTo = searchParams.get("from") ?? "/";
    const sessionExpired = searchParams.get("expired") === "1";
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [totpCode, setTotpCode] = useState("");
    const [needs2FA, setNeeds2FA] = useState(false);
    const [message, setMessage] = useState("");


    async function handleSubmit() {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, totpCode }),
        });

        const data = await response.json();

        if (data.error === "2FA code required") {
            setNeeds2FA(true);
            return;
        }

        if (data.error) {
            setMessage(data.error);
            return;
        }

        localStorage.setItem("accessToken", data.accessToken);
        await mergeGuestCart(data.accessToken);
        navigate(redirectTo);
    }

    async function mergeGuestCart(token: string) {
        const guestItems = getGuestCart();
        if (guestItems.length === 0) return;

        const failed: GuestCartItem[] = [];

        for (const item of guestItems) {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/cart/items`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify({ variantId: item.variantId, quantity: item.quantity }),
            });

            const data = await response.json();

            if (data.error) {
                failed.push(item);
            }
        }

        saveGuestCart(failed);
    }

    return (
        <div>
            <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
            />
            <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
            />
            <button onClick={handleSubmit}>Log In</button>

            {sessionExpired && !message && <p>Your session expired. Please log in again.</p>}
            {message && <p>{message}</p>}

            {needs2FA && (
                <input
                    type="text"
                    placeholder="2FA Code"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                />
            )}
        </div>
    );
}

export default Login