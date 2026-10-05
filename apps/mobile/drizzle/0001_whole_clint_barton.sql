CREATE TABLE `catalog_images` (
	`product_id` text PRIMARY KEY NOT NULL,
	`image_id` text NOT NULL,
	`file_uri` text NOT NULL,
	`cached_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`customer_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`email` text,
	`notes` text,
	`group_name` text,
	`store_credit_minor` integer DEFAULT 0 NOT NULL,
	`loyalty_points` integer DEFAULT 0 NOT NULL,
	`loyalty_tier` text,
	`pulled_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `parked_carts` (
	`park_id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`lines_json` text NOT NULL,
	`total_minor` integer NOT NULL,
	`customer_name` text
);
--> statement-breakpoint
CREATE TABLE `cash_movements` (
	`movement_id` text PRIMARY KEY NOT NULL,
	`shift_id` text NOT NULL,
	`kind` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`reason` text NOT NULL,
	`occurred_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `cash_movements_shift_idx` ON `cash_movements` (`shift_id`);--> statement-breakpoint
ALTER TABLE `catalog_products` ADD `unit_conversion_json` text;--> statement-breakpoint
ALTER TABLE `sales` ADD `promotions_json` text;--> statement-breakpoint
ALTER TABLE `shifts` ADD `status` text DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE `shifts` ADD `counted_cash_minor` integer;--> statement-breakpoint
ALTER TABLE `shifts` ADD `expected_cash_minor` integer;--> statement-breakpoint
ALTER TABLE `shifts` ADD `difference_minor` integer;