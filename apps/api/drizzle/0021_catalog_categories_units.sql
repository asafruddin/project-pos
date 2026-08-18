ALTER TABLE "categories" ADD COLUMN "store_id" uuid;
--> statement-breakpoint
UPDATE "categories" SET "store_id" = '00000000-0000-4000-8000-000000000001' WHERE "store_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "store_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_store_id_stores_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("store_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "categories_name_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX "categories_store_name_unique" ON "categories" USING btree ("store_id","name");
--> statement-breakpoint
CREATE TABLE "units" (
	"unit_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_store_id_stores_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("store_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "units_store_name_unique" ON "units" USING btree ("store_id","name");
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "unit_id" uuid;
--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_unit_id_units_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("unit_id") ON DELETE no action ON UPDATE no action;
