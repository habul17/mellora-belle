import express from "express"
import dotenv from "dotenv"
import cors from "cors"
import { prisma } from "./lib/prisma.js"

dotenv.config();

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173" }))


app.get("/products", async (req, res) => {

    const getProducts = await prisma.product.findMany({ include: { category: true, variants: true } });

    res.json({
        products: getProducts
    })
})

app.get("/products/:slug", async (req, res) => {


    const getProduct = await prisma.product.findUnique({ where: { slug: req.params.slug }, include: { category: true, variants: true } });

    if(!getProduct) {
        return res.status(404).json({
            error: "Product not found"
        })
    }

    res.json({
        product: getProduct
    })
})

app.get("/health", (req, res) => {
    res.json({
        status: "ok"
    })
})


app.listen(process.env.PORT || 4000, () => {
    console.log(`Server Running On Port ${process.env.PORT || 4000}`);
})