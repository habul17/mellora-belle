import { z } from "zod"
import type { Request, Response } from "express"

// Every route reads its body through one of the schemas below. Anything the
// wrong type, too long or missing is answered with a 400 and the first
// problem's message, before any database work, so a malformed or hostile
// payload never reaches Prisma. Business rules (stock, order state, windows)
// stay in the routes and lib files.
export function readBody<S extends z.ZodType>(schema: S, req: Request, res: Response): z.infer<S> | null {
    const result = schema.safeParse(req.body ?? {});

    if (!result.success) {
        res.status(400).json({ error: result.error.issues[0]?.message ?? "Invalid request" });
        return null;
    }

    return result.data;
}

// A required piece of text: trimmed, not blank, not longer than max.
const text = (message: string, max: number, tooLong = `Must be under ${max} characters`) =>
    z.string({ error: message }).trim().min(1, message).max(max, tooLong);

// An optional piece of text; "" and a missing field both mean "none".
const optionalText = (max: number, tooLong: string) =>
    z.string({ error: tooLong }).trim().max(max, tooLong).optional();

// ---- Accounts ----

const EMAIL_MAX = 254;
// bcrypt only reads 72 bytes; the real password rules live in passwordProblem().
const PASSWORD_INPUT_MAX = 1000;

export const loginBody = z.object({
    email: text("Enter your email and password", EMAIL_MAX, "Invalid email or password"),
    password: z.string({ error: "Enter your email and password" })
        .min(1, "Enter your email and password").max(PASSWORD_INPUT_MAX, "Invalid email or password"),
    totpCode: z.string({ error: "Invalid 2FA code" }).trim().max(10, "Invalid 2FA code").optional(),
});

export const signupBody = z.object({
    email: z.string({ error: "Enter a valid email address" }).max(EMAIL_MAX, "Enter a valid email address"),
    password: z.string({ error: "Choose a password of at least 8 characters" }).max(PASSWORD_INPUT_MAX, "Use at most 72 characters"),
});

export const forgotPasswordBody = z.object({
    email: z.string({ error: "Enter your email" }).max(EMAIL_MAX, "Enter a valid email address"),
});

export const resetPasswordBody = z.object({
    token: z.string({ error: "Invalid or expired token" }).min(1, "Invalid or expired token").max(200, "Invalid or expired token"),
    newPassword: z.string({ error: "Choose a password of at least 8 characters" }).max(PASSWORD_INPUT_MAX, "Use at most 72 characters"),
});

export const twoFactorConfirmBody = z.object({
    code: z.string({ error: "Type the 6-digit code from your app" }).trim().regex(/^\d{6}$/, "Type the 6-digit code from your app"),
});

// ---- Cart and stock ----

// The most of one size anyone can have in their cart.
export const MAX_PER_ITEM = 10;

const quantity = z.number({ error: "Quantity must be a whole number" })
    .int("Quantity must be a whole number")
    .min(1, "Quantity must be at least 1")
    .max(MAX_PER_ITEM, `You can order up to ${MAX_PER_ITEM} of each item`);

export const addToCartBody = z.object({
    variantId: text("Choose a size", 64, "Variant not found"),
    quantity: quantity.default(1),
});

export const updateCartItemBody = z.object({ quantity });

const stockQuantity = z.number({ error: "Stock must be a whole number" })
    .int("Stock must be a whole number").min(0, "Stock can't be negative").max(100_000, "That's more stock than the shop can hold");

export const stockBody = z.object({ stockQuantity });

// ---- Products (admin) ----

const rupees = (message: string) =>
    z.number({ error: message }).int(message).min(1, message).max(1_000_000, "That price is too high");

// A photo already uploaded to Cloudinary: its image link, which the shop asks
// for in smaller sizes. A link to a Cloudinary page (not the image) won't do.
const PHOTO_LINK = "Each photo must be a Cloudinary image link (https://res.cloudinary.com/…/image/upload/…)";
const photoLink = z.string({ error: PHOTO_LINK }).trim().max(500, PHOTO_LINK)
    .regex(/^https:\/\/res\.cloudinary\.com\/[^/\s]+\/image\/upload\/\S+$/, PHOTO_LINK);

const size = z.enum(["S", "M", "L", "XL", "XXL"], { error: "Choose a size (S, M, L, XL or XXL)" });

const productDetails = {
    name: text("Enter the product name", 100, "The name must be under 100 characters"),
    description: text("Write a description", 5000, "The description must be under 5000 characters"),
    basePrice: rupees("Enter the price in whole rupees"),
    compareAtPrice: rupees("Enter the original price in whole rupees, or leave it blank").nullable(),
    weight: z.number({ error: "Enter the packed weight in grams" })
        .int("Enter the packed weight in grams").min(1, "Enter the packed weight in grams").max(30_000, "Use a weight under 30 kg (30000 grams)"),
    color: text("Enter the colour", 50, "The colour must be under 50 characters"),
    images: z.array(photoLink, { error: "Add at least one photo" }).min(1, "Add at least one photo").max(12, "Use at most 12 photos"),
    isActive: z.boolean({ error: "Choose whether it's on sale" }),
};

// The crossed-out price only makes sense above the real one.
const originalAbovePrice = [
    (d: { basePrice: number; compareAtPrice: number | null }) => d.compareAtPrice === null || d.compareAtPrice > d.basePrice,
    { message: "The original price must be higher than the price (or leave it blank)" },
] as const;

export const productBody = z.object(productDetails).refine(...originalAbovePrice);

export const newProductBody = z.object({
    ...productDetails,
    categoryId: text("Choose a category", 64, "Choose a category"),
    sizes: z.array(z.object({ size, stockQuantity }), { error: "Give the stock for at least one size" })
        .min(1, "Give the stock for at least one size").max(5, "Each size can only be added once"),
}).refine(...originalAbovePrice);

export const addSizeBody = z.object({ size, stockQuantity });

// ---- Checkout ----

const FILL_IN = "Please fill in all address fields";

// Keys are in the order the old checks ran, so the first message a customer
// sees is the same as before: blanks first, then phone, then pincode.
export const checkoutBody = z.object({
    fullName: text(FILL_IN, 100, "Your name must be under 100 characters"),
    addressLine1: text(FILL_IN, 200, "The address must be under 200 characters"),
    city: text(FILL_IN, 100, "The city must be under 100 characters"),
    state: text(FILL_IN, 100, "The state must be under 100 characters"),
    // Older clients sent these as numbers.
    phone: z.coerce.string().trim().regex(/^[6-9][0-9]{9}$/, "Enter a valid 10-digit phone number"),
    pincode: z.coerce.string().trim().regex(/^[1-9][0-9]{5}$/, "Enter a valid 6-digit pincode"),
    addressLine2: z.string({ error: "The second address line must be under 200 characters" })
        .trim().max(200, "The second address line must be under 200 characters").nullish(),
});

// ---- Orders ----

export const cancelRequestBody = z.object({
    reason: optionalText(500, "The reason must be under 500 characters"),
});

export const returnRequestBody = z.object({
    reason: z.string({ error: "Choose a reason for the return" }).max(100, "Choose a reason for the return"),
    details: optionalText(500, "The details must be under 500 characters"),
});

export const declineBody = z.object({
    note: z.string({ error: "Write a short note for the customer" }).max(500, "The note must be under 500 characters"),
});

export const refundBody = z.object({
    amount: z.coerce.number({ error: "Enter the amount refunded" }),
    reference: optionalText(100, "The refund reference must be under 100 characters"),
});

export const orderStatusBody = z.object({
    status: z.enum(["PACKED", "SHIPPED", "DELIVERED"], { error: "An order can't be moved to that status by hand" }),
    courierName: z.string().max(1000).optional(),
    trackingNumber: z.string().max(1000).optional(),
    trackingUrl: z.string().max(2000).optional(),
});

// ---- Razorpay webhook (read only after its signature checks out) ----

export const razorpayWebhookBody = z.object({
    event: z.string(),
    payload: z.object({
        payment: z.object({
            entity: z.object({
                id: z.string(),
                order_id: z.string(),
                amount: z.number(),
            }),
        }).optional(),
    }).optional(),
});

// ---- Shiprocket tracking webhook (read only after its token checks out) ----

export const courierWebhookBody = z.object({
    awb: z.union([z.string(), z.number()]).transform((value) => String(value).trim()).pipe(z.string().min(1).max(64)),
    current_status: z.string().max(100).optional(),
    shipment_status: z.string().max(100).optional(),
    current_timestamp: z.string().max(40).optional(),
    is_return: z.union([z.number(), z.boolean(), z.string()]).optional(),
});
