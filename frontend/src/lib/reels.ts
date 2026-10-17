// The shape GET /reels sends back, and the Cloudinary links made from it.
import { API } from "./api"

export type Reel = {
    id: string;
    videoUrl: string;
    instagramUrl: string;
    // Null for a reel about the shop, or when its product is switched off.
    product: { name: string; slug: string; basePrice: number; image: string | null } | null;
};

export async function fetchReels(): Promise<Reel[]> {
    const response = await fetch(`${API}/reels`);
    const data = await response.json();
    if (!Array.isArray(data.reels)) throw new Error(data.error ?? "Could not load reels");
    return data.reels;
}

// The uploaded video is a full-size phone file (often a .mov). Cloudinary
// makes what the page needs from it: a still for the cover (so_auto picks a
// frame by its colours) and a smaller MP4 that plays in every browser.
const MARKER = "/video/upload/";

function fromVideo(url: string, transformation: string, extension: string) {
    if (!url.startsWith("https://res.cloudinary.com/") || !url.includes(MARKER)) return url;
    return url.replace(/\.[a-z0-9]+$/i, "").replace(MARKER, `${MARKER}${transformation}/`) + `.${extension}`;
}

export const reelCover = (url: string, width: number) => fromVideo(url, `so_auto,f_auto,q_auto,c_limit,w_${width}`, "jpg");

export const reelVideo = (url: string) => fromVideo(url, "f_auto,q_auto,c_limit,w_720", "mp4");
