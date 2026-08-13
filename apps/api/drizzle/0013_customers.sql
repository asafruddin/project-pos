CREATE TABLE "customers" (
	"customer_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"notes" text,
	"group_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_name_check" CHECK (char_length(trim("name")) > 0),
	CONSTRAINT "customers_contact_check" CHECK (
		("phone" IS NOT NULL AND char_length(trim("phone")) > 0)
		OR ("email" IS NOT NULL AND char_length(trim("email")) > 0)
	)
);

CREATE INDEX "customers_phone_idx" ON "customers" ("phone");
CREATE INDEX "customers_name_idx" ON "customers" ("name");

ALTER TABLE "sales" ADD COLUMN "customer_id" uuid;
CREATE INDEX "sales_customer_id_idx" ON "sales" ("customer_id");
