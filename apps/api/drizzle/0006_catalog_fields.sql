CREATE TABLE "categories" (
	"category_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name")
);

CREATE TABLE "brands" (
	"brand_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brands_name_unique" UNIQUE("name")
);

ALTER TABLE "products"
	ADD COLUMN "sku" text,
	ADD COLUMN "barcode" text,
	ADD COLUMN "description" text,
	ADD COLUMN "status" text DEFAULT 'active' NOT NULL,
	ADD COLUMN "cost_minor" integer,
	ADD COLUMN "compare_at_minor" integer,
	ADD COLUMN "min_qty" integer,
	ADD COLUMN "max_qty" integer,
	ADD COLUMN "track_stock" boolean DEFAULT true NOT NULL,
	ADD COLUMN "parent_id" uuid,
	ADD COLUMN "category_id" uuid,
	ADD COLUMN "brand_id" uuid,
	ADD COLUMN "tags" text[] DEFAULT '{}'::text[] NOT NULL;

ALTER TABLE "products" ADD CONSTRAINT "products_status_check" CHECK ("status" IN ('active', 'inactive'));
ALTER TABLE "products" ADD CONSTRAINT "products_cost_minor_nonneg" CHECK ("cost_minor" IS NULL OR "cost_minor" >= 0);
ALTER TABLE "products" ADD CONSTRAINT "products_compare_at_minor_nonneg" CHECK ("compare_at_minor" IS NULL OR "compare_at_minor" >= 0);
ALTER TABLE "products" ADD CONSTRAINT "products_parent_id_products_product_id_fk" FOREIGN KEY ("parent_id") REFERENCES "products"("product_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "categories"("category_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_brands_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "brands"("brand_id") ON DELETE no action ON UPDATE no action;
CREATE UNIQUE INDEX "products_sku_unique" ON "products" ("sku");
