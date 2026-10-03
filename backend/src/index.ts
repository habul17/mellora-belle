import express from "express"
import dotenv from "dotenv"
import cors from "cors"
import bcrypt from "bcrypt"
import crypto from "node:crypto"
import { prisma } from "./lib/prisma.js"
import { Prisma } from "./generated/prisma/client.js"
import { requireAuth } from "./middleware/requireAuth.js"
import { requireAdmin } from "./middleware/requireAdmin.js"
import { sendEmail } from "./lib/email.js"
import { releaseExpiredReservations, cancelAndReleaseStock } from "./lib/releaseExpiredReservations.js"
import { isServiceablePincode, shippingCost, shippingZone, totalWeight } from "./lib/shipping.js"
import { getRazorpay, toPaise } from "./lib/razorpay.js"
import { markOrderPaid, reconcilePayment } from "./lib/confirmPayment.js"
import { sendQueuedOrderEmails } from "./lib/orderEmails.js"
import { orderViewInclude, adminOrderViewInclude, toOrderView, toAdminOrderView } from "./lib/orderView.js"
import { statusBefore, describeStatus } from "./lib/orderStatus.js"
import { OrderRequestError, requestCancellation, requestReturn, cancelOrder, declineRequest, markReturned, markRefunded } from "./lib/orderRequests.js"
import { normalizeEmail, isValidEmail, passwordProblem, findUserByEmail, startSession, refreshSession, endSession } from "./lib/auth.js"
import { LoginCodeError, sendLoginCode, verifyLoginCode } from "./lib/loginCodes.js"
import { authenticator } from "otplib"
import QRCode from "qrcode"
import helmet from "helmet"
import { checkEnv } from "./lib/env.js"
import { readBody, twoFactorConfirmBody, loginBody, loginCodeBody, verifyLoginCodeBody, forgotPasswordBody, resetPasswordBody, addToCartBody, updateCartItemBody, stockBody, productBody, newProductBody, addSizeBody, checkoutBody, cancelRequestBody, returnRequestBody, declineBody, refundBody, orderStatusBody, razorpayWebhookBody, courierWebhookBody, MAX_PER_ITEM } from "./lib/validate.js"
import { loginLimits, loginCodeLimits, verifyLoginCodeLimit, forgotPasswordLimits, resetPasswordLimit, refreshLimit, checkoutLimit, orderRequestLimit } from "./lib/rateLimits.js"
import { robotsTxt, sitemapXml } from "./lib/seo.js"
import { audit } from "./lib/audit.js"
import { shiprocketEnabled } from "./lib/shiprocket.js"
import { queueBooking, stopBooking, retryShipment, processShipments, processShipmentsSoon, applyCourierUpdate, parseShiprocketTime, ShipmentActionError } from "./lib/shipments.js"
import { ProductAdminError, createProduct, updateProduct, addSize, listAdminProducts } from "./lib/productAdmin.js"
import { siteOrigins, siteUrl } from "./lib/site.js"


dotenv.config();
checkEnv();

// Accept the code before and after the current one too (a 90-second window),
// so a phone clock a few seconds out doesn't lock the admin out.
authenticator.options = { window: 1 };

const app = express();

// Render puts exactly one proxy in front of the app. Trusting that one hop
// makes req.ip the visitor's address (for rate limits); trusting more would
// let a visitor pick their own address with a fake X-Forwarded-For header.
app.set("trust proxy", 1);

// Standard security headers (no sniffing, no framing, HSTS, no X-Powered-By).
app.use(helmet());

app.use(express.json({
    limit: "100kb",
    // Razorpay signs the exact bytes it sends. Re-stringifying the parsed
    // object would not reliably reproduce them, so keep the original buffer.
    verify: (req, _res, buf) => {
        (req as any).rawBody = buf;
    }
}));

// credentials: the browser may send and receive the refresh cookie, but only
// for the shop's own address(es) in FRONTEND_URL.
app.use(cors({ origin: siteOrigins(), credentials: true }))

// The refresh cookie goes along with any request to /auth, even one another
// site triggers. A custom header can't be added cross-site without a CORS
// preflight, which only FRONTEND_URL passes, so requiring it keeps other
// sites from using or ending a visitor's session.
function fromOurSite(req: express.Request) {
    return req.get("x-requested-with") === "mellora-belle";
}

// Every :id in a path is a database id (a cuid, 25 characters). Anything
// else can't match a row, so it's refused before a query is made.
app.param("id", (req, res, next, id) => {
    if (typeof id !== "string" || !/^[a-z0-9]{1,64}$/i.test(id)) {
        return res.status(404).json({ error: "Not found" });
    }
    next();
});

// Password login, for the admin only (with the authenticator code once 2FA is
// on). Customers log in with an emailed code instead, below.
app.post("/login", ...loginLimits, async (req, res) => {
    const body = readBody(loginBody, req, res);
    if (!body) return;
    const email = normalizeEmail(body.email);
    const { password } = body;

    try {
        const user = await findUserByEmail(email);

        if (!user || user.role !== "ADMIN" || !user.passwordHash) {
            return res.status(401).json({ error: "Invalid email or password" })
        }

        const passwordMatches = await bcrypt.compare(password, user.passwordHash);

        if (!passwordMatches) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        if (user.totpSecret) {
            const totpCode = body.totpCode;

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



        const accessToken = await startSession(res, user);
        res.json({ accessToken });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "something went wrong" })
    }
})

// Customer login, step 1 of 2: email a 6-digit code. Any valid email gets
// one, account or not, so this can't be used to find out who shops here.
app.post("/login-code", ...loginCodeLimits, async (req, res) => {
    const body = readBody(loginCodeBody, req, res);
    if (!body) return;
    const email = normalizeEmail(body.email);

    if (!isValidEmail(email)) {
        return res.status(400).json({ error: "Enter a valid email address" });
    }

    try {
        await sendLoginCode(email);
        res.json({ message: "Code sent" });
    } catch (err) {
        if (err instanceof LoginCodeError) {
            return res.status(err.httpStatus).json({ error: err.message });
        }
        console.log(err);
        res.status(500).json({ error: "Something went wrong" });
    }
})

// Step 2 of 2: the code logs the customer in, and the first time it also
// creates their account, so a new customer carries straight on to checkout.
app.post("/login-code/verify", verifyLoginCodeLimit, async (req, res) => {
    const body = readBody(verifyLoginCodeBody, req, res);
    if (!body) return;
    const email = normalizeEmail(body.email);

    try {
        const user = await verifyLoginCode(email, body.code);
        const accessToken = await startSession(res, user);
        res.json({ accessToken });
    } catch (err) {
        if (err instanceof LoginCodeError) {
            return res.status(err.httpStatus).json({ error: err.message });
        }
        console.log(err);
        res.status(500).json({ error: "Something went wrong" });
    }
})

app.post("/forgot-password", ...forgotPasswordLimits, async (req, res) => {
    const body = readBody(forgotPasswordBody, req, res);
    if (!body) return;
    const email = normalizeEmail(body.email);

    try {
        const user = email ? await findUserByEmail(email) : null;

        // Only the admin has a password to reset.
        if (!user || user.role !== "ADMIN") {
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

        const resetLink = `${siteUrl()}/reset-password?token=${rawToken}`;

        try {
            await sendEmail(
                user.email,
                "Reset your Mellora Belle password",
                `<p>Click the link below to reset your password. This link expires in 15 minutes.</p><a href="${resetLink}">${resetLink}</a>`
            );
        } catch (err) {
            // Logged, but answered exactly like success. An error only for
            // emails that have an account would tell anyone which emails do.
            console.log("Password reset email failed", err);
        }

        res.json({ message: "If that email exists, a reset link has been sent" })

    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Something went wrong" });
    }
})

// Trades the httpOnly refresh cookie for a fresh access token, so a customer
// isn't logged out every 15 minutes.
app.post("/auth/refresh", refreshLimit, async (req, res) => {
    if (!fromOurSite(req)) {
        return res.status(403).json({ error: "Forbidden" });
    }
    res.set("Cache-Control", "no-store");

    try {
        const accessToken = await refreshSession(req, res);
        if (!accessToken) {
            return res.status(401).json({ error: "Please log in again" });
        }
        res.json({ accessToken });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Something went wrong" });
    }
})

app.post("/auth/logout", async (req, res) => {
    if (!fromOurSite(req)) {
        return res.status(403).json({ error: "Forbidden" });
    }

    try {
        await endSession(req, res);
        res.json({ message: "Logged out" });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Something went wrong" });
    }
})

// Whether the admin's login asks for an authenticator code.
app.get("/admin/2fa", requireAuth, requireAdmin, async (req, res) => {
    const userId = (req as any).user.userId;
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { totpSecret: true } });
    res.json({ enabled: Boolean(user.totpSecret) });
})

// Step 1 of 2: a new secret to scan. It isn't used for logging in until step 2
// proves the phone has it, so a failed scan can't lock the admin out. Running
// this again (a new phone) leaves the current authenticator working until then.
app.post("/admin/2fa/setup", requireAuth, requireAdmin, async (req, res) => {
    const secret = authenticator.generateSecret();
    const userId = (req as any).user.userId;

    try {
        const user = await prisma.user.update({
            where: { id: userId },
            data: { totpPendingSecret: secret }
        });

        const otpauthUrl = authenticator.keyuri(user.email, "Mellora Belle", secret);
        const qrCodeImage = await QRCode.toDataURL(otpauthUrl);

        await audit(userId, "2fa.setup-started", "User", userId);
        res.json({ secret, qrCodeImage });

    } catch (err) {
        console.log(err);
        res.status(500).json({
            error: "Something went wrong"
        });
    }
})

// Step 2 of 2: a code from the newly scanned authenticator switches it on.
app.post("/admin/2fa/confirm", requireAuth, requireAdmin, async (req, res) => {
    const userId = (req as any).user.userId;
    const body = readBody(twoFactorConfirmBody, req, res);
    if (!body) return;

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    if (!user.totpPendingSecret) {
        return res.status(400).json({ error: "Start the set-up again: there's no new authenticator waiting to be confirmed." });
    }

    if (!authenticator.verify({ token: body.code, secret: user.totpPendingSecret })) {
        return res.status(400).json({ error: "That code didn't match. Type the newest code your app shows, and check your phone's clock is set automatically." });
    }

    // Compare-and-set, so a second confirm with a stale secret can't win.
    const switched = await prisma.user.updateMany({
        where: { id: userId, totpPendingSecret: user.totpPendingSecret },
        data: { totpSecret: user.totpPendingSecret, totpPendingSecret: null }
    });
    if (switched.count === 0) {
        return res.status(409).json({ error: "The set-up changed while you were confirming it. Please start again." });
    }

    await audit(userId, "2fa.enabled", "User", userId);
    res.json({ enabled: true });
})

app.post("/reset-password", resetPasswordLimit, async (req, res) => {
    const body = readBody(resetPasswordBody, req, res);
    if (!body) return;
    const { token, newPassword } = body;

    const problem = passwordProblem(newPassword);
    if (problem) {
        return res.status(400).json({ error: problem });
    }

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

        const reset = await prisma.$transaction(async (tx) => {
            // Claiming the token by deleting it means two clicks on the same
            // link can't both change the password.
            const claimed = await tx.passwordResetToken.deleteMany({ where: { id: resetToken.id } });
            if (claimed.count === 0) return false;

            await tx.user.update({
                where: { id: resetToken.userId },
                data: { passwordHash }
            });

            // Any other reset links sent earlier are now useless, and anyone
            // logged in with the old password is logged out everywhere.
            await tx.passwordResetToken.deleteMany({ where: { userId: resetToken.userId } });
            await tx.refreshToken.updateMany({
                where: { userId: resetToken.userId, revokedAt: null },
                data: { revokedAt: new Date() },
            });
            return true;
        });

        if (!reset) {
            return res.status(400).json({ error: "Invalid or expired token" });
        }

        res.json({ message: "Password reset Successful " })

    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Something went wrong" })
    }
})

// Only products switched on (isActive) are for sale. One that's switched off
// disappears from the shop, its page and the sitemap, but old orders keep it.
app.get("/products", async (req, res) => {

    const getProducts = await prisma.product.findMany({
        where: { isActive: true },
        include: { category: true, variants: true },
        orderBy: { name: "asc" }
    });

    res.json({
        products: getProducts
    })
})

app.get("/products/:slug", async (req, res) => {

    const getProduct = await prisma.product.findUnique({ where: { slug: req.params.slug }, include: { category: true, variants: true } });

    if (!getProduct || !getProduct.isActive) {
        return res.status(404).json({
            error: "Product not found"
        })
    }

    res.json({
        product: getProduct
    })
})

// The Stock and Products pages list every product, including ones switched off.
app.get("/admin/products", requireAuth, requireAdmin, async (req, res) => {
    const [products, categories] = await listAdminProducts();
    res.json({ products, categories });
})

// The Products page's saves: known problems go back as a message to show.
function productAdminFailed(res: express.Response, err: unknown) {
    if (err instanceof ProductAdminError) {
        return res.status(err.httpStatus).json({ error: err.message });
    }
    console.log(err);
    res.status(500).json({ error: "Something went wrong" });
}

app.post("/admin/products", requireAuth, requireAdmin, async (req, res) => {
    const body = readBody(newProductBody, req, res);
    if (!body) return;

    try {
        const product = await createProduct(body);
        await audit((req as any).user.userId, "product.create", "Product", product.id, {
            name: product.name, basePrice: product.basePrice, isActive: product.isActive,
            sizes: body.sizes.map((s) => `${s.size}:${s.stockQuantity}`),
        });
        res.status(201).json({ product });
    } catch (err) {
        productAdminFailed(res, err);
    }
})

app.patch("/admin/products/:id", requireAuth, requireAdmin, async (req, res) => {
    const body = readBody(productBody, req, res);
    if (!body) return;
    const id = req.params.id;

    if (!id || Array.isArray(id)) return res.status(400).json({ error: "Invalid id" });

    try {
        const { product, changes } = await updateProduct(id, body);
        if (Object.keys(changes).length > 0) {
            await audit((req as any).user.userId, "product.update", "Product", id, changes as Prisma.InputJsonValue);
        }
        res.json({ product });
    } catch (err) {
        productAdminFailed(res, err);
    }
})

app.post("/admin/products/:id/sizes", requireAuth, requireAdmin, async (req, res) => {
    const body = readBody(addSizeBody, req, res);
    if (!body) return;
    const id = req.params.id;

    if (!id || Array.isArray(id)) return res.status(400).json({ error: "Invalid id" });

    try {
        const variant = await addSize(id, body.size, body.stockQuantity);
        await audit((req as any).user.userId, "product.size.add", "Product", id, { size: variant.size, sku: variant.sku, stockQuantity: variant.stockQuantity });
        res.status(201).json({ variant });
    } catch (err) {
        productAdminFailed(res, err);
    }
})

app.patch("/variants/:id/stock", requireAuth, requireAdmin, async (req, res) => {
    const body = readBody(stockBody, req, res);
    if (!body) return;
    const { stockQuantity } = body;
    const id = req.params.id;

    if (!id || Array.isArray(id)) return res.status(400).json({
        error: "Invalid id"
    })

    try {
        // The number typed in replaces what's there (last save wins). With one
        // admin that's the expected behaviour; the audit log keeps the old value.
        const before = await prisma.variant.findUnique({ where: { id }, select: { stockQuantity: true } });
        const updatedVariant = await prisma.variant.update({
            where: { id },
            data: { stockQuantity }
        });
        await audit((req as any).user.userId, "stock.set", "Variant", id, { from: before?.stockQuantity ?? null, to: stockQuantity });
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
    const body = readBody(addToCartBody, req, res);
    if (!body) return;
    const { variantId, quantity } = body;

    try {
        const cart = await prisma.cart.upsert({
            where: { userId },
            update: {},
            create: { userId }
        })

        const variant = await prisma.variant.findUnique({ where: { id: variantId }, include: { product: true } });

        if (!variant || !variant.product.isActive) {
            return res.status(404).json({ error: "Sorry, this item is no longer available" });
        }

        const existingItem = await prisma.cartItem.findUnique({
            where: { cartId_variantId: { cartId: cart.id, variantId } }
        });

        const newQuantity = (existingItem?.quantity ?? 0) + quantity;

        if (newQuantity > MAX_PER_ITEM) {
            return res.status(400).json({ error: `You can order up to ${MAX_PER_ITEM} of each item` });
        }

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
    const body = readBody(updateCartItemBody, req, res);
    if (!body) return;
    const { quantity } = body;

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

        // Only more needs stock. Going down is always allowed, or a customer
        // whose size sold down below their quantity couldn't step it back.
        if (variant && quantity > cartItem.quantity && variant.stockQuantity < quantity) {
            return res.status(400).json({ error: `Only ${variant.stockQuantity} left in stock` });
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

app.post("/checkout", requireAuth, checkoutLimit, async (req, res) => {
    const userId = (req as any).user.userId;
    const body = readBody(checkoutBody, req, res);
    if (!body) return;
    const { fullName, phone, addressLine1, addressLine2, city, state, pincode } = body;

    if (!isServiceablePincode(pincode)) {
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
            include: { items: { include: { variant: { include: { product: true } } } } }
        });

        if (existingOrder) {
            const contentsChanged = cartItems.length > 0 && !sameContents(existingOrder.items, cartItems);
            // A new address can land in another shipping zone. If the payment
            // window was already opened, its Razorpay order is for the old
            // total, so the order is rebuilt rather than edited.
            const shippingChanged =
                shippingCost(totalWeight(existingOrder.items), String(pincode)) !== existingOrder.shippingCost;

            if (contentsChanged || (shippingChanged && cartItems.length > 0)) {
                // The cart or the shipping changed after checkout started, so
                // the reservation no longer matches what the customer expects
                // to pay for. Give the stale stock back and build a fresh order below.
                await cancelAndReleaseStock(existingOrder);
            } else if (shippingChanged) {
                return res.status(400).json({ error: "Your cart is empty" });
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
                });

                return res.json({ order: updatedOrder });
            }
        }

        if (cartItems.length === 0) {
            return res.status(400).json({ error: "Your cart is empty" });
        }

        const order = await prisma.$transaction(async (tx) => {
            const orderItems: { variantId: string; quantity: number; price: number }[] = [];
            let subtotal = 0;

            for (const item of cartItems) {
                // Switched off after it went into the cart.
                if (!item.variant.product.isActive) {
                    throw new Error(`UNAVAILABLE:${item.variant.product.name}`);
                }

                const reserved = await tx.variant.updateMany({
                    where: { id: item.variantId, stockQuantity: { gte: item.quantity } },
                    data: { stockQuantity: { decrement: item.quantity } }
                });

                if (reserved.count === 0) {
                    throw new Error(`OUT_OF_STOCK:${item.variant.product.name} (${item.variant.size})`);
                }

                const price = item.variant.priceOverride ?? item.variant.product.basePrice;
                subtotal += price * item.quantity;

                orderItems.push({ variantId: item.variantId, quantity: item.quantity, price });
            }

            const shipping = shippingCost(totalWeight(cartItems), String(pincode));

            return tx.order.create({
                data: {
                    userId,
                    subtotal,
                    shippingCost: shipping,
                    totalAmount: subtotal + shipping,
                    fullName,
                    phone: String(phone),
                    addressLine1,
                    addressLine2: addressLine2 || null,
                    city,
                    state,
                    pincode: String(pincode),
                    reservedUntil: new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000),
                    items: { create: orderItems }
                }
            });
        });

        res.json({ order });

    } catch (err) {
        if (err instanceof Error && err.message.startsWith("OUT_OF_STOCK:")) {
            return res.status(409).json({
                error: `Sorry, ${err.message.replace("OUT_OF_STOCK:", "")} just went out of stock`
            });
        }
        if (err instanceof Error && err.message.startsWith("UNAVAILABLE:")) {
            return res.status(409).json({
                error: `Sorry, ${err.message.replace("UNAVAILABLE:", "")} is no longer available. Please remove it from your cart.`
            });
        }
        console.log(err);
        res.status(500).json({ error: "Something went wrong" });
    }
});

app.post("/orders/:id/payment", requireAuth, checkoutLimit, async (req, res) => {
    const userId = (req as any).user.userId;
    const id = req.params.id;

    if (!id || Array.isArray(id)) return res.status(400).json({ error: "Invalid id" });

    try {
        const order = await prisma.order.findUnique({
            where: { id },
            include: { payment: true }
        });

        if (!order || order.userId !== userId) {
            return res.status(404).json({ error: "Order not found" });
        }

        if (order.status !== "PENDING") {
            return res.status(400).json({ error: "This order is no longer awaiting payment" });
        }

        if (order.reservedUntil < new Date()) {
            return res.status(400).json({ error: "Your reservation expired. Please checkout again" });
        }

        // Worked out here rather than in the browser, because a customer's
        // phone clock can be minutes off and would close the window too early.
        const expiresInSeconds = Math.floor((order.reservedUntil.getTime() - Date.now()) / 1000);

        // Re-opening the payment sheet must not create a second Razorpay order
        // against the same purchase.
        if (order.payment) {
            return res.json({
                keyId: process.env.RAZORPAY_KEY_ID,
                razorpayOrderId: order.payment.razorpayOrderId,
                amount: order.payment.amount,
                orderId: order.id,
                expiresInSeconds
            });
        }

        const amount = toPaise(order.totalAmount);

        const razorpayOrder = await getRazorpay().orders.create({
            amount,
            currency: "INR",
            receipt: order.id,
            // Take the money immediately. Left to the default, a payment can sit
            // "authorized" and never fire the payment.captured webhook.
            payment_capture: true,
            notes: { orderId: order.id }
        });

        await prisma.payment.create({
            data: {
                orderId: order.id,
                razorpayOrderId: razorpayOrder.id,
                amount
            }
        });

        res.json({
            keyId: process.env.RAZORPAY_KEY_ID,
            razorpayOrderId: razorpayOrder.id,
            amount,
            orderId: order.id,
            expiresInSeconds
        });

    } catch (err) {
        if (err instanceof Error && err.message === "RAZORPAY_KEYS_MISSING") {
            return res.status(500).json({ error: "Payments are not configured yet" });
        }
        console.log(err);
        res.status(500).json({ error: "Something went wrong" });
    }
});

// Called by the browser right after Razorpay's window reports success. The
// browser's word is never taken for it: if the webhook has not confirmed the
// payment yet, the backend asks Razorpay itself.
app.post("/orders/:id/confirm-payment", requireAuth, checkoutLimit, async (req, res) => {
    const userId = (req as any).user.userId;
    const id = req.params.id;

    if (!id || Array.isArray(id)) return res.status(400).json({ error: "Invalid id" });

    try {
        const order = await prisma.order.findUnique({
            where: { id },
            include: { payment: true }
        });

        if (!order || order.userId !== userId) {
            return res.status(404).json({ error: "Order not found" });
        }

        if (order.payment && order.payment.status !== "PAID") {
            await reconcilePayment(order.payment);
        }

        const latest = await prisma.order.findUniqueOrThrow({
            where: { id },
            include: { payment: true }
        });

        res.json({
            status: latest.status,
            paymentStatus: latest.payment?.status ?? null
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Something went wrong" });
    }
});

// A customer's order history. Only orders that were actually paid: abandoned
// checkouts that expired unpaid are not orders the customer thinks they placed.
app.get("/orders", requireAuth, async (req, res) => {
    const userId = (req as any).user.userId;

    try {
        const orders = await prisma.order.findMany({
            where: { userId, payment: { status: "PAID" } },
            include: orderViewInclude,
            orderBy: { createdAt: "desc" }
        });

        res.json({ orders: orders.map(toOrderView) });

    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Something went wrong" });
    }
});

app.get("/orders/:id", requireAuth, async (req, res) => {
    const userId = (req as any).user.userId;
    const id = req.params.id;

    if (!id || Array.isArray(id)) return res.status(400).json({ error: "Invalid id" });

    try {
        const order = await prisma.order.findUnique({ where: { id }, include: orderViewInclude });

        // Someone else's order answers exactly like a missing one, so order
        // ids can't be probed to find out which exist.
        if (!order || order.userId !== userId) {
            return res.status(404).json({ error: "Order not found" });
        }

        res.json({ order: toOrderView(order) });

    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Something went wrong" });
    }
});

const ADMIN_ORDER_LIMIT = 200;

// Every paid order, newest first, including cancelled-but-paid ones that need
// a refund. The admin page filters this list itself.
app.get("/admin/orders", requireAuth, requireAdmin, async (req, res) => {
    try {
        const orders = await prisma.order.findMany({
            where: { payment: { status: "PAID" } },
            include: adminOrderViewInclude,
            orderBy: { createdAt: "desc" },
            take: ADMIN_ORDER_LIMIT
        });

        // Whether packing an order books it with Shiprocket.
        res.json({ orders: orders.map(toAdminOrderView), shiprocket: shiprocketEnabled() });

    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Something went wrong" });
    }
});

const TRACKING_FIELD_MAX = 100;

// Moves an order one step along PAID -> PACKED -> SHIPPED -> DELIVERED.
app.patch("/admin/orders/:id/status", requireAuth, requireAdmin, async (req, res) => {
    const id = req.params.id;
    const body = readBody(orderStatusBody, req, res);
    if (!body) return;
    const { status } = body;

    if (!id || Array.isArray(id)) return res.status(400).json({ error: "Invalid id" });

    const from = statusBefore(status);

    if (!from) {
        return res.status(400).json({ error: "An order can't be moved to that status by hand" });
    }

    let tracking = {};

    if (status === "SHIPPED") {
        const courierName = (body.courierName ?? "").trim();
        const trackingNumber = (body.trackingNumber ?? "").trim();
        const trackingUrlInput = (body.trackingUrl ?? "").trim();

        if (!courierName || !trackingNumber) {
            return res.status(400).json({ error: "Enter the courier name and tracking number" });
        }

        if (courierName.length > TRACKING_FIELD_MAX || trackingNumber.length > TRACKING_FIELD_MAX) {
            return res.status(400).json({ error: "Courier name and tracking number must be under 100 characters" });
        }

        let trackingUrl: string | null = null;

        if (trackingUrlInput) {
            // The link goes into the customer's email and order page. Only a
            // real web address is allowed: "javascript:..." would run code
            // when clicked.
            let parsed: URL | null = null;
            try { parsed = new URL(trackingUrlInput); } catch { }

            if (!parsed || (parsed.protocol !== "https:" && parsed.protocol !== "http:")) {
                return res.status(400).json({ error: "The tracking link must be a web address starting with https://" });
            }

            trackingUrl = parsed.toString();
        }

        tracking = { courierName, trackingNumber, trackingUrl, shippedAt: new Date() };
    }

    try {
        const moved = await prisma.$transaction(async (tx) => {
            // Conditional on the current status, so a double-click, or two tabs
            // open on the same order, moves it one step and not two.
            const result = await tx.order.updateMany({
                where: { id, status: from },
                data: {
                    status,
                    ...tracking,
                    ...(status === "DELIVERED" && { deliveredAt: new Date() })
                }
            });

            if (result.count === 0) return false;

            if (status === "PACKED") {
                await queueBooking(tx, id);
            }

            if (status === "SHIPPED") {
                await tx.orderEmail.createMany({
                    data: [{ orderId: id, kind: "ORDER_SHIPPED" }],
                    skipDuplicates: true
                });
                // Shipped another way while a Shiprocket booking was unfinished.
                await stopBooking(tx, id, "shipped-by-hand");
            }

            return true;
        });

        if (!moved) {
            const current = await prisma.order.findUnique({ where: { id }, select: { status: true } });

            if (!current) return res.status(404).json({ error: "Order not found" });

            return res.status(409).json({
                error: `This order is ${describeStatus(current.status)} now. Refresh to see its latest state.`
            });
        }

        // Through JSON so the shipped-at date is stored as text.
        await audit((req as any).user.userId, "order.status", "Order", id, JSON.parse(JSON.stringify({ from, to: status, ...tracking })));

        if (status === "SHIPPED") {
            sendQueuedOrderEmails().catch((err) => console.log("Sending order emails failed", err));
        }
        processShipmentsSoon();

        const order = await prisma.order.findUniqueOrThrow({ where: { id }, include: adminOrderViewInclude });

        res.json({ order: toAdminOrderView(order) });

    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Something went wrong" });
    }
});

// Runs one cancellation / return / refund change and answers with the order
// as it now stands, or with the reason it couldn't be done.
// For the admin's changes, `admin` names the change for the audit log.
async function orderRequestRoute(
    req: express.Request,
    res: express.Response,
    change: (id: string) => Promise<void>,
    admin: false | { action: string; details?: Record<string, string | number | null> }
) {
    const id = req.params.id;

    if (!id || Array.isArray(id)) return res.status(400).json({ error: "Invalid id" });

    try {
        await change(id);

        if (admin) {
            await audit((req as any).user.userId, admin.action, "Order", id, admin.details ?? {});
            const order = await prisma.order.findUniqueOrThrow({ where: { id }, include: adminOrderViewInclude });
            return res.json({ order: toAdminOrderView(order) });
        }

        const order = await prisma.order.findUniqueOrThrow({ where: { id }, include: orderViewInclude });
        res.json({ order: toOrderView(order) });

    } catch (err) {
        if (err instanceof OrderRequestError) {
            return res.status(err.httpStatus).json({ error: err.message });
        }
        console.log(err);
        res.status(500).json({ error: "Something went wrong" });
    }
}

app.post("/orders/:id/cancel", requireAuth, orderRequestLimit, (req, res) => {
    const body = readBody(cancelRequestBody, req, res);
    if (!body) return;
    return orderRequestRoute(req, res, (id) => requestCancellation(id, (req as any).user.userId, body.reason), false);
});

app.post("/orders/:id/return", requireAuth, orderRequestLimit, (req, res) => {
    const body = readBody(returnRequestBody, req, res);
    if (!body) return;
    return orderRequestRoute(req, res, (id) => requestReturn(id, (req as any).user.userId, body.reason, body.details), false);
});

app.post("/admin/orders/:id/cancel", requireAuth, requireAdmin, (req, res) =>
    orderRequestRoute(req, res, (id) => cancelOrder(id), { action: "order.cancel" }));

app.post("/admin/orders/:id/decline", requireAuth, requireAdmin, (req, res) => {
    const body = readBody(declineBody, req, res);
    if (!body) return;
    return orderRequestRoute(req, res, (id) => declineRequest(id, body.note), { action: "order.decline", details: { note: body.note } });
});

app.post("/admin/orders/:id/returned", requireAuth, requireAdmin, (req, res) =>
    orderRequestRoute(req, res, (id) => markReturned(id), { action: "order.returned" }));

app.post("/admin/orders/:id/refund", requireAuth, requireAdmin, (req, res) => {
    const body = readBody(refundBody, req, res);
    if (!body) return;
    return orderRequestRoute(req, res, (id) => markRefunded(id, body.amount, body.reference),
        { action: "order.refund", details: { amount: body.amount, reference: body.reference ?? null } });
});

// Book a packed order with Shiprocket, or try again after a failure or a
// cancellation in the Shiprocket panel.
app.post("/admin/orders/:id/shipment", requireAuth, requireAdmin, async (req, res) => {
    const id = req.params.id;

    if (!id || Array.isArray(id)) return res.status(400).json({ error: "Invalid id" });

    try {
        await retryShipment(id);
        await audit((req as any).user.userId, "order.shipment.book", "Order", id);

        const order = await prisma.order.findUniqueOrThrow({ where: { id }, include: adminOrderViewInclude });
        res.json({ order: toAdminOrderView(order) });

    } catch (err) {
        if (err instanceof ShipmentActionError) {
            return res.status(err.httpStatus).json({ error: err.message });
        }
        console.log(err);
        res.status(500).json({ error: "Something went wrong" });
    }
});

// Compares two secrets in constant time, whatever their lengths.
function sameSecret(given: string, expected: string) {
    const a = crypto.createHash("sha256").update(given).digest();
    const b = crypto.createHash("sha256").update(expected).digest();
    return crypto.timingSafeEqual(a, b);
}

// Tracking updates from Shiprocket (Settings > API > Webhooks), sent with the
// token set there in the x-api-key header. The path avoids the words
// Shiprocket refuses in a webhook address ("shiprocket", "sr", "kr").
app.post("/webhooks/courier", async (req, res) => {
    const expected = process.env.SHIPROCKET_WEBHOOK_TOKEN;

    if (!expected) {
        console.log("SHIPROCKET_WEBHOOK_TOKEN is not set");
        return res.status(503).json({ error: "Webhook not configured" });
    }

    const given = req.headers["x-api-key"];

    if (typeof given !== "string" || !sameSecret(given, expected)) {
        return res.status(401).json({ error: "Invalid token" });
    }

    // Shiprocket's test message when the webhook is saved, and any update we
    // can't read, get a 200 so Shiprocket doesn't keep resending them.
    const parsed = courierWebhookBody.safeParse(req.body);
    const status = parsed.success ? (parsed.data.current_status ?? parsed.data.shipment_status) : undefined;

    if (!parsed.success || !status) {
        return res.json({ received: true });
    }

    try {
        const result = await applyCourierUpdate({
            awb: parsed.data.awb,
            status,
            at: parseShiprocketTime(parsed.data.current_timestamp),
            isReturn: [1, true, "1", "true"].includes(parsed.data.is_return as never),
        });

        res.json({ received: true, result });

    } catch (err) {
        console.log(err);
        // A 500 makes Shiprocket try again later, which is what we want if
        // our own database was briefly unavailable.
        res.status(500).json({ error: "Something went wrong" });
    }
});

app.post("/webhooks/razorpay", async (req, res) => {
    const signature = req.headers["x-razorpay-signature"];
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const rawBody = (req as any).rawBody as Buffer | undefined;

    if (!secret) {
        console.log("RAZORPAY_WEBHOOK_SECRET is not set");
        return res.status(500).json({ error: "Webhook not configured" });
    }

    if (typeof signature !== "string" || !rawBody) {
        return res.status(400).json({ error: "Missing signature" });
    }

    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    const expectedBuffer = Buffer.from(expected, "utf8");
    const signatureBuffer = Buffer.from(signature, "utf8");

    // Compared byte-by-byte in constant time. A normal === leaks how much of
    // the signature was correct through how long the comparison took, which is
    // enough to forge one guess at a time.
    if (
        expectedBuffer.length !== signatureBuffer.length ||
        !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
    ) {
        return res.status(400).json({ error: "Invalid signature" });
    }

    // Signed by Razorpay, but still checked for shape: a payload we can't read
    // is logged and acknowledged rather than crashing on a missing field.
    const parsed = razorpayWebhookBody.safeParse(req.body);
    if (!parsed.success) {
        console.log("Webhook payload in an unexpected shape", JSON.stringify(req.body).slice(0, 500));
        return res.json({ received: true });
    }

    const event = parsed.data.event;
    const entity = parsed.data.payload?.payment?.entity;

    // Anything we do not handle is still a success as far as Razorpay is
    // concerned. Answering with an error would make it retry forever.
    if ((event !== "payment.captured" && event !== "payment.failed") || !entity) {
        return res.json({ received: true });
    }

    try {
        const payment = await prisma.payment.findUnique({
            where: { razorpayOrderId: entity.order_id }
        });

        if (!payment) {
            console.log("Webhook for unknown razorpay order", entity.order_id);
            return res.json({ received: true });
        }

        if (event === "payment.failed") {
            // Deliberately does not cancel the order. The reservation expires
            // on its own, and until it does the customer can retry and get the
            // same order back.
            await prisma.payment.updateMany({
                where: { id: payment.id, status: { not: "PAID" } },
                data: { status: "FAILED", rawWebhookPayload: req.body }
            });

            return res.json({ received: true });
        }

        if (entity.amount !== payment.amount) {
            console.log(`Amount mismatch on ${payment.id}: paid ${entity.amount}, expected ${payment.amount}`);
            return res.json({ received: true });
        }

        // A duplicate delivery comes back "already-paid" and changes nothing.
        await markOrderPaid(payment.id, entity.id, req.body);

        res.json({ received: true });

    } catch (err) {
        console.log(err);
        // A 500 tells Razorpay to retry, which is what we want if our own
        // database was briefly unavailable.
        res.status(500).json({ error: "Something went wrong" });
    }
});

app.get("/health", (req, res) => {
    res.json({
        status: "ok"
    })
})

// Served on the shop's own domain through Vercel rewrites (frontend/vercel.json),
// built here because only the backend knows which products are for sale.
app.get("/robots.txt", (req, res) => {
    res.type("text/plain").send(robotsTxt());
})

app.get("/sitemap.xml", async (req, res) => {
    res.type("application/xml").send(await sitemapXml());
})

// Anything no route above matched.
app.use((req, res) => {
    res.status(404).json({ error: "Not found" });
});

// The one place errors end up: anything a route didn't catch itself, and
// Express 5 sends every rejected async handler here too. The details go to
// the logs; the visitor only ever sees a plain message, never a stack trace.
app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    const type = (err as { type?: string })?.type;

    if (type === "entity.parse.failed") {
        return res.status(400).json({ error: "The request body isn't valid JSON" });
    }
    if (type === "entity.too.large") {
        return res.status(413).json({ error: "The request is too large" });
    }

    console.error(`${req.method} ${req.path} failed:`, err);

    if (res.headersSent) return next(err);
    res.status(500).json({ error: "Something went wrong" });
});

process.on("unhandledRejection", (reason) => {
    console.error("Unhandled promise rejection:", reason);
});


setInterval(() => {
    releaseExpiredReservations().catch((err) => console.log("Reservation cleanup failed", err));
    // Retries any order email whose first send failed.
    sendQueuedOrderEmails().catch((err) => console.log("Sending queued emails failed", err));
    // Books packed orders with Shiprocket, retrying failures.
    processShipments().catch((err) => console.log("Processing shipments failed", err));
}, CLEANUP_INTERVAL_MINUTES * 60 * 1000);

app.listen(process.env.PORT || 4000, () => {
    console.log(`Server Running On Port ${process.env.PORT || 4000}`);
})