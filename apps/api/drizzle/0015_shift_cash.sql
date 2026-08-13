ALTER TABLE "shifts" ADD COLUMN "counted_cash_minor" integer;
ALTER TABLE "shifts" ADD COLUMN "expected_cash_minor" integer;
ALTER TABLE "shifts" ADD COLUMN "difference_minor" integer;

CREATE TABLE "shift_cash_movements" (
	"movement_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shift_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"amount_minor" integer NOT NULL,
	"reason" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shift_cash_kind_check" CHECK ("kind" IN ('in', 'out')),
	CONSTRAINT "shift_cash_amount_check" CHECK ("amount_minor" >= 1),
	CONSTRAINT "shift_cash_reason_check" CHECK (char_length(trim("reason")) > 0)
);

ALTER TABLE "shift_cash_movements" ADD CONSTRAINT "shift_cash_movements_shift_id_shifts_shift_id_fk" FOREIGN KEY ("shift_id") REFERENCES "shifts"("shift_id") ON DELETE no action ON UPDATE no action;
CREATE INDEX "shift_cash_movements_shift_id_idx" ON "shift_cash_movements" ("shift_id");

ALTER TABLE "sale_returns" ADD COLUMN "shift_id" uuid;
CREATE INDEX "sale_returns_shift_id_idx" ON "sale_returns" ("shift_id");
