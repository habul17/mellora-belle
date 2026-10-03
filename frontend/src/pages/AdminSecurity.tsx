import { useState, useEffect } from "react"
import type { FormEvent } from "react"
import { Navigate } from "react-router-dom"
import { authFetch, getToken } from "../lib/api"
import AdminNav from "../components/AdminNav"

type Setup = { secret: string; qrCodeImage: string };

// Two-factor login for the admin: a code from an authenticator app on the
// owner's phone, asked for after the password.
function AdminSecurity() {
    const token = getToken();
    const [enabled, setEnabled] = useState<boolean | null>(null);
    const [setup, setSetup] = useState<Setup | null>(null);
    const [code, setCode] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!token) return;
        authFetch("/admin/2fa")
            .then((data) => {
                if (typeof data.enabled === "boolean") setEnabled(data.enabled);
                else setError(data.error ?? "Could not load");
            })
            .catch(() => setError("Could not reach the server"));
    }, [token]);

    if (!token) return <Navigate to="/admin/login?from=/admin/security" replace />;
    if (error) return <div className="admin">{error}</div>;
    if (enabled === null) return <div className="admin">Loading...</div>;

    async function start() {
        setBusy(true);
        setMessage("");
        try {
            const data = await authFetch("/admin/2fa/setup", { method: "POST" });
            if (data.qrCodeImage) {
                setSetup(data);
                setCode("");
            } else {
                setMessage(data.error ?? "Something went wrong");
            }
        } catch {
            setMessage("Could not reach the server");
        } finally {
            setBusy(false);
        }
    }

    async function confirm(e: FormEvent) {
        e.preventDefault();
        setBusy(true);
        setMessage("");
        try {
            const data = await authFetch("/admin/2fa/confirm", { method: "POST", body: JSON.stringify({ code }) });
            if (data.enabled) {
                setEnabled(true);
                setSetup(null);
                setMessage("Done. From your next login, you'll be asked for a code from the app after your password.");
            } else {
                setMessage(data.error ?? "Something went wrong");
            }
        } catch {
            setMessage("Could not reach the server");
        } finally {
            setBusy(false);
        }
    }

    return (
        <main className="admin">
            <AdminNav />
            <h1>Security</h1>

            <h2>Two-factor login</h2>
            {enabled ? (
                <p><strong>On.</strong> Logging in to the admin needs your password and a code from the authenticator app on your phone.</p>
            ) : (
                <p>
                    <strong>Off.</strong> Anyone who learns your password can open the admin, see customers'
                    details and change orders. Turning this on takes two minutes.
                </p>
            )}

            {!setup && (
                <p>
                    <button onClick={start} disabled={busy}>
                        {enabled ? "Move it to a new phone" : "Turn on two-factor login"}
                    </button>
                </p>
            )}

            {setup && (
                <form onSubmit={confirm}>
                    <p>1. On your phone, install <strong>Google Authenticator</strong> or <strong>Microsoft Authenticator</strong>.</p>
                    <p>2. In the app, add an account and scan this code:</p>
                    <p><img src={setup.qrCodeImage} alt="QR code to scan with the authenticator app" width={200} height={200} /></p>
                    <p>Can't scan it? Choose "enter a setup key" in the app and type: <code>{setup.secret}</code></p>
                    <p>
                        3. Type the 6-digit code the app now shows:{" "}
                        <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
                            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
                        <button type="submit" disabled={busy || code.length !== 6}>Confirm</button>
                        <button type="button" onClick={() => { setSetup(null); setMessage(""); }} disabled={busy}>Cancel</button>
                    </p>
                    {enabled && <p>Your old phone keeps working until you confirm the new one.</p>}
                </form>
            )}

            {message && <p><strong>{message}</strong></p>}

            <h2>Lost your phone?</h2>
            <p>
                Ask your developer to switch two-factor login off for your account (they run
                {" "}<code>backend/scripts/reset-admin-2fa.ts</code>). Then log in with your password and set it up
                again here on the new phone.
            </p>
        </main>
    );
}

export default AdminSecurity
