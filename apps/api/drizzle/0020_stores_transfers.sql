CREATE TABLE "store_prices" (
	"store_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"price_minor" integer,
	CONSTRAINT "store_prices_store_id_product_id_pk" PRIMARY KEY("store_id","product_id")
);
--> statement-breakpoint
ALTER TABLE "store_prices" ADD CONSTRAINT "store_prices_store_id_stores_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("store_id");
--> statement-breakpoint
ALTER TABLE "store_prices" ADD CONSTRAINT "store_prices_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "products"("product_id");
--> statement-breakpoint
CREATE TABLE "stock_transfers" (
	"transfer_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_store_id" uuid NOT NULL,
	"to_store_id" uuid NOT NULL,
	"status" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_transfers_status_check" CHECK ("status" IN ('draft', 'requested', 'approved', 'preparing', 'shipped', 'received', 'completed', 'cancelled'))
);
--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_from_store_id_stores_store_id_fk" FOREIGN KEY ("from_store_id") REFERENCES "stores"("store_id");
--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_to_store_id_stores_store_id_fk" FOREIGN KEY ("to_store_id") REFERENCES "stores"("store_id");
--> statement-breakpoint
CREATE TABLE "stock_transfer_lines" (
	"transfer_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"qty" integer NOT NULL,
	CONSTRAINT "stock_transfer_lines_transfer_id_product_id_pk" PRIMARY KEY("transfer_id","product_id")
);
--> statement-breakpoint
ALTER TABLE "stock_transfer_lines" ADD CONSTRAINT "stock_transfer_lines_transfer_id_stock_transfers_transfer_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "stock_transfers"("transfer_id");
--> statement-breakpoint
ALTER TABLE "stock_transfer_lines" ADD CONSTRAINT "stock_transfer_lines_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "products"("product_id");
