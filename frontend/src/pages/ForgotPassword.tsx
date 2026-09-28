import { useState } from "react"
import type { FormEvent } from "react"
import { Link } from "react-router-dom"
import { API } from "../lib/api"

function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [sent, setSent] = useState(false);
    const [message, setMessage] = useState("");
    const [submitting, setSubmitting] = useState(false);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        setMessage("");

        try {
            const response = await fetch(`${API}/forgot-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (data.error) {
                setMessage(data.error);
                return;
            }

            // The same answer whether or not the email has an account, so
            // this page can't be used to find out who shops here.
            setSent(true);
        } catch {
            setMessage("We couldn't reach the shop. Check your connection and try again.");
        } finally {
            setSubmitting(false);
        }
    }

    if (sent) {
        return (
            <main>
                <h1>Check your email</h1>
                <p>
                    If there's an account for {email}, we've sent it a link to reset your
                    password. The link works for 15 minutes.
                </p>
                <p>Nothing arrived? Check your spam folder, or <button onClick={() => setSent(false)}>try again</button>.</p>
                <p><Link to="/login">Back to log in</Link></p>
            </main>
        );
    }

    return (
        <main>
            <h1>Reset your password</h1>
            <p>Enter the email you signed up with and we'll send you a link to set a new password.</p>

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

                <button type="submit" disabled={submitting}>
                    {submitting ? "Sending…" : "Send reset link"}
                </button>
            </form>

            {message && <p role="alert">{message}</p>}

            <p><Link to="/login">Back to log in</Link></p>
        </main>
    );
}

export default ForgotPassword
