CREATE TABLE "shifts" (
	"shift_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"register_id" uuid DEFAULT '00000000-0000-4000-8000-000000000002' NOT NULL,
	"opened_at" timestamp with time zone NOT NULL,
	"opening_cash_minor" integer NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"closed_at" timestamp with time zone,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shifts_opening_cash_nonneg" CHECK ("opening_cash_minor" >= 0),
	CONSTRAINT "shifts_status_check" CHECK ("status" IN ('open', 'closed'))
);

ALTER TABLE "shifts" ADD CONSTRAINT "shifts_store_id_stores_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("store_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_register_id_registers_register_id_fk" FOREIGN KEY ("register_id") REFERENCES "registers"("register_id") ON DELETE no action ON UPDATE no action;

CREATE UNIQUE INDEX "shifts_one_open_per_register" ON "shifts" ("register_id") WHERE "status" = 'open';

ALTER TABLE "sales" ADD COLUMN "shift_id" uuid;
CREATE INDEX "sales_shift_id_idx" ON "sales" ("shift_id");
