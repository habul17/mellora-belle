// FRONTEND_URL is the shop's address. It can list more than one, separated
// by commas: the first is the main one (emails, password links, the sitemap),
// and every one of them may call the API. That keeps the old vercel.app
// address working while the real domain takes over, e.g.
//   FRONTEND_URL=https://mellorabelle.com,https://mellora-belle.vercel.app
export function siteOrigins() {
    const listed = (process.env.FRONTEND_URL ?? "")
        .split(",")
        .map((url) => url.trim().replace(/\/+$/, ""))
        .filter(Boolean);
    return listed.length > 0 ? listed : ["http://localhost:5173"];
}

// The main address, with no trailing slash.
export function siteUrl() {
    return siteOrigins()[0]!;
}
