CREATE TABLE `audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int,
	`actor` varchar(100) NOT NULL,
	`action` varchar(80) NOT NULL,
	`resource_type` varchar(80) NOT NULL,
	`resource_id` varchar(100),
	`detail` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `console_user` (
	`id` int AUTO_INCREMENT NOT NULL,
	`username` varchar(64) NOT NULL,
	`display_name` varchar(100) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`role` varchar(40) NOT NULL DEFAULT 'ADMIN',
	`status` enum('ACTIVE','DISABLED') NOT NULL DEFAULT 'ACTIVE',
	`last_login_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `console_user_id` PRIMARY KEY(`id`),
	CONSTRAINT `uk_console_user_username` UNIQUE(`username`)
);
--> statement-breakpoint
CREATE TABLE `demo_order_quote` (
	`id` int AUTO_INCREMENT NOT NULL,
	`quote_id` varchar(64) NOT NULL,
	`session_id` varchar(128) NOT NULL,
	`product_id` int NOT NULL,
	`quantity` int NOT NULL,
	`amount_cents` int NOT NULL,
	`status` enum('PREPARED','CONFIRMED','EXPIRED') NOT NULL DEFAULT 'PREPARED',
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `demo_order_quote_id` PRIMARY KEY(`id`),
	CONSTRAINT `uk_demo_order_quote_id` UNIQUE(`quote_id`)
);
--> statement-breakpoint
CREATE TABLE `demo_order` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_no` varchar(64) NOT NULL,
	`idempotency_key` varchar(128) NOT NULL,
	`session_id` varchar(128) NOT NULL,
	`product_id` int NOT NULL,
	`quantity` int NOT NULL,
	`amount_cents` int NOT NULL,
	`status` enum('CREATED','CANCELLED') NOT NULL DEFAULT 'CREATED',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `demo_order_id` PRIMARY KEY(`id`),
	CONSTRAINT `uk_demo_order_no` UNIQUE(`order_no`),
	CONSTRAINT `uk_demo_order_idempotency` UNIQUE(`idempotency_key`)
);
--> statement-breakpoint
CREATE TABLE `demo_product` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sku` varchar(64) NOT NULL,
	`name` varchar(160) NOT NULL,
	`description` text NOT NULL,
	`price_cents` int NOT NULL,
	`stock` int NOT NULL DEFAULT 0,
	`status` enum('ON_SALE','DRAFT','OFF_SHELF') NOT NULL DEFAULT 'DRAFT',
	`image_url` varchar(600),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `demo_product_id` PRIMARY KEY(`id`),
	CONSTRAINT `uk_demo_product_sku` UNIQUE(`sku`)
);
--> statement-breakpoint
CREATE TABLE `knowledge_document` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(200) NOT NULL,
	`category` varchar(80) NOT NULL,
	`content` text NOT NULL,
	`source` varchar(200) NOT NULL,
	`status` enum('DRAFT','PUBLISHED') NOT NULL DEFAULT 'DRAFT',
	`version` int NOT NULL DEFAULT 1,
	`index_status` enum('PENDING','READY','ERROR') NOT NULL DEFAULT 'PENDING',
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `knowledge_document_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `demo_order_quote` ADD CONSTRAINT `demo_order_quote_product_id_demo_product_id_fk` FOREIGN KEY (`product_id`) REFERENCES `demo_product`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `demo_order` ADD CONSTRAINT `demo_order_product_id_demo_product_id_fk` FOREIGN KEY (`product_id`) REFERENCES `demo_product`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_audit_created_at` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_demo_quote_session` ON `demo_order_quote` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_demo_order_session` ON `demo_order` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_demo_product_status` ON `demo_product` (`status`);--> statement-breakpoint
CREATE INDEX `idx_knowledge_status` ON `knowledge_document` (`status`,`index_status`);