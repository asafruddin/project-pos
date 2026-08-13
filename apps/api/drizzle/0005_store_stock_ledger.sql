CREATE TABLE "stores" (
	"store_id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "registers" (
	"register_id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "registers" ADD CONSTRAINT "registers_store_id_stores_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("store_id") ON DELETE no action ON UPDATE no action;

INSERT INTO "stores" ("store_id", "name")
VALUES ('00000000-0000-4000-8000-000000000001', 'Store #1')
ON CONFLICT ("store_id") DO NOTHING;

INSERT INTO "registers" ("register_id", "store_id", "name")
VALUES (
	'00000000-0000-4000-8000-000000000002',
	'00000000-0000-4000-8000-000000000001',
	'Register 1'
)
ON CONFLICT ("register_id") DO NOTHING;

CREATE TABLE "stock_movements" (
	"movement_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"qty_delta" integer NOT NULL,
	"bucket" text NOT NULL,
	"reason" text NOT NULL,
	"source_type" text NOT NULL,
	"source_id" uuid,
	"actor_id" uuid,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_movements_bucket_check" CHECK ("bucket" IN ('sellable', 'damaged', 'in_transit'))
);

ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "products"("product_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_store_id_stores_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("store_id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_stock_qty_nonneg";

ALTER TABLE "sales" ADD COLUMN "store_id" uuid;
ALTER TABLE "sales" ADD COLUMN "register_id" uuid;
UPDATE "sales"
SET
	"store_id" = '00000000-0000-4000-8000-000000000001',
	"register_id" = '00000000-0000-4000-8000-000000000002'
WHERE "store_id" IS NULL OR "register_id" IS NULL;
ALTER TABLE "sales" ALTER COLUMN "store_id" SET NOT NULL;
ALTER TABLE "sales" ALTER COLUMN "register_id" SET NOT NULL;
ALTER TABLE "sales" ALTER COLUMN "store_id" SET DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE "sales" ALTER COLUMN "register_id" SET DEFAULT '00000000-0000-4000-8000-000000000002';
ALTER TABLE "sales" ADD CONSTRAINT "sales_store_id_stores_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("store_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "sales" ADD CONSTRAINT "sales_register_id_registers_register_id_fk" FOREIGN KEY ("register_id") REFERENCES "registers"("register_id") ON DELETE no action ON UPDATE no action;

INSERT INTO "stock_movements" (
	"product_id",
	"store_id",
	"qty_delta",
	"bucket",
	"reason",
	"source_type"
)
SELECT
	p."product_id",
	'00000000-0000-4000-8000-000000000001',
	p."stock_qty",
	'sellable',
	'opening_balance',
	'cutover'
FROM "products" p
WHERE NOT EXISTS (
	SELECT 1
	FROM "stock_movements" m
	WHERE m."product_id" = p."product_id"
		AND m."source_type" = 'cutover'
		AND m."reason" = 'opening_balance'
);
