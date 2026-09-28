-- Orders now record the goods and the shipping separately.
ALTER TABLE "Order" ADD COLUMN "shippingCost" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "subtotal" INTEGER;

-- Every order before this change was charged no shipping, so its whole total
-- was the goods.
UPDATE "Order" SET "subtotal" = "totalAmount";

ALTER TABLE "Order" ALTER COLUMN "subtotal" SET NOT NULL;
