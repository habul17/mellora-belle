import { useState } from "react"
import type { FormEvent } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { API } from "../lib/api"
import { finishLogin, safeRedirect, withFrom } from "../lib/account"

function Signup() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const from = searchParams.get("from");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState("");
    const [submitting, setSubmitting] = useState(false);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        setMessage("");

        try {
            const response = await fetch(`${API}/signup`, {
                method: "POST",
                // Signing up also logs in, which sets the refresh cookie.
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (data.error) {
                setMessage(data.error);
                return;
            }

            await finishLogin(data.accessToken);
            navigate(safeRedirect(from));
        } catch {
            setMessage("We couldn't reach the shop. Check your connection and try again.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <main>
            <h1>Create an account</h1>
            <p>You'll need one to place an order and track it.</p>

            <form onSubmit={handleSubmit}>
                <p>
                    <label>
                        Email
                        <input
                            type="email"
                            autoComplete="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </label>
                </p>
                <p>
                    <label>
                        Password
                        <input
                            type="password"
                            autoComplete="new-password"
                            required
                            minLength={8}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </label>
                </p>
                <p>At least 8 characters.</p>

                <button type="submit" disabled={submitting}>
                    {submitting ? "Creating your account…" : "Create account"}
                </button>
            </form>

            {message && <p role="alert">{message}</p>}

            <p>Already have an account? <Link to={withFrom("/login", from)}>Log in</Link></p>
        </main>
    );
}

export default Signup
