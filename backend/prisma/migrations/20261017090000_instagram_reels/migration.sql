-- Reels from the shop's Instagram, shown on the home page.
-- CreateTable
CREATE TABLE "Reel" (
    "id" TEXT NOT NULL,
    "videoUrl" TEXT NOT NULL,
    "instagramUrl" TEXT NOT NULL,
    "productId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reel_createdAt_idx" ON "Reel"("createdAt");

-- AddForeignKey
ALTER TABLE "Reel" ADD CONSTRAINT "Reel_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
