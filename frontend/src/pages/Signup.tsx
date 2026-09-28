import { useState } from "react"
import type { FormEvent } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { API } from "../lib/api"
import { finishLogin, safeRedirect, withFrom } from "../lib/account"
import AccountShell from "../components/AccountShell"
import { Button, Field, Notice } from "../components/ui"
import { inputClass, linkClass } from "../lib/styles"
import { usePageTitle } from "../lib/usePageTitle"

function Signup() {
    usePageTitle("Create an account");
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
        <AccountShell title="Create an account" intro={<p>You'll need one to place an order and track it.</p>}>
            <form onSubmit={handleSubmit} className="space-y-5">
                <Field label="Email">
                    <input type="email" autoComplete="email" required className={inputClass}
                        value={email} onChange={(e) => setEmail(e.target.value)} />
                </Field>
                <Field label="Password" hint="At least 8 characters.">
                    <input type="password" autoComplete="new-password" required minLength={8} className={inputClass}
                        value={password} onChange={(e) => setPassword(e.target.value)} />
                </Field>

                {message && <Notice tone="error">{message}</Notice>}

                <Button type="submit" disabled={submitting} className="w-full">
                    {submitting ? "Creating your account…" : "Create account"}
                </Button>
                <p className="text-center text-xs text-muted">
                    By creating an account you agree to our <Link to="/terms" className={linkClass}>terms</Link> and <Link to="/privacy" className={linkClass}>privacy policy</Link>.
                </p>
            </form>

            <p className="border-t border-stone pt-6 text-center text-sm text-muted">
                Already have an account? <Link to={withFrom("/login", from)} className={`text-ink ${linkClass}`}>Log in</Link>
            </p>
        </AccountShell>
    );
}

export default Signup
