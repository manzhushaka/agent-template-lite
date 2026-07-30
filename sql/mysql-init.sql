-- Agent Template Lite MySQL 8 initialization.
-- The Console administrator is created by `pnpm db:seed` from the local .env.
-- Do not place a fixed administrator credential in this initialization script.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE DATABASE IF NOT EXISTS `agent_demo`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;
USE `agent_demo`;

CREATE TABLE `audit_log` (
  `id` int AUTO_INCREMENT NOT NULL,
  `user_id` int,
  `actor` varchar(100) NOT NULL,
  `action` varchar(80) NOT NULL,
  `resource_type` varchar(80) NOT NULL,
  `resource_id` varchar(100),
  `detail` json,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `audit_log_id` PRIMARY KEY (`id`),
  INDEX `idx_audit_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `console_user` (
  `id` int AUTO_INCREMENT NOT NULL,
  `username` varchar(64) NOT NULL,
  `display_name` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` varchar(40) NOT NULL DEFAULT 'ADMIN',
  `status` enum('ACTIVE','DISABLED') NOT NULL DEFAULT 'ACTIVE',
  `last_login_at` timestamp,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `console_user_id` PRIMARY KEY (`id`),
  CONSTRAINT `uk_console_user_username` UNIQUE (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
  CONSTRAINT `demo_product_id` PRIMARY KEY (`id`),
  CONSTRAINT `uk_demo_product_sku` UNIQUE (`sku`),
  INDEX `idx_demo_product_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
  CONSTRAINT `demo_order_quote_id` PRIMARY KEY (`id`),
  CONSTRAINT `uk_demo_order_quote_id` UNIQUE (`quote_id`),
  CONSTRAINT `demo_order_quote_product_id_demo_product_id_fk`
    FOREIGN KEY (`product_id`) REFERENCES `demo_product` (`id`),
  INDEX `idx_demo_quote_session` (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
  CONSTRAINT `demo_order_id` PRIMARY KEY (`id`),
  CONSTRAINT `uk_demo_order_no` UNIQUE (`order_no`),
  CONSTRAINT `uk_demo_order_idempotency` UNIQUE (`idempotency_key`),
  CONSTRAINT `demo_order_product_id_demo_product_id_fk`
    FOREIGN KEY (`product_id`) REFERENCES `demo_product` (`id`),
  INDEX `idx_demo_order_session` (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `knowledge_document` (
  `id` int AUTO_INCREMENT NOT NULL,
  `title` varchar(200) NOT NULL,
  `category` varchar(80) NOT NULL,
  `content` text NOT NULL,
  `source` varchar(200) NOT NULL,
  `source_type` enum('MANUAL','FILE','WEB') NOT NULL DEFAULT 'MANUAL',
  `source_uri` varchar(1000),
  `source_hash` varchar(64),
  `mime_type` varchar(120),
  `file_name` varchar(255),
  `file_size` int,
  `status` enum('DRAFT','PUBLISHED') NOT NULL DEFAULT 'DRAFT',
  `version` int NOT NULL DEFAULT 1,
  `index_status` enum('PENDING','INDEXING','READY','ERROR') NOT NULL DEFAULT 'PENDING',
  `index_error` text,
  `indexed_at` timestamp,
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `knowledge_document_id` PRIMARY KEY (`id`),
  INDEX `idx_knowledge_status` (`status`, `index_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
  CONSTRAINT `knowledge_document_version_id` PRIMARY KEY (`id`),
  CONSTRAINT `uk_knowledge_version` UNIQUE (`document_id`, `version`),
  CONSTRAINT `knowledge_document_version_document_id_knowledge_document_id_fk`
    FOREIGN KEY (`document_id`) REFERENCES `knowledge_document` (`id`) ON DELETE CASCADE,
  INDEX `idx_knowledge_version_created` (`document_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
  CONSTRAINT `knowledge_index_job_id` PRIMARY KEY (`id`),
  CONSTRAINT `knowledge_index_job_document_id_knowledge_document_id_fk`
    FOREIGN KEY (`document_id`) REFERENCES `knowledge_document` (`id`) ON DELETE SET NULL,
  INDEX `idx_knowledge_job_status` (`status`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `chat_session` (
  `id` int AUTO_INCREMENT NOT NULL,
  `session_id` varchar(128) NOT NULL,
  `visitor_hash` varchar(64) NOT NULL,
  `title` varchar(120) NOT NULL DEFAULT '新会话',
  `status` enum('ACTIVE','DELETED') NOT NULL DEFAULT 'ACTIVE',
  `last_active_at` timestamp NOT NULL DEFAULT (now()),
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `chat_session_id` PRIMARY KEY (`id`),
  CONSTRAINT `uk_chat_session_id` UNIQUE (`session_id`),
  INDEX `idx_chat_session_visitor` (`visitor_hash`, `status`, `last_active_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `__drizzle_migrations` (
  `id` serial PRIMARY KEY,
  `hash` text NOT NULL,
  `created_at` bigint
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

START TRANSACTION;

INSERT INTO `demo_product`
  (`sku`, `name`, `description`, `price_cents`, `stock`, `status`, `image_url`)
VALUES
  (
    'GIFT-TEA-001',
    '山野茶礼盒',
    '适合商务赠礼的清香型茶礼，包装克制，支持现场自提。',
    16800,
    30,
    'ON_SALE',
    'https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?auto=format&fit=crop&w=900&q=82'
  ),
  (
    'CRAFT-CUP-002',
    '手作陶瓷杯',
    '小批量手作杯，适合作为日常纪念品或轻量伴手礼。',
    8800,
    18,
    'ON_SALE',
    'https://images.unsplash.com/photo-1577937927133-66ef06acdf18?auto=format&fit=crop&w=900&q=82'
  ),
  (
    'SERVICE-BOX-003',
    '企业体验套装',
    '用于演示咨询、推荐、确认和订单闭环的组合型业务商品。',
    29900,
    12,
    'ON_SALE',
    'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=900&q=82'
  );

INSERT INTO `knowledge_document`
  (`title`, `category`, `content`, `source`, `status`, `index_status`)
VALUES (
  '演示业务服务说明',
  '业务规则',
  '演示中心中的商品用于展示智能推荐和受控下单。商品价格与库存必须以系统实时查询为准。准备报价不会创建订单或扣减库存；只有用户在 Chat 的人工确认面板明确同意后，系统才创建演示订单。演示订单不代表已经支付、发货或履约。',
  '模板种子数据',
  'PUBLISHED',
  'PENDING'
);

SET @knowledge_document_id = LAST_INSERT_ID();

INSERT INTO `knowledge_document_version`
  (`document_id`, `version`, `title`, `category`, `content`, `source`, `source_type`, `status`, `created_by`)
SELECT
  `id`, `version`, `title`, `category`, `content`, `source`, `source_type`, `status`, 'seed'
FROM `knowledge_document`
WHERE `id` = @knowledge_document_id;

INSERT INTO `__drizzle_migrations` (`hash`, `created_at`) VALUES
  ('760a2ffee5ac86324f0d8f55eb68f0fca85231a8492dde36f172dde9b1465f11', 1785291393596),
  ('90f71d17dd6b8429085d95ee1717f24eccf917d2eadb86772baea67de8e104bd', 1785333202942);

COMMIT;
