import { useEffect, useRef, useState } from "react"
import type { FormEvent } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { API } from "../lib/api"
import { finishLogin, safeRedirect } from "../lib/account"
import AccountShell from "../components/AccountShell"
import { Button, Field, Notice } from "../components/ui"
import { inputClass, linkClass } from "../lib/styles"
import { usePageTitle } from "../lib/usePageTitle"

// Customers log in with a 6-digit code we email them: no password to
// remember. The first code also creates the account, so new and returning
// customers use the same two steps.
function Login() {
    usePageTitle("Log in");
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const from = searchParams.get("from");
    const sessionExpired = searchParams.get("expired") === "1";
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [codeSent, setCodeSent] = useState(false);
    const [resent, setResent] = useState(false);
    const [message, setMessage] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const codeInput = useRef<HTMLInputElement>(null);

    // Straight to the code box once it appears, and again after a new code.
    useEffect(() => {
        if (codeSent) codeInput.current?.focus();
    }, [codeSent, resent]);

    async function post(path: string, body: object) {
        const response = await fetch(`${API}${path}`, {
            method: "POST",
            // Lets the browser keep the refresh cookie the login sets.
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        return response.json();
    }

    async function sendCode(again: boolean) {
        setSubmitting(true);
        setMessage("");
        setResent(false);

        try {
            const data = await post("/login-code", { email });

            if (data.error) {
                setMessage(data.error);
                return;
            }

            setCode("");
            setCodeSent(true);
            setResent(again);
        } catch {
            setMessage("We couldn't reach the shop. Check your connection and try again.");
        } finally {
            setSubmitting(false);
        }
    }

    async function handleEmail(e: FormEvent) {
        e.preventDefault();
        await sendCode(false);
    }

    async function handleCode(e: FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        setMessage("");
        setResent(false);

        try {
            const data = await post("/login-code/verify", { email, code });

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

    function changeEmail() {
        setCodeSent(false);
        setCode("");
        setMessage("");
        setResent(false);
    }

    if (codeSent) {
        return (
            <AccountShell title="Check your email" intro={
                <p>We sent a 6-digit code to <span className="text-ink">{email}</span>. It works for 10 minutes.</p>
            }>
                {resent && !message && <Notice tone="success">We sent a new code. Use the one in the newest email.</Notice>}

                <form onSubmit={handleCode} className="space-y-5">
                    <Field label="Code">
                        <input type="text" inputMode="numeric" autoComplete="one-time-code" required ref={codeInput}
                            pattern="[0-9]{6}" maxLength={6} className={`${inputClass} tracking-[0.4em]`}
                            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
                    </Field>

                    {message && <Notice tone="error">{message}</Notice>}

                    <Button type="submit" disabled={submitting} className="w-full">
                        {submitting ? "Logging in…" : "Log in"}
                    </Button>
                </form>

                <p className="text-center text-sm text-muted">
                    Nothing arrived? Check your spam folder, or{" "}
                    <button type="button" disabled={submitting} onClick={() => sendCode(true)} className={`text-ink ${linkClass}`}>send a new code</button>.
                </p>
                <p className="text-center text-sm">
                    <button type="button" onClick={changeEmail} className={linkClass}>Use a different email</button>
                </p>
            </AccountShell>
        );
    }

    return (
        <AccountShell title="Log in" intro={<p>Enter your email and we'll send you a code. New here? The same code creates your account.</p>}>
            {sessionExpired && !message && <Notice>Your session expired. Please log in again.</Notice>}

            <form onSubmit={handleEmail} className="space-y-5">
                <Field label="Email">
                    <input type="email" autoComplete="email" required className={inputClass}
                        value={email} onChange={(e) => setEmail(e.target.value)} />
                </Field>

                {message && <Notice tone="error">{message}</Notice>}

                <Button type="submit" disabled={submitting} className="w-full">
                    {submitting ? "Sending…" : "Send code"}
                </Button>
                <p className="text-center text-xs text-muted">
                    By continuing you agree to our <Link to="/terms" className={linkClass}>terms</Link> and <Link to="/privacy" className={linkClass}>privacy policy</Link>.
                </p>
            </form>
        </AccountShell>
    );
}

export default Login
