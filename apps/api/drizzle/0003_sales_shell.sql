CREATE TABLE "sales" (
	"sale_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"completed_at" timestamp with time zone NOT NULL,
	"amount_minor" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
