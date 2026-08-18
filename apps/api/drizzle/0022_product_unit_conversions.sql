CREATE TABLE "product_unit_conversions" (
	"conversion_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_product_id" uuid NOT NULL,
	"to_product_id" uuid NOT NULL,
	"from_qty" integer DEFAULT 1 NOT NULL,
	"to_qty" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_unit_conversions" ADD CONSTRAINT "product_unit_conversions_from_product_id_products_product_id_fk" FOREIGN KEY ("from_product_id") REFERENCES "public"."products"("product_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "product_unit_conversions" ADD CONSTRAINT "product_unit_conversions_to_product_id_products_product_id_fk" FOREIGN KEY ("to_product_id") REFERENCES "public"."products"("product_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "product_unit_conversions_to_product_unique" ON "product_unit_conversions" USING btree ("to_product_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "product_unit_conversions_pair_unique" ON "product_unit_conversions" USING btree ("from_product_id","to_product_id");
--> statement-breakpoint
ALTER TABLE "product_unit_conversions" ADD CONSTRAINT "product_unit_conversions_from_qty_pos" CHECK ("from_qty" > 0);
--> statement-breakpoint
ALTER TABLE "product_unit_conversions" ADD CONSTRAINT "product_unit_conversions_to_qty_pos" CHECK ("to_qty" > 0);
--> statement-breakpoint
ALTER TABLE "product_unit_conversions" ADD CONSTRAINT "product_unit_conversions_not_self" CHECK ("from_product_id" <> "to_product_id");
