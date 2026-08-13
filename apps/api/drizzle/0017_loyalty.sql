CREATE TABLE "loyalty_programs" (
	"program_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"earn_per_minor" integer DEFAULT 10000 NOT NULL,
	"point_value_minor" integer DEFAULT 100 NOT NULL,
	"expire_days" integer,
	"tiers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loyalty_programs_earn_check" CHECK ("earn_per_minor" >= 1),
	CONSTRAINT "loyalty_programs_value_check" CHECK ("point_value_minor" >= 1),
	CONSTRAINT "loyalty_programs_expire_check" CHECK ("expire_days" IS NULL OR "expire_days" >= 1)
);

ALTER TABLE "loyalty_programs" ADD CONSTRAINT "loyalty_programs_store_id_stores_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("store_id") ON DELETE no action ON UPDATE no action;

INSERT INTO "loyalty_programs" (
	"program_id",
	"store_id",
	"enabled",
	"earn_per_minor",
	"point_value_minor",
	"expire_days",
	"tiers"
) VALUES (
	'00000000-0000-4000-8000-0000000000a1',
	'00000000-0000-4000-8000-000000000001',
	true,
	10000,
	100,
	NULL,
	'[{"name":"Reguler","min_lifetime_points":0,"earn_multiplier_bps":10000},{"name":"Silver","min_lifetime_points":100,"earn_multiplier_bps":12000},{"name":"Gold","min_lifetime_points":500,"earn_multiplier_bps":15000}]'::jsonb
);

CREATE TABLE "loyalty_accounts" (
	"customer_id" uuid PRIMARY KEY NOT NULL,
	"points_balance" integer DEFAULT 0 NOT NULL,
	"lifetime_earned" integer DEFAULT 0 NOT NULL,
	"tier" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loyalty_accounts_balance_check" CHECK ("points_balance" >= 0),
	CONSTRAINT "loyalty_accounts_lifetime_check" CHECK ("lifetime_earned" >= 0)
);

ALTER TABLE "loyalty_accounts" ADD CONSTRAINT "loyalty_accounts_customer_id_customers_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "customers"("customer_id") ON DELETE cascade ON UPDATE no action;

CREATE TABLE "loyalty_ledger" (
	"entry_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"points_delta" integer NOT NULL,
	"remaining_points" integer,
	"expires_at" timestamp with time zone,
	"sale_id" uuid,
	"actor_id" uuid,
	"note" text,
	"occurred_at" timestamp with time zone NOT NULL,
	CONSTRAINT "loyalty_ledger_kind_check" CHECK ("kind" IN ('earn','redeem','expire','adjust','void_earn','void_redeem'))
);

ALTER TABLE "loyalty_ledger" ADD CONSTRAINT "loyalty_ledger_customer_id_customers_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "customers"("customer_id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "loyalty_ledger_customer_id_idx" ON "loyalty_ledger" ("customer_id");
CREATE INDEX "loyalty_ledger_sale_id_idx" ON "loyalty_ledger" ("sale_id");

ALTER TABLE "sales" ADD COLUMN "loyalty" jsonb;
