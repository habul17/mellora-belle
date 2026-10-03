import { useState } from "react"
import type { FormEvent } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { API } from "../lib/api"
import { finishLogin, safeRedirect } from "../lib/account"
import AccountShell from "../components/AccountShell"
import { Button, Field, Notice } from "../components/ui"
import { inputClass, linkClass } from "../lib/styles"
import { usePageTitle } from "../lib/usePageTitle"

// The shop admin's login: email, password and (once it's on) the code from the
// authenticator app. Customers log in on /login with an emailed code instead.
function AdminLogin() {
    usePageTitle("Admin log in");
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const from = searchParams.get("from");
    const sessionExpired = searchParams.get("expired") === "1";
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [totpCode, setTotpCode] = useState("");
    const [needs2FA, setNeeds2FA] = useState(false);
    const [message, setMessage] = useState("");
    const [submitting, setSubmitting] = useState(false);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        setMessage("");

        try {
            const response = await fetch(`${API}/login`, {
                method: "POST",
                // Lets the browser keep the refresh cookie the login sets.
                credentials: "include",
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

            await finishLogin(data.accessToken);
            navigate(from ? safeRedirect(from) : "/admin");
        } catch {
            setMessage("We couldn't reach the shop. Check your connection and try again.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <AccountShell title="Admin log in" intro={<p>For the shop's admin. Customers <Link to="/login" className={linkClass}>log in here</Link>.</p>}>
            {sessionExpired && !message && <Notice>Your session expired. Please log in again.</Notice>}

            <form onSubmit={handleSubmit} className="space-y-5">
                <Field label="Email">
                    <input type="email" autoComplete="email" required className={inputClass}
                        value={email} onChange={(e) => setEmail(e.target.value)} />
                </Field>
                <Field label="Password">
                    <input type="password" autoComplete="current-password" required className={inputClass}
                        value={password} onChange={(e) => setPassword(e.target.value)} />
                </Field>

                {needs2FA && (
                    <Field label="2FA code" hint="The 6-digit code from your authenticator app.">
                        <input type="text" inputMode="numeric" autoComplete="one-time-code" className={inputClass}
                            value={totpCode} onChange={(e) => setTotpCode(e.target.value)} />
                    </Field>
                )}

                {message && <Notice tone="error">{message}</Notice>}

                <Button type="submit" disabled={submitting} className="w-full">
                    {submitting ? "Logging in…" : "Log in"}
                </Button>
            </form>

            <p className="text-center text-sm"><Link to="/forgot-password" className={linkClass}>Forgot your password?</Link></p>
        </AccountShell>
    );
}

export default AdminLogin
