CREATE TABLE "products" (
	"product_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"price_minor" integer NOT NULL,
	"stock_qty" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_price_minor_nonneg" CHECK ("price_minor" >= 0),
	CONSTRAINT "products_stock_qty_nonneg" CHECK ("stock_qty" >= 0)
);
