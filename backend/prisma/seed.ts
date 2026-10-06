import { prisma } from "../src/lib/prisma.js";

async function main() {
    // The seed starts the catalog over, so it only runs on a shop nobody has
    // ordered from. The live shop's products are edited on the admin Products page.
    if (await prisma.order.count() > 0) {
        throw new Error("This database has orders, so the seed won't wipe its products. Use the admin Products page instead.");
    }

    await prisma.cartItem.deleteMany();
    await prisma.variant.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();

    const kurthiCategory = await prisma.category.create({
        data: {
            name: "Designer Kurthi",
            slug: "designer-kurthi",
        },
    });

    const coordSetCategory = await prisma.category.create({
        data: {
            name: "Co-ord Set",
            slug: "co-ord-set",
        },
    });

    await prisma.product.create({
        data: {
            name: "Midnight Bloom Designer Kurthi",
            slug: "midnight-bloom-designer-kurthi",
            description: "Elevate your everyday wardrobe with the Midnight Bloom Designer Kurthi, crafted for women who love timeless elegance with effortless comfort. Featuring a rich dark purple floral print and graceful silhouette, this designer kurthi is perfect for office wear, festive gatherings, casual outings and family occasions. Made from premium rayon fabric, it offers a soft feel, breathable comfort and a flattering drape.",
            details: "Fabric: Premium Rayon\nColour: Dark Purple\nPrint: Floral Print\nFit: Regular Fit\nNeckline: Split Round Neck\nSleeves: 3/4 Sleeves\nLength: Calf Length\nStyle: Casual, Office, Festive & Everyday Wear\nClosure: Front Tie-Up\nPackage Includes: 1 Designer Kurthi\nPerfect For: Office Wear • Casual Outings • College • Festive Gatherings • Family Functions • Daily Wear",
            sizeChart: "Size, Bust, Waist, Hip, Length\nM, 38, 36, 42, 46\nL, 40, 38, 44, 46\nXL, 42, 40, 46, 46\nXXL, 44, 42, 48, 46",
            care: "Hand wash separately in cold water.\nUse a mild detergent.\nDo not bleach.\nDry in the shade.\nIron on low to medium heat.",
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
            description: "Refresh your wardrobe with the Ocean Bloom Designer Kurthi, designed to blend elegance with everyday comfort. The beautiful blue floral print paired with a graceful silhouette makes it an ideal choice for office wear, brunches, festive occasions and casual outings. Crafted from premium rayon fabric, it offers a soft feel, breathable comfort and a flattering drape for all-day wear.",
            details: "Fabric: Premium Rayon\nColour: Navy Blue\nPrint: Floral Print\nFit: Regular Fit\nNeckline: Split Round Neck\nSleeves: 3/4 Sleeves\nLength: Calf Length\nStyle: Casual, Office, Festive & Everyday Wear\nClosure: Front Tie-Up\nPackage Includes: 1 Designer Kurthi",
            sizeChart: "Size, Bust, Waist, Hip, Length\nM, 38, 36, 42, 46\nL, 40, 38, 44, 46\nXL, 42, 40, 46, 46\nXXL, 44, 42, 48, 46",
            care: "Hand wash separately in cold water.\nUse mild detergent.\nDo not bleach.\nDry in shade.\nIron on low to medium heat.",
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
            description: "Step into effortless elegance with the Olive Aura Co-ord set. Inspired by fresh botanical hues, this beautifully crafted co-ord set features a soothing olive green floral print that brings together sophistication and everyday comfort. Made from premium rayon fabric, it offers a lightweight feel, breathable comfort and a graceful drape, making it perfect for office wear, brunches, festive gatherings and casual outings. Designed for women who love timeless fashion with a modern touch, this co-ord set is a versatile wardrobe essential.",
            details: "Fabric: Premium Rayon\nColour: Olive Green\nPrint: Floral Print\nFit: Regular Fit\nNeckline: V Neck\nSleeves: 3/4 Sleeves\nLength: Calf Length\nStyle: Casual, Office, Festive & Everyday Wear\nPackage Includes: 1 Co-ord set",
            sizeChart: "Size, Bust, Waist, Hip, Length\nM, 38, 36, 42, 46\nL, 40, 38, 44, 46\nXL, 42, 40, 46, 46\nXXL, 44, 42, 48, 46",
            care: "Hand wash separately in cold water.\nUse mild detergent.\nDo not bleach.\nDry in shade.\nIron on low to medium heat.",
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
            categoryId: coordSetCategory.id,
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