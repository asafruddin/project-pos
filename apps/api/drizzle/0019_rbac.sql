ALTER TABLE "users" DROP CONSTRAINT "users_role_check";
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "active" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "store_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_check" CHECK ("role" IN ('owner', 'catalog_admin', 'store_manager', 'supervisor', 'cashier', 'inventory_staff', 'purchasing_staff'));
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_store_id_stores_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("store_id");
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role" text NOT NULL,
	"resource" text NOT NULL,
	"action" text NOT NULL,
	CONSTRAINT "role_permissions_role_resource_action_pk" PRIMARY KEY("role","resource","action")
);
