-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('BOOKING', 'BOOKED', 'FAILED', 'CANCELLING', 'CANCELLED');

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'BOOKING',
    "round" INTEGER NOT NULL DEFAULT 1,
    "shiprocketOrderId" TEXT,
    "shiprocketShipmentId" TEXT,
    "awb" TEXT,
    "courierName" TEXT,
    "pickupRequestedAt" TIMESTAMP(3),
    "pickupScheduledFor" TIMESTAMP(3),
    "labelUrl" TEXT,
    "bookedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "courierStatus" TEXT,
    "courierStatusAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_orderId_key" ON "Shipment"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_awb_key" ON "Shipment"("awb");

-- CreateIndex
CREATE INDEX "Shipment_status_nextAttemptAt_idx" ON "Shipment"("status", "nextAttemptAt");

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

