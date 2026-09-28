import { useState } from "react"
import type { FormEvent } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { API, clearToken } from "../lib/api"

function ResetPassword() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get("token");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [done, setDone] = useState(false);
    const [linkDead, setLinkDead] = useState(false);
    const [message, setMessage] = useState("");
    const [submitting, setSubmitting] = useState(false);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setMessage("");

        if (password !== confirm) {
            setMessage("The two passwords don't match.");
            return;
        }

        setSubmitting(true);

        try {
            const response = await fetch(`${API}/reset-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, newPassword: password }),
            });

            const data = await response.json();

            if (data.error === "Invalid or expired token") {
                setLinkDead(true);
                return;
            }

            if (data.error) {
                setMessage(data.error);
                return;
            }

            // The reset logged this account out everywhere. Drop any login
            // this browser still holds so it doesn't linger for 15 minutes.
            clearToken();
            setDone(true);
        } catch {
            setMessage("We couldn't reach the shop. Check your connection and try again.");
        } finally {
            setSubmitting(false);
        }
    }

    if (!token || linkDead) {
        return (
            <main>
                <h1>This link doesn't work</h1>
                <p>
                    Reset links work once, for 15 minutes. This one has expired, was already
                    used, or was copied incompletely.
                </p>
                <p><Link to="/forgot-password">Send me a new link</Link></p>
            </main>
        );
    }

    if (done) {
        return (
            <main>
                <h1>Password changed</h1>
                <p>You can now log in with your new password.</p>
                <p><Link to="/login">Log in</Link></p>
            </main>
        );
    }

    return (
        <main>
            <h1>Choose a new password</h1>

            <form onSubmit={handleSubmit}>
                <p>
                    <label>
                        New password
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
                <p>
                    <label>
                        Type it again
                        <input
                            type="password"
                            autoComplete="new-password"
                            required
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                        />
                    </label>
                </p>
                <p>At least 8 characters.</p>

                <button type="submit" disabled={submitting}>
                    {submitting ? "Saving…" : "Save new password"}
                </button>
            </form>

            {message && <p role="alert">{message}</p>}
        </main>
    );
}

export default ResetPassword
