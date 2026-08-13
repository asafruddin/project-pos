CREATE TABLE "suppliers" (
	"supplier_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"contact_name" text,
	"phone" text,
	"email" text,
	"payment_terms" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "supplier_products" (
	"supplier_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"cost_minor" integer,
	CONSTRAINT "supplier_products_supplier_id_product_id_pk" PRIMARY KEY("supplier_id","product_id")
);

CREATE TABLE "purchase_orders" (
	"po_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"status" text NOT NULL,
	"created_by" uuid,
	"submitted_at" timestamp with time zone,
	"submitted_by" uuid,
	"approved_at" timestamp with time zone,
	"approved_by" uuid,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_orders_status_check" CHECK ("status" IN ('draft', 'submitted', 'approved', 'partially_received', 'completed', 'cancelled'))
);

CREATE TABLE "purchase_order_lines" (
	"po_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"qty" integer NOT NULL,
	"cost_minor" integer NOT NULL,
	"received_qty" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "purchase_order_lines_po_id_product_id_pk" PRIMARY KEY("po_id","product_id"),
	CONSTRAINT "purchase_order_lines_qty_check" CHECK ("qty" >= 1),
	CONSTRAINT "purchase_order_lines_cost_check" CHECK ("cost_minor" >= 0),
	CONSTRAINT "purchase_order_lines_received_check" CHECK ("received_qty" >= 0)
);

ALTER TABLE "supplier_products" ADD CONSTRAINT "supplier_products_supplier_id_suppliers_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("supplier_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "supplier_products" ADD CONSTRAINT "supplier_products_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "products"("product_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_store_id_stores_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("store_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_suppliers_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("supplier_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_po_id_purchase_orders_po_id_fk" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("po_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "products"("product_id") ON DELETE no action ON UPDATE no action;
