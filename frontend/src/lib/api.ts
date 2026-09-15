// Every authenticated request goes through here, so there is exactly one
// place that knows how to attach a token and what to do when one is rejected.

export function getToken() {
    const token = localStorage.getItem("accessToken");

    // A bad login used to save the literal string "undefined", which is
    // truthy and so looked like a valid session forever. Treat those as
    // logged out so an affected browser recovers on its own.
    if (!token || token === "undefined" || token === "null") return null;

    return token;
}

export function clearToken() {
    localStorage.removeItem("accessToken");
}

export async function authFetch(path: string, options: RequestInit = {}) {
    const response = await fetch(`${import.meta.env.VITE_API_URL}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...options.headers,
            "Authorization": `Bearer ${getToken()}`,
        },
    });

    if (response.status === 401) {
        clearToken();

        const from = window.location.pathname;
        window.location.href = `/login?expired=1&from=${encodeURIComponent(from)}`;

        // The browser is navigating away. Never resolve, so the caller does
        // not carry on rendering an error the user will never get to read.
        return new Promise<never>(() => { });
    }

    return response.json();
}
