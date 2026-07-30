CREATE TABLE `chat_session` (
	`id` int AUTO_INCREMENT NOT NULL,
	`session_id` varchar(128) NOT NULL,
	`visitor_hash` varchar(64) NOT NULL,
	`title` varchar(120) NOT NULL DEFAULT '新会话',
	`status` enum('ACTIVE','DELETED') NOT NULL DEFAULT 'ACTIVE',
	`last_active_at` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chat_session_id` PRIMARY KEY(`id`),
	CONSTRAINT `uk_chat_session_id` UNIQUE(`session_id`)
);
--> statement-breakpoint
CREATE TABLE `knowledge_document_version` (
	`id` int AUTO_INCREMENT NOT NULL,
	`document_id` int NOT NULL,
	`version` int NOT NULL,
	`title` varchar(200) NOT NULL,
	`category` varchar(80) NOT NULL,
	`content` text NOT NULL,
	`source` varchar(200) NOT NULL,
	`source_type` enum('MANUAL','FILE','WEB') NOT NULL,
	`source_uri` varchar(1000),
	`source_hash` varchar(64),
	`mime_type` varchar(120),
	`file_name` varchar(255),
	`file_size` int,
	`status` enum('DRAFT','PUBLISHED') NOT NULL,
	`created_by` varchar(100) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `knowledge_document_version_id` PRIMARY KEY(`id`),
	CONSTRAINT `uk_knowledge_version` UNIQUE(`document_id`,`version`)
);
--> statement-breakpoint
CREATE TABLE `knowledge_index_job` (
	`id` int AUTO_INCREMENT NOT NULL,
	`document_id` int,
	`target_version` int,
	`status` enum('PENDING','RUNNING','SUCCEEDED','FAILED') NOT NULL DEFAULT 'PENDING',
	`attempts` int NOT NULL DEFAULT 0,
	`requested_by` varchar(100) NOT NULL,
	`last_error` text,
	`started_at` timestamp,
	`finished_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `knowledge_index_job_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `knowledge_document` MODIFY COLUMN `index_status` enum('PENDING','INDEXING','READY','ERROR') NOT NULL DEFAULT 'PENDING';--> statement-breakpoint
ALTER TABLE `knowledge_document` ADD `source_type` enum('MANUAL','FILE','WEB') DEFAULT 'MANUAL' NOT NULL;--> statement-breakpoint
ALTER TABLE `knowledge_document` ADD `source_uri` varchar(1000);--> statement-breakpoint
ALTER TABLE `knowledge_document` ADD `source_hash` varchar(64);--> statement-breakpoint
ALTER TABLE `knowledge_document` ADD `mime_type` varchar(120);--> statement-breakpoint
ALTER TABLE `knowledge_document` ADD `file_name` varchar(255);--> statement-breakpoint
ALTER TABLE `knowledge_document` ADD `file_size` int;--> statement-breakpoint
ALTER TABLE `knowledge_document` ADD `index_error` text;--> statement-breakpoint
ALTER TABLE `knowledge_document` ADD `indexed_at` timestamp;--> statement-breakpoint
ALTER TABLE `knowledge_document_version` ADD CONSTRAINT `knowledge_document_version_document_id_knowledge_document_id_fk` FOREIGN KEY (`document_id`) REFERENCES `knowledge_document`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `knowledge_index_job` ADD CONSTRAINT `knowledge_index_job_document_id_knowledge_document_id_fk` FOREIGN KEY (`document_id`) REFERENCES `knowledge_document`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_chat_session_visitor` ON `chat_session` (`visitor_hash`,`status`,`last_active_at`);--> statement-breakpoint
CREATE INDEX `idx_knowledge_version_created` ON `knowledge_document_version` (`document_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_knowledge_job_status` ON `knowledge_index_job` (`status`,`created_at`);
--> statement-breakpoint
INSERT INTO `knowledge_document_version` (
	`document_id`, `version`, `title`, `category`, `content`, `source`, `source_type`, `source_uri`,
	`source_hash`, `mime_type`, `file_name`, `file_size`, `status`, `created_by`, `created_at`
)
SELECT
	`id`, `version`, `title`, `category`, `content`, `source`, `source_type`, `source_uri`,
	`source_hash`, `mime_type`, `file_name`, `file_size`, `status`, 'migration', `created_at`
FROM `knowledge_document`;
