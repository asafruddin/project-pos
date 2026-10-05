CREATE TABLE `catalog_products` (
	`product_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`price_minor` integer NOT NULL,
	`stock_qty` integer DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`parent_id` text,
	`sku` text,
	`category_name` text,
	`unit_name` text,
	`track_stock` integer DEFAULT true NOT NULL,
	`pulled_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `kv` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `outbox` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`kind` text NOT NULL,
	`entity_id` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `outbox_id_unique` ON `outbox` (`id`);--> statement-breakpoint
CREATE INDEX `outbox_status_idx` ON `outbox` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE TABLE `print_jobs` (
	`job_id` text PRIMARY KEY NOT NULL,
	`sale_id` text,
	`payload_b64` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`created_at` integer NOT NULL,
	`printed_at` integer
);
--> statement-breakpoint
CREATE TABLE `sale_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sale_id` text NOT NULL,
	`product_id` text NOT NULL,
	`name` text NOT NULL,
	`qty` integer NOT NULL,
	`price_minor` integer NOT NULL,
	FOREIGN KEY (`sale_id`) REFERENCES `sales`(`sale_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sale_lines_sale_idx` ON `sale_lines` (`sale_id`);--> statement-breakpoint
CREATE TABLE `sales` (
	`sale_id` text PRIMARY KEY NOT NULL,
	`device_id` text NOT NULL,
	`created_at` text NOT NULL,
	`completed_at` text NOT NULL,
	`payment_method` text NOT NULL,
	`payment_amount_minor` integer NOT NULL,
	`tenders_json` text,
	`customer_id` text,
	`guest_name` text,
	`shift_id` text,
	`voided_at` text,
	`void_id` text
);
--> statement-breakpoint
CREATE INDEX `sales_completed_at_idx` ON `sales` (`completed_at`);--> statement-breakpoint
CREATE TABLE `shifts` (
	`shift_id` text PRIMARY KEY NOT NULL,
	`store_id` text,
	`register_id` text,
	`opened_at` text NOT NULL,
	`opening_cash_minor` integer NOT NULL,
	`closed_at` text
);
