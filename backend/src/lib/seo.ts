import { prisma } from "./prisma.js"
import { siteUrl } from "./site.js"

// Pages that are for one person (their cart, orders, account) or for the
// admin are kept out of search results.
const PRIVATE_PATHS = ["/admin", "/cart", "/checkout", "/orders", "/login", "/signup", "/forgot-password", "/reset-password"];

export function robotsTxt() {
    return [
        "User-agent: *",
        "Allow: /",
        ...PRIVATE_PATHS.map((path) => `Disallow: ${path}`),
        "",
        `Sitemap: ${siteUrl()}/sitemap.xml`,
        "",
    ].join("\n");
}

const PUBLIC_PAGES = ["/", "/shop", "/contact", "/shipping", "/refunds", "/pricing", "/terms", "/privacy"];

const escapeXml = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

// Every page Google should know about, including each product for sale.
export async function sitemapXml() {
    const products = await prisma.product.findMany({ where: { isActive: true }, select: { slug: true }, orderBy: { name: "asc" } });
    const paths = [...PUBLIC_PAGES, ...products.map((p) => `/products/${encodeURIComponent(p.slug)}`)];

    return [
        `<?xml version="1.0" encoding="UTF-8"?>`,
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
        ...paths.map((path) => `  <url><loc>${escapeXml(siteUrl() + path)}</loc></url>`),
        `</urlset>`,
        "",
    ].join("\n");
}
