CREATE TABLE "sale_voids" (
	"void_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_id" uuid NOT NULL,
	"voided_at" timestamp with time zone NOT NULL,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sale_voids_sale_id_unique" UNIQUE("sale_id")
);

ALTER TABLE "sale_voids" ADD CONSTRAINT "sale_voids_sale_id_sales_sale_id_fk" FOREIGN KEY ("sale_id") REFERENCES "sales"("sale_id") ON DELETE no action ON UPDATE no action;
