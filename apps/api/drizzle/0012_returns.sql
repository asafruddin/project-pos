CREATE TABLE "sale_returns" (
	"return_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"refund_amount_minor" integer,
	"refunded_at" timestamp with time zone,
	"refunded_by" uuid,
	"exchange_sale_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sale_returns_status_check" CHECK ("status" IN ('open', 'refunded'))
);

CREATE TABLE "sale_return_lines" (
	"return_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"qty" integer NOT NULL,
	"decision" text NOT NULL,
	CONSTRAINT "sale_return_lines_return_id_product_id_pk" PRIMARY KEY("return_id","product_id"),
	CONSTRAINT "sale_return_lines_qty_check" CHECK ("qty" >= 1),
	CONSTRAINT "sale_return_lines_decision_check" CHECK ("decision" IN ('resellable', 'damaged', 'warranty'))
);

ALTER TABLE "sale_returns" ADD CONSTRAINT "sale_returns_sale_id_sales_sale_id_fk" FOREIGN KEY ("sale_id") REFERENCES "sales"("sale_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "sale_returns" ADD CONSTRAINT "sale_returns_exchange_sale_id_sales_sale_id_fk" FOREIGN KEY ("exchange_sale_id") REFERENCES "sales"("sale_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "sale_return_lines" ADD CONSTRAINT "sale_return_lines_return_id_sale_returns_return_id_fk" FOREIGN KEY ("return_id") REFERENCES "sale_returns"("return_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "sale_return_lines" ADD CONSTRAINT "sale_return_lines_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "products"("product_id") ON DELETE no action ON UPDATE no action;
