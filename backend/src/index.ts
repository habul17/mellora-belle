import express from "express"
import dotenv from "dotenv"
import cors from "cors"
import { prisma } from "./lib/prisma.js"

dotenv.config();

const app = express();

app.use(cors({ origin: "http://localhost:5173" }))


app.get("/products", async (req, res) => {

    const getProducts = await prisma.product.findMany();

    res.json({
        products: getProducts
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