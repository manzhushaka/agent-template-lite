import { index, int, json, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Console authentication stays intentionally small for demos. EXTENSION: Add roles and a
 * user-role relation here when a generated project needs multiple operator personas; do not
 * put end-customer identities into this table.
 */
export const consoleUsers = mysqlTable("console_user", {
  id: int("id").autoincrement().primaryKey(),
  username: varchar("username", { length: 64 }).notNull(),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: varchar("role", { length: 40 }).notNull().default("ADMIN"),
  status: mysqlEnum("status", ["ACTIVE", "DISABLED"]).notNull().default("ACTIVE"),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [uniqueIndex("uk_console_user_username").on(table.username)]);

/** EXTENSION: Replace or extend this sample entity after the target business is confirmed. */
export const demoProducts = mysqlTable("demo_product", {
  id: int("id").autoincrement().primaryKey(),
  sku: varchar("sku", { length: 64 }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  description: text("description").notNull(),
  priceCents: int("price_cents").notNull(),
  stock: int("stock").notNull().default(0),
  status: mysqlEnum("status", ["ON_SALE", "DRAFT", "OFF_SHELF"]).notNull().default("DRAFT"),
  imageUrl: varchar("image_url", { length: 600 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
}, (table) => [uniqueIndex("uk_demo_product_sku").on(table.sku), index("idx_demo_product_status").on(table.status)]);

export const demoOrderQuotes = mysqlTable("demo_order_quote", {
  id: int("id").autoincrement().primaryKey(),
  quoteId: varchar("quote_id", { length: 64 }).notNull(),
  sessionId: varchar("session_id", { length: 128 }).notNull(),
  productId: int("product_id").notNull().references(() => demoProducts.id),
  quantity: int("quantity").notNull(),
  amountCents: int("amount_cents").notNull(),
  status: mysqlEnum("status", ["PREPARED", "CONFIRMED", "EXPIRED"]).notNull().default("PREPARED"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [uniqueIndex("uk_demo_order_quote_id").on(table.quoteId), index("idx_demo_quote_session").on(table.sessionId)]);

export const demoOrders = mysqlTable("demo_order", {
  id: int("id").autoincrement().primaryKey(),
  orderNo: varchar("order_no", { length: 64 }).notNull(),
  idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
  sessionId: varchar("session_id", { length: 128 }).notNull(),
  productId: int("product_id").notNull().references(() => demoProducts.id),
  quantity: int("quantity").notNull(),
  amountCents: int("amount_cents").notNull(),
  status: mysqlEnum("status", ["CREATED", "CANCELLED"]).notNull().default("CREATED"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
}, (table) => [
  uniqueIndex("uk_demo_order_no").on(table.orderNo),
  uniqueIndex("uk_demo_order_idempotency").on(table.idempotencyKey),
  index("idx_demo_order_session").on(table.sessionId),
]);

/** MySQL is the source of truth for knowledge lifecycle; LanceDB stores replaceable vectors. */
export const knowledgeDocuments = mysqlTable("knowledge_document", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  category: varchar("category", { length: 80 }).notNull(),
  content: text("content").notNull(),
  source: varchar("source", { length: 200 }).notNull(),
  status: mysqlEnum("status", ["DRAFT", "PUBLISHED"]).notNull().default("DRAFT"),
  version: int("version").notNull().default(1),
  indexStatus: mysqlEnum("index_status", ["PENDING", "READY", "ERROR"]).notNull().default("PENDING"),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [index("idx_knowledge_status").on(table.status, table.indexStatus)]);

export const auditLogs = mysqlTable("audit_log", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id"),
  actor: varchar("actor", { length: 100 }).notNull(),
  action: varchar("action", { length: 80 }).notNull(),
  resourceType: varchar("resource_type", { length: 80 }).notNull(),
  resourceId: varchar("resource_id", { length: 100 }),
  detail: json("detail"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [index("idx_audit_created_at").on(table.createdAt)]);
