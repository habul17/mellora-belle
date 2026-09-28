import { useState } from "react"
import type { FormEvent } from "react"
import { Link } from "react-router-dom"
import { API } from "../lib/api"
import AccountShell from "../components/AccountShell"
import { Button, Field, Notice } from "../components/ui"
import { inputClass, linkClass } from "../lib/styles"
import { usePageTitle } from "../lib/usePageTitle"

function ForgotPassword() {
    usePageTitle("Reset your password");
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
            <AccountShell title="Check your email" intro={
                <p>
                    If there's an account for {email}, we've sent it a link to reset your
                    password. The link works for 15 minutes.
                </p>
            }>
                <p className="text-center text-sm text-muted">
                    Nothing arrived? Check your spam folder, or{" "}
                    <button type="button" onClick={() => setSent(false)} className={`text-ink ${linkClass}`}>try again</button>.
                </p>
                <p className="text-center text-sm"><Link to="/login" className={linkClass}>Back to log in</Link></p>
            </AccountShell>
        );
    }

    return (
        <AccountShell title="Reset your password"
            intro={<p>Enter the email you signed up with and we'll send you a link to set a new password.</p>}>
            <form onSubmit={handleSubmit} className="space-y-5">
                <Field label="Email">
                    <input type="email" autoComplete="email" required className={inputClass}
                        value={email} onChange={(e) => setEmail(e.target.value)} />
                </Field>

                {message && <Notice tone="error">{message}</Notice>}

                <Button type="submit" disabled={submitting} className="w-full">
                    {submitting ? "Sending…" : "Send reset link"}
                </Button>
            </form>

            <p className="text-center text-sm"><Link to="/login" className={linkClass}>Back to log in</Link></p>
        </AccountShell>
    );
}

export default ForgotPassword
