CREATE TABLE "stock_opnames" (
	"opname_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"status" text NOT NULL,
	"created_by" uuid,
	"decided_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	CONSTRAINT "stock_opnames_status_check" CHECK ("status" IN ('draft', 'approved', 'rejected', 'cancelled'))
);

CREATE TABLE "stock_opname_lines" (
	"opname_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"system_qty" integer NOT NULL,
	"counted_qty" integer,
	CONSTRAINT "stock_opname_lines_opname_id_product_id_pk" PRIMARY KEY("opname_id","product_id")
);

ALTER TABLE "stock_opnames" ADD CONSTRAINT "stock_opnames_store_id_stores_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("store_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "stock_opname_lines" ADD CONSTRAINT "stock_opname_lines_opname_id_stock_opnames_opname_id_fk" FOREIGN KEY ("opname_id") REFERENCES "stock_opnames"("opname_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "stock_opname_lines" ADD CONSTRAINT "stock_opname_lines_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "products"("product_id") ON DELETE no action ON UPDATE no action;
