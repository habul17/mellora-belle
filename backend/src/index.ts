import express from "express"
import dotenv from "dotenv"
import cors from "cors"
import { prisma } from "./lib/prisma.js"

dotenv.config();

const app = express();

app.use(express.json());

app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173" }))


app.get("/products", async (req, res) => {

    const getProducts = await prisma.product.findMany({ include: { category: true, variants: true } });

    res.json({
        products: getProducts
    })
})

app.get("/products/:slug", async (req, res) => {


    const getProduct = await prisma.product.findUnique({ where: { slug: req.params.slug }, include: { category: true, variants: true } });

    if (!getProduct) {
        return res.status(404).json({
            error: "Product not found"
        })
    }

    res.json({
        product: getProduct
    })
})

app.patch("/variants/:id/stock", async (req, res) => {
    const stockQuantity = req.body.stockQuantity;

    const updatedVariant = await prisma.variant.update({
        where: { id: req.params.id },
        data: { stockQuantity }
    });
    res.json({variant: updatedVariant});
})

app.get("/health", (req, res) => {
    res.json({
        status: "ok"
    })
})


app.listen(process.env.PORT || 4000, () => {
    console.log(`Server Running On Port ${process.env.PORT || 4000}`);
})