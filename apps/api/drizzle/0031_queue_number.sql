ALTER TABLE "sales" ADD COLUMN "queue_number" integer;
ALTER TABLE "stores" ADD COLUMN "queue_reset_mode" text DEFAULT 'daily' NOT NULL;
ALTER TABLE "stores" ADD COLUMN "queue_reset_at" timestamp with time zone;
ALTER TABLE "stores" ADD CONSTRAINT "stores_queue_reset_mode_check" CHECK ("queue_reset_mode" in ('daily', 'shift', 'manual'));
