ALTER TABLE "products" ADD COLUMN "variant_groups" text[] DEFAULT '{}' NOT NULL;
ALTER TABLE "products" ADD COLUMN "variant_values" text[] DEFAULT '{}' NOT NULL;
UPDATE "products" SET "variant_groups" = ARRAY["variant_group"] WHERE "variant_group" IS NOT NULL;
UPDATE "products" SET "variant_values" = ARRAY["variant_label"] WHERE "parent_id" IS NOT NULL AND "variant_label" IS NOT NULL;
ALTER TABLE "products" DROP COLUMN "variant_group";
