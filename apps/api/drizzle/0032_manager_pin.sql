ALTER TABLE "stores" ADD COLUMN "manager_pin_hash" text;
ALTER TABLE "stores" ADD COLUMN "manager_pin_salt" text;
ALTER TABLE "stores" ADD COLUMN "manager_pin_iterations" integer;
