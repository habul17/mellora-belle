-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderEmailKind" ADD VALUE 'CANCELLATION_REQUESTED';
ALTER TYPE "OrderEmailKind" ADD VALUE 'RETURN_REQUESTED';
ALTER TYPE "OrderEmailKind" ADD VALUE 'ORDER_CANCELLED';
ALTER TYPE "OrderEmailKind" ADD VALUE 'CANCELLATION_DECLINED';
ALTER TYPE "OrderEmailKind" ADD VALUE 'RETURN_DECLINED';
ALTER TYPE "OrderEmailKind" ADD VALUE 'REFUND_ISSUED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderStatus" ADD VALUE 'CANCELLATION_REQUESTED';
ALTER TYPE "OrderStatus" ADD VALUE 'RETURN_REQUESTED';
ALTER TYPE "OrderStatus" ADD VALUE 'RETURNED';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cancelRequestedAt" TIMESTAMP(3),
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "refundAmount" INTEGER,
ADD COLUMN     "refundReference" TEXT,
ADD COLUMN     "refundedAt" TIMESTAMP(3),
ADD COLUMN     "requestDeclineNote" TEXT,
ADD COLUMN     "requestReason" TEXT,
ADD COLUMN     "returnRequestedAt" TIMESTAMP(3),
ADD COLUMN     "returnedAt" TIMESTAMP(3),
ADD COLUMN     "statusBeforeRequest" "OrderStatus";

