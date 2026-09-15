import express from "express"
import dotenv from "dotenv"
import cors from "cors"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import crypto from "node:crypto"
import { prisma } from "./lib/prisma.js"
import { Prisma } from "./generated/prisma/client.js"
import { requireAuth } from "./middleware/requireAuth.js"
import { requireAdmin } from "./middleware/requireAdmin.js"
import { sendEmail } from "./lib/email.js"
import { releaseExpiredReservations, cancelAndReleaseStock } from "./lib/releaseExpiredReservations.js"
import { isServiceablePincode } from "./lib/shipping.js"
import { authenticator } from "otplib"
import QRCode from "qrcode"


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

        if (user.totpSecret) {
            const totpCode = req.body.totpCode;

            if (!totpCode) {
                return res.status(401).json({
                    error: "2FA code required"
                })
            }

            const isValidCode = authenticator.verify({
                token: totpCode,
                secret: user.totpSecret
            })

            if (!isValidCode) {
                return res.status(401).json({
                    error: "Invalid 2FA code"
                })
            }
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

app.post("/forgot-password", async (req, res) => {
    const email = req.body.email;

    try {
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            return res.json({ message: "If that email exists, a reset link has been sent" });
        }

        const rawToken = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

        await prisma.passwordResetToken.create({
            data: {
                tokenHash,
                userId: user.id,
                expiresAt: new Date(Date.now() + 15 * 60 * 1000),
            }
        })

        const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${rawToken}`;

        await sendEmail(
            user.email,
            "Reset your Mellora Belle password",
            `<p>Click the link below to reset your password. This link expires in 15 minutes.</p><a href="${resetLink}">${resetLink}</a>`
        );

        res.json({ message: "If that email exists, a reset link has been sent" })

    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Something went wrong" });
    }
})

app.post("/admin/2fa/setup", requireAuth, requireAdmin, async (req, res) => {
    const secret = authenticator.generateSecret();
    const userId = (req as any).user.userId;

    try {

        await prisma.user.update({
            where: { id: userId },
            data: { totpSecret: secret }
        });

        const otpauthUrl = authenticator.keyuri(userId, "Mellora Belle", secret);
        const qrCodeImage = await QRCode.toDataURL(otpauthUrl);

        res.json({ secret, otpauthUrl, qrCodeImage });

    } catch (err) {
        console.log(err);
        res.status(500).json({
            error: "Something went wrong"
        });
    }
})

app.post("/reset-password", async (req, res) => {
    const { token, newPassword } = req.body;

    try {
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

        const resetToken = await prisma.passwordResetToken.findUnique({
            where: { tokenHash }
        })

        if (!resetToken) {
            return res.status(400).json({ error: "Invalid or expired token" });
        }

        if (resetToken.expiresAt < new Date()) {
            return res.status(400).json({ error: "Invalid or expired token" })
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { id: resetToken.userId },
            data: { passwordHash }
        });

        await prisma.passwordResetToken.delete({
            where: { id: resetToken.id }
        });

        res.json({ message: "Password reset Successful " })

    } catch (err) {
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

app.patch("/variants/:id/stock", requireAuth, requireAdmin, async (req, res) => {
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

app.post("/cart/items", requireAuth, async (req, res) => {
    const userId = (req as any).user.userId;
    const { variantId, quantity } = req.body;

    try {
        const cart = await prisma.cart.upsert({
            where: { userId },
            update: {},
            create: { userId }
        })

        const variant = await prisma.variant.findUnique({ where: { id: variantId } });

        if (!variant) {
            return res.status(404).json({ error: "Variant not found" });
        }

        const existingItem = await prisma.cartItem.findUnique({
            where: { cartId_variantId: { cartId: cart.id, variantId } }
        });

        const newQuantity = (existingItem?.quantity ?? 0) + quantity;

        if (variant.stockQuantity < newQuantity) {
            return res.status(400).json({ error: "Not enough stock" })
        }

        const cartItem = await prisma.cartItem.upsert({
            where: { cartId_variantId: { cartId: cart.id, variantId } },
            update: { quantity: { increment: quantity } },
            create: { cartId: cart.id, variantId, quantity }
        })

        res.json({ cartItem });

    } catch (err) {
        console.log(err);
        res.status(500).json({
            error: "Something went wrong"
        })

    }
})

app.get("/cart", requireAuth, async (req, res) => {
    const userId = (req as any).user.userId;

    try {
        const cart = await prisma.cart.findUnique({
            where: { userId },
            include: {
                items: {
                    include: {
                        variant: {
                            include: { product: true }
                        }
                    }
                }
            }
        });

        if (!cart) {
            return res.json({ cart: { items: [] } });
        }

        res.json({ cart });

    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Something went wrong" });
    }
})

app.patch("/cart/items/:id", requireAuth, async (req, res) => {
    const userId = (req as any).user.userId;
    const id = req.params.id;
    const quantity = req.body.quantity;

    if (!id || Array.isArray(id)) return res.status(400).json({ error: "Invalid id" });

    try {
        const cartItem = await prisma.cartItem.findUnique({
            where: { id },
            include: { cart: true }
        });

        if (!cartItem || cartItem.cart.userId !== userId) {
            return res.status(404).json({ error: "Cart item not found" });
        }

        const variant = await prisma.variant.findUnique({ where: { id: cartItem.variantId } });

        if (variant && variant.stockQuantity < quantity) {
            return res.status(400).json({ error: "Not enough stock" });
        }

        const updatedItem = await prisma.cartItem.update({
            where: { id },
            data: { quantity }
        });

        res.json({ cartItem: updatedItem });

    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Something went wrong" });
    }

});

app.delete("/cart/items/:id", requireAuth, async (req, res) => {
    const userId = (req as any).user.userId;
    const id = req.params.id;

    if (!id || Array.isArray(id)) return res.status(400).json({ error: "Invalid id" });

    try {
        const cartItem = await prisma.cartItem.findUnique({
            where: { id },
            include: { cart: true }
        });

        if (!cartItem || cartItem.cart.userId !== userId) {
            return res.status(404).json({ error: "Cart item not found" });
        }

        await prisma.cartItem.delete({ where: { id } });

        res.json({ message: "Item removed from cart" });

    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Something went wrong" });
    }
});

const PHONE_REGEX = /^[6-9][0-9]{9}$/;
const PINCODE_REGEX = /^[1-9][0-9]{5}$/;
const RESERVATION_MINUTES = Number(process.env.RESERVATION_MINUTES) || 15;
const CLEANUP_INTERVAL_MINUTES = 1;

// A pending order is a snapshot of the cart taken when checkout started.
// If the cart has changed since, that snapshot is stale and must be rebuilt.
function sameContents(
    orderItems: { variantId: string; quantity: number }[],
    cartItems: { variantId: string; quantity: number }[]
) {
    if (orderItems.length !== cartItems.length) return false;

    const key = (items: { variantId: string; quantity: number }[]) =>
        items.map((i) => `${i.variantId}:${i.quantity}`).sort().join("|");

    return key(orderItems) === key(cartItems);
}

app.post("/checkout", requireAuth, async (req, res) => {
    const userId = (req as any).user.userId;
    const { fullName, phone, addressLine1, addressLine2, city, state, pincode } = req.body;

    if (!fullName || !addressLine1 || !city || !state) {
        return res.status(400).json({ error: "Please fill in all address fields" });
    }

    if (!PHONE_REGEX.test(String(phone))) {
        return res.status(400).json({ error: "Enter a valid 10-digit phone number" });
    }

    if (!PINCODE_REGEX.test(String(pincode))) {
        return res.status(400).json({ error: "Enter a valid 6-digit pincode" });
    }

    if (!isServiceablePincode(String(pincode))) {
        return res.status(400).json({ error: "Sorry, we don't deliver to this pincode yet" });
    }

    try {
        await releaseExpiredReservations();

        const cart = await prisma.cart.findUnique({
            where: { userId },
            include: {
                items: {
                    include: {
                        variant: { include: { product: true } }
                    }
                }
            }
        });

        const cartItems = cart?.items ?? [];

        const existingOrder = await prisma.order.findFirst({
            where: {
                userId,
                status: "PENDING",
                reservedUntil: { gt: new Date() }
            },
            include: { items: true }
        });

        if (existingOrder) {
            if (cartItems.length > 0 && !sameContents(existingOrder.items, cartItems)) {
                // The cart changed after checkout started, so the reservation
                // no longer matches what the customer expects to buy. Give the
                // stale stock back and build a fresh order below.
                await cancelAndReleaseStock(existingOrder);
            } else {
                const updatedOrder = await prisma.order.update({
                    where: { id: existingOrder.id },
                    data: {
                        fullName,
                        phone: String(phone),
                        addressLine1,
                        addressLine2: addressLine2 || null,
                        city,
                        state,
                        pincode: String(pincode)
                    },
                    include: { items: true }
                });

                return res.json({ order: updatedOrder });
            }
        }

        if (cartItems.length === 0) {
            return res.status(400).json({ error: "Your cart is empty" });
        }

        const order = await prisma.$transaction(async (tx) => {
            const orderItems: { variantId: string; quantity: number; price: number }[] = [];
            let totalAmount = 0;

            for (const item of cartItems) {
                const reserved = await tx.variant.updateMany({
                    where: { id: item.variantId, stockQuantity: { gte: item.quantity } },
                    data: { stockQuantity: { decrement: item.quantity } }
                });

                if (reserved.count === 0) {
                    throw new Error(`OUT_OF_STOCK:${item.variant.product.name} (${item.variant.size})`);
                }

                const price = item.variant.priceOverride ?? item.variant.product.basePrice;
                totalAmount += price * item.quantity;

                orderItems.push({ variantId: item.variantId, quantity: item.quantity, price });
            }

            return tx.order.create({
                data: {
                    userId,
                    totalAmount,
                    fullName,
                    phone: String(phone),
                    addressLine1,
                    addressLine2: addressLine2 || null,
                    city,
                    state,
                    pincode: String(pincode),
                    reservedUntil: new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000),
                    items: { create: orderItems }
                },
                include: { items: true }
            });
        });

        res.json({ order });

    } catch (err) {
        if (err instanceof Error && err.message.startsWith("OUT_OF_STOCK:")) {
            return res.status(409).json({
                error: `Sorry, ${err.message.replace("OUT_OF_STOCK:", "")} just went out of stock`
            });
        }
        console.log(err);
        res.status(500).json({ error: "Something went wrong" });
    }
});

app.get("/health", (req, res) => {
    res.json({
        status: "ok"
    })
})


setInterval(() => {
    releaseExpiredReservations().catch((err) => console.log("Reservation cleanup failed", err));
}, CLEANUP_INTERVAL_MINUTES * 60 * 1000);

app.listen(process.env.PORT || 4000, () => {
    console.log(`Server Running On Port ${process.env.PORT || 4000}`);
})