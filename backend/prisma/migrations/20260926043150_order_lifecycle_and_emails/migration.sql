-- CreateEnum
CREATE TYPE "OrderEmailKind" AS ENUM ('ORDER_CONFIRMED', 'ORDER_SHIPPED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderStatus" ADD VALUE 'PACKED';
ALTER TYPE "OrderStatus" ADD VALUE 'SHIPPED';
ALTER TYPE "OrderStatus" ADD VALUE 'DELIVERED';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "courierName" TEXT,
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "number" SERIAL NOT NULL,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "shippedAt" TIMESTAMP(3),
ADD COLUMN     "trackingNumber" TEXT,
ADD COLUMN     "trackingUrl" TEXT;

-- CreateTable
CREATE TABLE "OrderEmail" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "kind" "OrderEmailKind" NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderEmail_sentAt_nextAttemptAt_idx" ON "OrderEmail"("sentAt", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrderEmail_orderId_kind_key" ON "OrderEmail"("orderId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "Order_number_key" ON "Order"("number");

-- AddForeignKey
ALTER TABLE "OrderEmail" ADD CONSTRAINT "OrderEmail_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Hand-written below this line.

-- Existing rows took numbers 1, 2, 3... when the column was added. Those are
-- all test orders; real customers start at #1001.
ALTER SEQUENCE "Order_number_seq" RESTART WITH 1001;

-- Orders paid before this column existed: use the moment their payment was
-- marked PAID, which is the Payment row's last update.
UPDATE "Order" o
SET "paidAt" = p."updatedAt"
FROM "Payment" p
WHERE p."orderId" = o."id" AND p."status" = 'PAID' AND o."status" <> 'PENDING';
