import { prisma } from "./prisma.js"
import { Prisma } from "../generated/prisma/client.js"
import type { Size } from "../generated/prisma/client.js"

// The admin's Products page: edit what the shop shows (name, description,
// details, size chart, care, prices, weight, colour, photos, on sale or not),
// add a product, add a size.
// Nothing here deletes: a product or size that has ever been ordered stays in
// old orders, so the admin switches it off (or sets its stock to 0) instead.

export class ProductAdminError extends Error {
    constructor(public httpStatus: number, message: string) {
        super(message);
    }
}

export type ProductDetails = {
    name: string;
    description: string;
    details?: string | undefined;
    sizeChart?: string | undefined;
    care?: string | undefined;
    basePrice: number;
    compareAtPrice: number | null;
    weight: number;
    color: string;
    images: string[];
    isActive: boolean;
};

export type NewProduct = ProductDetails & {
    categoryId: string;
    sizes: { size: Size; stockQuantity: number }[];
};

const adminProductInclude = { variants: true, category: true } as const;

// "Rose Garden Kurthi" -> "rose-garden-kurthi". The slug is the product's
// web address, so it's set once and never changed (old links keep working).
export function slugify(name: string) {
    return name
        .normalize("NFKD").replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80)
        .replace(/-+$/, "");
}

// SKUs are the product's initials plus the size ("RGK-M"), like the seeded
// ones. A second product with the same initials gets "RGK2-M".
async function freeSkuPrefix(name: string) {
    const initials = name.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean).map((word) => word[0]).join("").slice(0, 4) || "P";
    for (let n = 1; ; n++) {
        const prefix = n === 1 ? initials : `${initials}${n}`;
        const taken = await prisma.variant.findFirst({ where: { sku: { startsWith: `${prefix}-` } }, select: { id: true } });
        if (!taken) return prefix;
    }
}

export async function createProduct(details: NewProduct) {
    const slug = slugify(details.name);
    if (!slug) throw new ProductAdminError(400, "Use some letters or numbers in the product name");

    const sizes = details.sizes.map((s) => s.size);
    if (new Set(sizes).size !== sizes.length) throw new ProductAdminError(400, "Each size can only be added once");

    const category = await prisma.category.findUnique({ where: { id: details.categoryId }, select: { id: true } });
    if (!category) throw new ProductAdminError(400, "Choose a category");

    const existing = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
    if (existing) throw new ProductAdminError(409, "There's already a product with this name. Choose a different name.");

    const prefix = await freeSkuPrefix(details.name);

    try {
        return await prisma.product.create({
            data: {
                name: details.name,
                slug,
                description: details.description,
                details: details.details ?? "",
                sizeChart: details.sizeChart ?? "",
                care: details.care ?? "",
                basePrice: details.basePrice,
                compareAtPrice: details.compareAtPrice,
                weight: details.weight,
                images: details.images,
                isActive: details.isActive,
                categoryId: category.id,
                variants: {
                    create: details.sizes.map((s) => ({
                        size: s.size,
                        color: details.color,
                        sku: `${prefix}-${s.size}`,
                        stockQuantity: s.stockQuantity,
                    })),
                },
            },
            include: adminProductInclude,
        });
    } catch (err) {
        // Two saves at once with the same name or initials.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            throw new ProductAdminError(409, "There's already a product with this name. Choose a different name.");
        }
        throw err;
    }
}

// Saves the edit form. Returns the product and what changed, for the audit log.
export async function updateProduct(id: string, details: ProductDetails) {
    const before = await prisma.product.findUnique({ where: { id }, include: { variants: true } });
    if (!before) throw new ProductAdminError(404, "Product not found");

    const beforeColor = before.variants[0]?.color ?? "";
    const changes: Record<string, unknown> = {};
    for (const key of ["name", "basePrice", "compareAtPrice", "weight", "isActive"] as const) {
        if (before[key] !== details[key]) changes[key] = { from: before[key], to: details[key] };
    }
    if (beforeColor !== details.color) changes.color = { from: beforeColor, to: details.color };
    for (const key of ["description", "details", "sizeChart", "care"] as const) {
        if (details[key] !== undefined && before[key] !== details[key]) changes[key] = "changed";
    }
    if (before.images.join("\n") !== details.images.join("\n")) changes.images = { from: before.images.length, to: details.images.length };

    const [product] = await prisma.$transaction([
        prisma.product.update({
            where: { id },
            data: {
                name: details.name,
                description: details.description,
                // Left out, it stays as it is.
                ...(details.details !== undefined && { details: details.details }),
                ...(details.sizeChart !== undefined && { sizeChart: details.sizeChart }),
                ...(details.care !== undefined && { care: details.care }),
                basePrice: details.basePrice,
                compareAtPrice: details.compareAtPrice,
                weight: details.weight,
                images: details.images,
                isActive: details.isActive,
            },
            include: adminProductInclude,
        }),
        // One colour per product: every size shows the same one.
        prisma.variant.updateMany({ where: { productId: id }, data: { color: details.color } }),
    ]);

    return { product: { ...product, variants: product.variants.map((v) => ({ ...v, color: details.color })) }, changes };
}

// A size the product doesn't have yet (say XXL came in later).
export async function addSize(productId: string, size: Size, stockQuantity: number) {
    const product = await prisma.product.findUnique({ where: { id: productId }, include: { variants: true } });
    if (!product) throw new ProductAdminError(404, "Product not found");
    if (product.variants.some((v) => v.size === size)) throw new ProductAdminError(409, `This product already has size ${size}`);

    // Same prefix as the product's other sizes ("MBK-M" -> "MBK").
    const known = product.variants[0]?.sku;
    const prefix = known && known.includes("-") ? known.slice(0, known.lastIndexOf("-")) : await freeSkuPrefix(product.name);

    try {
        const variant = await prisma.variant.create({
            data: { productId, size, color: product.variants[0]?.color ?? "", sku: `${prefix}-${size}`, stockQuantity },
        });
        return variant;
    } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            throw new ProductAdminError(409, `This product already has size ${size}`);
        }
        throw err;
    }
}

export function listAdminProducts() {
    return Promise.all([
        prisma.product.findMany({ include: adminProductInclude, orderBy: { name: "asc" } }),
        prisma.category.findMany({ orderBy: { name: "asc" } }),
    ]);
}
