import { prisma } from "../src/lib/prisma.js";

async function main() {
    await prisma.variant.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();

    const kurthiCategory = await prisma.category.create({
        data: {
            name: "Designer Kurthi",
            slug: "designer-kurthi",
        },
    });

    await prisma.product.create({
        data: {
            name: "Midnight Bloom Designer Kurthi",
            slug: "midnight-bloom-designer-kurthi",
            description: "Elevate your everyday wardrobe with the Midnight Bloom Designer Kurthi...",
            basePrice: 1299,
            compareAtPrice: 1499,
            weight: 600,
            isActive: true,
            images: [
                "https://res.cloudinary.com/ozdnlp8w/image/upload/v1787977496/IMG_6540.jpg",
                "https://res.cloudinary.com/ozdnlp8w/image/upload/v1787977479/IMG_6654.jpg",
                "https://res.cloudinary.com/ozdnlp8w/image/upload/v1787977477/IMG_6652.jpg",
                "https://res.cloudinary.com/ozdnlp8w/image/upload/v1787977472/IMG_6649.jpg"
            ],
            categoryId: kurthiCategory.id,
            variants: {
                create: [
                    { size: "M", color: "Dark Purple", sku: "MBK-M", stockQuantity: 10 },
                    { size: "L", color: "Dark Purple", sku: "MBK-L", stockQuantity: 10 },
                    { size: "XL", color: "Dark Purple", sku: "MBK-XL", stockQuantity: 10 },
                    { size: "XXL", color: "Dark Purple", sku: "MBK-XXL", stockQuantity: 10 },
                ],
            },
        },
    });


    await prisma.product.create({
        data: {
            name: "Ocean Bloom Designer Kurthi",
            slug: "ocean-bloom-designer-kurthi",
            description: "Elevate your everyday wardrobe with the ocean Bloom Designer Kurthi...",
            basePrice: 1299,
            compareAtPrice: 1499,
            weight: 600,
            isActive: true,
            images: [
                "https://res.cloudinary.com/ozdnlp8w/image/upload/v1787977557/IMG_6520.jpg",
                "https://res.cloudinary.com/ozdnlp8w/image/upload/v1787977554/IMG_6517.jpg",
                "https://res.cloudinary.com/ozdnlp8w/image/upload/v1787977551/IMG_6514.jpg",
                "https://res.cloudinary.com/ozdnlp8w/image/upload/v1787977546/IMG_6513.jpg"
            ],
            categoryId: kurthiCategory.id,
            variants: {
                create: [
                    { size: "M", color: "Navy Blue", sku: "OBK-M", stockQuantity: 10 },
                    { size: "L", color: "Navy Blue", sku: "OBK-L", stockQuantity: 10 },
                    { size: "XL", color: "Navy Blue", sku: "OBK-XL", stockQuantity: 10 },
                    { size: "XXL", color: "Navy Blue", sku: "OBK-XXL", stockQuantity: 10 },
                ],
            },
        },
    });

    await prisma.product.create({
        data: {
            name: "Olive Aura Co-ordset",
            slug: "olive-aura-co-ordset",
            description: "Elevate your everyday wardrobe with the Olive Aura Co-ordset...",
            basePrice: 999,
            compareAtPrice: 1199,
            weight: 600,
            isActive: true,
            images: [
                "https://res.cloudinary.com/ozdnlp8w/image/upload/v1787977607/IMG_6713.jpg",
                "https://res.cloudinary.com/ozdnlp8w/image/upload/v1787977604/IMG_6708.jpg",
                "https://res.cloudinary.com/ozdnlp8w/image/upload/v1787977601/IMG_6701.jpg",
                "https://res.cloudinary.com/ozdnlp8w/image/upload/v1787977598/IMG_6700.jpg",
                "https://res.cloudinary.com/ozdnlp8w/image/upload/v1787977596/IMG_6696.jpg",
                "https://res.cloudinary.com/ozdnlp8w/image/upload/v1787977594/IMG_6694.jpg",
                "https://res.cloudinary.com/ozdnlp8w/image/upload/v1787977591/IMG_6692.jpg"
            ],
            categoryId: kurthiCategory.id,
            variants: {
                create: [
                    { size: "M", color: "Olive Green", sku: "OAC-M", stockQuantity: 10 },
                    { size: "L", color: "Olive Green", sku: "OAC-L", stockQuantity: 10 },
                    { size: "XL", color: "Olive Green", sku: "OAC-XL", stockQuantity: 10 },
                    { size: "XXL", color: "Olive Green", sku: "OAC-XXL", stockQuantity: 10 },
                ],
            },
        },
    });

}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });