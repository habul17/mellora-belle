// Every authenticated request goes through here, so there is exactly one
// place that knows how to attach a token and what to do when one is rejected.

export const API = import.meta.env.VITE_API_URL;

// The API refuses to touch the session cookie without this header. Other
// sites can't send it (the browser asks the API first, and the API only
// allows this site), so they can't use or end a visitor's session.
const SESSION_HEADERS = { "X-Requested-With": "mellora-belle" };

export function getToken() {
    const token = localStorage.getItem("accessToken");

    // A bad login used to save the literal string "undefined", which is
    // truthy and so looked like a valid session forever. Treat those as
    // logged out so an affected browser recovers on its own.
    if (!token || token === "undefined" || token === "null") return null;

    return token;
}

export function saveToken(token: string) {
    localStorage.setItem("accessToken", token);
}

export function clearToken() {
    localStorage.removeItem("accessToken");
}

let refreshing: Promise<string | null> | null = null;

// Access tokens last 15 minutes. The login also left an httpOnly cookie that
// can be traded for a new one. Requests that hit an expired token at the same
// moment share one refresh instead of each starting their own.
export function refreshAccessToken() {
    if (!refreshing) {
        refreshing = fetch(`${API}/auth/refresh`, {
            method: "POST",
            credentials: "include",
            headers: SESSION_HEADERS,
        })
            .then(async (response) => {
                if (!response.ok) return null;
                const data = await response.json();
                saveToken(data.accessToken);
                return data.accessToken as string;
            })
            .catch(() => null)
            .finally(() => { refreshing = null; });
    }
    return refreshing;
}

export async function logOut() {
    try {
        await fetch(`${API}/auth/logout`, {
            method: "POST",
            credentials: "include",
            headers: SESSION_HEADERS,
        });
    } catch {
        // Offline or the API is down. The token below is cleared either way,
        // and the cookie expires on its own.
    }
    clearToken();
}

function send(path: string, options: RequestInit) {
    return fetch(`${API}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...options.headers,
            "Authorization": `Bearer ${getToken()}`,
        },
    });
}

export async function authFetch(path: string, options: RequestInit = {}) {
    let response = await send(path, options);

    // Expired access token: get a new one from the cookie and try once more.
    if (response.status === 401 && await refreshAccessToken()) {
        response = await send(path, options);
    }

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
