import { useState } from "react"
import type { FormEvent } from "react"
import { useSearchParams } from "react-router-dom"
import { API, clearToken } from "../lib/api"
import AccountShell from "../components/AccountShell"
import { Button, ButtonLink, Field, Notice } from "../components/ui"
import { inputClass } from "../lib/styles"
import { usePageTitle } from "../lib/usePageTitle"

function ResetPassword() {
    usePageTitle("Choose a new password");
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
            <AccountShell title="This link doesn't work" intro={
                <p>
                    Reset links work once, for 15 minutes. This one has expired, was already
                    used, or was copied incompletely.
                </p>
            }>
                <ButtonLink to="/forgot-password" className="w-full">Send me a new link</ButtonLink>
            </AccountShell>
        );
    }

    if (done) {
        return (
            <AccountShell title="Password changed" intro={<p>You can now log in with your new password.</p>}>
                <ButtonLink to="/login" className="w-full">Log in</ButtonLink>
            </AccountShell>
        );
    }

    return (
        <AccountShell title="Choose a new password">
            <form onSubmit={handleSubmit} className="space-y-5">
                <Field label="New password" hint="At least 8 characters.">
                    <input type="password" autoComplete="new-password" required minLength={8} className={inputClass}
                        value={password} onChange={(e) => setPassword(e.target.value)} />
                </Field>
                <Field label="Type it again">
                    <input type="password" autoComplete="new-password" required className={inputClass}
                        value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                </Field>

                {message && <Notice tone="error">{message}</Notice>}

                <Button type="submit" disabled={submitting} className="w-full">
                    {submitting ? "Saving…" : "Save new password"}
                </Button>
            </form>
        </AccountShell>
    );
}

export default ResetPassword
