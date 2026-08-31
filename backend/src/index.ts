import express from "express"
import dotenv from "dotenv"
import cors from "cors"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import { prisma } from "./lib/prisma.js"
import { Prisma } from "./generated/prisma/client.js"
import { requireAuth } from "./middleware/requireAuth.js"


dotenv.config();

const app = express();

app.use(express.json());

app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173" }))

app.post("/login", async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            return res.status(401).json({ error: "Invalid email or password" })
        }

        const passwordMatches = await bcrypt.compare(password, user.passwordHash);

        if (!passwordMatches) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        const accessToken = jwt.sign(
            { userId: user.id, role: user.role },
            process.env.JWT_SECRET!,
            { expiresIn: "15m" }
        );
        res.json({ accessToken });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "something went wrong" })
    }
})

app.post("/signup", async (req, res) => {
    const { email, password } = req.body;

    try {
        const passwordHash = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: { email, passwordHash },
        });

        res.json({ id: user.id, email: user.email, role: user.role });
    } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            return res.status(409).json({ error: "An account with this email already exists" })
        }
        console.log(err);
        res.status(500).json({ error: "Something went wrong" })
    }

})


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

app.patch("/variants/:id/stock", requireAuth, async (req, res) => {
    const stockQuantity = req.body.stockQuantity;
    const id = req.params.id;

    if (!id || Array.isArray(id)) return res.status(400).json({
        error: "Invalid id"
    })

    try {
        const updatedVariant = await prisma.variant.update({
            where: { id },
            data: { stockQuantity }
        });
        res.json({ variant: updatedVariant });
    } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
            return res.status(404).json({ error: "Variant not found" })
        }
        console.log(err);
        res.status(500).json({ error: "Something went wrong" })
    }


})

app.get("/health", (req, res) => {
    res.json({
        status: "ok"
    })
})


app.listen(process.env.PORT || 4000, () => {
    console.log(`Server Running On Port ${process.env.PORT || 4000}`);
})