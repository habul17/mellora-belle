-- A second category, so Olive Aura stops showing "Designer Kurthi" above its
-- name. Prisma makes ids in the app; here Postgres makes one.
INSERT INTO "Category" ("id", "name", "slug")
VALUES (gen_random_uuid()::text, 'Co-ord Set', 'co-ord-set')
ON CONFLICT ("slug") DO NOTHING;

UPDATE "Product"
SET "categoryId" = (SELECT "id" FROM "Category" WHERE "slug" = 'co-ord-set')
WHERE "slug" = 'olive-aura-co-ordset';
