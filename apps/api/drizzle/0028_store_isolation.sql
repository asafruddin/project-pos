ALTER TABLE "products" ADD COLUMN "store_id" uuid;
UPDATE "products" SET "store_id" = '00000000-0000-4000-8000-000000000001' WHERE "store_id" IS NULL;
ALTER TABLE "products" ALTER COLUMN "store_id" SET NOT NULL;
ALTER TABLE "products" ADD CONSTRAINT "products_store_id_stores_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("store_id");
DROP INDEX IF EXISTS "products_sku_unique";
CREATE UNIQUE INDEX "products_store_sku_unique" ON "products" USING btree ("store_id","sku");

ALTER TABLE "customers" ADD COLUMN "store_id" uuid;
UPDATE "customers" SET "store_id" = '00000000-0000-4000-8000-000000000001' WHERE "store_id" IS NULL;
ALTER TABLE "customers" ALTER COLUMN "store_id" SET NOT NULL;
ALTER TABLE "customers" ADD CONSTRAINT "customers_store_id_stores_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("store_id");

ALTER TABLE "brands" ADD COLUMN "store_id" uuid;
UPDATE "brands" SET "store_id" = '00000000-0000-4000-8000-000000000001' WHERE "store_id" IS NULL;
ALTER TABLE "brands" ALTER COLUMN "store_id" SET NOT NULL;
ALTER TABLE "brands" ADD CONSTRAINT "brands_store_id_stores_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("store_id");
ALTER TABLE "brands" DROP CONSTRAINT IF EXISTS "brands_name_unique";
CREATE UNIQUE INDEX "brands_store_name_unique" ON "brands" USING btree ("store_id","name");

ALTER TABLE "suppliers" ADD COLUMN "store_id" uuid;
UPDATE "suppliers" SET "store_id" = '00000000-0000-4000-8000-000000000001' WHERE "store_id" IS NULL;
ALTER TABLE "suppliers" ALTER COLUMN "store_id" SET NOT NULL;
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_store_id_stores_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("store_id");

ALTER TABLE "vouchers" ADD COLUMN "store_id" uuid;
UPDATE "vouchers" SET "store_id" = '00000000-0000-4000-8000-000000000001' WHERE "store_id" IS NULL;
ALTER TABLE "vouchers" ALTER COLUMN "store_id" SET NOT NULL;
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_store_id_stores_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("store_id");
ALTER TABLE "vouchers" DROP CONSTRAINT IF EXISTS "vouchers_code_unique";
CREATE UNIQUE INDEX "vouchers_store_code_unique" ON "vouchers" USING btree ("store_id","code");
