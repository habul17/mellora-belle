// Product photos are full-size camera files on Cloudinary. Asking Cloudinary
// for a resized, modern-format copy (f_auto picks WebP/AVIF per browser) cuts
// each one from megabytes to tens of kilobytes. Other URLs pass through.
const MARKER = "/image/upload/";

export function sized(url: string, width: number) {
    if (!url.startsWith("https://res.cloudinary.com/") || !url.includes(MARKER)) return url;
    return url.replace(MARKER, `${MARKER}f_auto,q_auto,c_limit,w_${width}/`);
}

// For <img srcSet>: the browser picks the smallest copy that is sharp enough.
export function srcSet(url: string, widths = [400, 600, 800, 1200]) {
    return widths.map((w) => `${sized(url, w)} ${w}w`).join(", ");
}
