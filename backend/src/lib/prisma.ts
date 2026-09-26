import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg"
import dotenv from "dotenv"

dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })

export const prisma = new PrismaClient({
    adapter,
    // Prisma's defaults give a transaction 2s to get a connection and 5s to
    // finish. Opening a fresh connection to Neon took ~3s from the laptop, so
    // two payment confirmations arriving together failed purely on waiting.
    // Waiting a few seconds longer is always better than failing a payment.
    transactionOptions: { maxWait: 10_000, timeout: 15_000 }
});
