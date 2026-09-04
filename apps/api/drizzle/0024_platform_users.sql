CREATE TABLE "platform_users" (
	"platform_user_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_users_username_unique" UNIQUE("username"),
	CONSTRAINT "platform_users_role_check" CHECK ("role" IN ('super_admin'))
);
