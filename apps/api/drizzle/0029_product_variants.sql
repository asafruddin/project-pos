ALTER TABLE "products" ADD COLUMN "variant_label" text;
ALTER TABLE "products" ADD COLUMN "variant_group" text;
CREATE UNIQUE INDEX "products_parent_variant_label_unique" ON "products" USING btree ("parent_id", lower("variant_label")) WHERE "parent_id" IS NOT NULL AND "variant_label" IS NOT NULL;

CREATE TABLE "variant_groups" (
  "variant_group_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL,
  "name" text NOT NULL,
  "options" text[] DEFAULT '{}' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "variant_groups" ADD CONSTRAINT "variant_groups_store_id_stores_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("store_id");
CREATE UNIQUE INDEX "variant_groups_store_name_unique" ON "variant_groups" USING btree ("store_id","name");
