ALTER TABLE "purchase_orders" ADD COLUMN "invoice_ref" text;
ALTER TABLE "purchase_orders" ADD COLUMN "payment_status" text DEFAULT 'unpaid' NOT NULL;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_payment_status_check" CHECK ("payment_status" IN ('unpaid', 'partial', 'paid'));

CREATE TABLE "goods_receipts" (
	"receipt_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"po_id" uuid NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "goods_receipt_lines" (
	"receipt_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"qty" integer NOT NULL,
	CONSTRAINT "goods_receipt_lines_receipt_id_product_id_pk" PRIMARY KEY("receipt_id","product_id"),
	CONSTRAINT "goods_receipt_lines_qty_check" CHECK ("qty" >= 1)
);

ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_po_id_purchase_orders_po_id_fk" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("po_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_receipt_id_goods_receipts_receipt_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "goods_receipts"("receipt_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "products"("product_id") ON DELETE no action ON UPDATE no action;
