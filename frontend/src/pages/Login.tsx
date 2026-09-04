import { useState } from "react"
import { useNavigate } from "react-router-dom"

function Login() {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [totpCode, setTotpCode] = useState("");
    const [needs2FA, setNeeds2FA] = useState(false);


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

        localStorage.setItem("accessToken", data.accessToken);
        navigate("/admin");
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