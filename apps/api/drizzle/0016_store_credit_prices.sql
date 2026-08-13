ALTER TABLE "customers" ADD COLUMN "store_credit_minor" integer DEFAULT 0 NOT NULL;
ALTER TABLE "customers" ADD CONSTRAINT "customers_store_credit_check" CHECK ("store_credit_minor" >= 0);

CREATE TABLE "customer_prices" (
	"customer_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"price_minor" integer NOT NULL,
	CONSTRAINT "customer_prices_customer_id_product_id_pk" PRIMARY KEY("customer_id","product_id"),
	CONSTRAINT "customer_prices_price_check" CHECK ("price_minor" >= 0)
);

CREATE TABLE "customer_group_prices" (
	"group_name" text NOT NULL,
	"product_id" uuid NOT NULL,
	"price_minor" integer NOT NULL,
	CONSTRAINT "customer_group_prices_group_name_product_id_pk" PRIMARY KEY("group_name","product_id"),
	CONSTRAINT "customer_group_prices_name_check" CHECK (char_length(trim("group_name")) > 0),
	CONSTRAINT "customer_group_prices_price_check" CHECK ("price_minor" >= 0)
);

ALTER TABLE "customer_prices" ADD CONSTRAINT "customer_prices_customer_id_customers_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "customers"("customer_id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "customer_prices" ADD CONSTRAINT "customer_prices_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "products"("product_id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "customer_group_prices" ADD CONSTRAINT "customer_group_prices_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "products"("product_id") ON DELETE cascade ON UPDATE no action;
