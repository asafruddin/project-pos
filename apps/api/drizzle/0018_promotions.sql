CREATE TABLE "promotions" (
	"promotion_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"kind" text NOT NULL,
	"percent_bps" integer,
	"fixed_minor" integer,
	"coupon_code" text,
	"exclusive" boolean DEFAULT false NOT NULL,
	"min_subtotal_minor" integer,
	"customer_group" text,
	"product_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"hour_start" integer,
	"hour_end" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promotions_kind_check" CHECK ("kind" IN ('percent', 'fixed'))
);

ALTER TABLE "promotions" ADD CONSTRAINT "promotions_store_id_stores_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("store_id") ON DELETE no action ON UPDATE no action;

CREATE TABLE "vouchers" (
	"voucher_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"remaining_minor" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vouchers_code_unique" UNIQUE("code"),
	CONSTRAINT "vouchers_remaining_check" CHECK ("remaining_minor" >= 0)
);

ALTER TABLE "sales" ADD COLUMN "promotions" jsonb;
