import { prisma } from "./prisma.js"
import { ProductAdminError } from "./productAdmin.js"

// Reels from the shop's Instagram: the home page's row, and the admin's Reels
// page (add one, remove one). Problems go back like the Products page's.

// The most the home page shows. Older reels stay saved but drop off the row.
const SHOWN = 12;

// A product that's switched off is hidden from the shop, so its reel still
// plays, just without "Shop this".
export async function listReels() {
    const reels = await prisma.reel.findMany({
        include: { product: { select: { name: true, slug: true, basePrice: true, images: true, isActive: true } } },
        orderBy: { createdAt: "desc" },
        take: SHOWN,
    });
    return reels.map(({ id, videoUrl, instagramUrl, product }) => ({
        id,
        videoUrl,
        instagramUrl,
        product: product?.isActive
            ? { name: product.name, slug: product.slug, basePrice: product.basePrice, image: product.images[0] ?? null }
            : null,
    }));
}

const adminReelInclude = { product: { select: { id: true, name: true, isActive: true } } } as const;

export function listAdminReels() {
    return prisma.reel.findMany({ include: adminReelInclude, orderBy: { createdAt: "desc" } });
}

export async function createReel(details: { videoUrl: string; instagramUrl: string; productId?: string | null | undefined }) {
    const productId = details.productId ?? null;
    if (productId && !(await prisma.product.findUnique({ where: { id: productId }, select: { id: true } }))) {
        throw new ProductAdminError(400, "Choose a product");
    }
    return prisma.reel.create({
        data: { videoUrl: details.videoUrl, instagramUrl: details.instagramUrl, productId },
        include: adminReelInclude,
    });
}

// Nothing else points at a reel, so removing one really deletes it.
export async function deleteReel(id: string) {
    const reel = await prisma.reel.findUnique({ where: { id }, include: adminReelInclude });
    if (!reel) throw new ProductAdminError(404, "Reel not found");
    await prisma.reel.delete({ where: { id } });
    return reel;
}
