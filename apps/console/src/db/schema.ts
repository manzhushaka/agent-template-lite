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
  sourceType: mysqlEnum("source_type", ["MANUAL", "FILE", "WEB"]).notNull().default("MANUAL"),
  sourceUri: varchar("source_uri", { length: 1000 }),
  sourceHash: varchar("source_hash", { length: 64 }),
  mimeType: varchar("mime_type", { length: 120 }),
  fileName: varchar("file_name", { length: 255 }),
  fileSize: int("file_size"),
  status: mysqlEnum("status", ["DRAFT", "PUBLISHED"]).notNull().default("DRAFT"),
  version: int("version").notNull().default(1),
  indexStatus: mysqlEnum("index_status", ["PENDING", "INDEXING", "READY", "ERROR"]).notNull().default("PENDING"),
  indexError: text("index_error"),
  indexedAt: timestamp("indexed_at"),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [index("idx_knowledge_status").on(table.status, table.indexStatus)]);

/** Immutable snapshots make imported knowledge changes reviewable and reversible. */
export const knowledgeDocumentVersions = mysqlTable("knowledge_document_version", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("document_id").notNull().references(() => knowledgeDocuments.id, { onDelete: "cascade" }),
  version: int("version").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  category: varchar("category", { length: 80 }).notNull(),
  content: text("content").notNull(),
  source: varchar("source", { length: 200 }).notNull(),
  sourceType: mysqlEnum("source_type", ["MANUAL", "FILE", "WEB"]).notNull(),
  sourceUri: varchar("source_uri", { length: 1000 }),
  sourceHash: varchar("source_hash", { length: 64 }),
  mimeType: varchar("mime_type", { length: 120 }),
  fileName: varchar("file_name", { length: 255 }),
  fileSize: int("file_size"),
  status: mysqlEnum("status", ["DRAFT", "PUBLISHED"]).notNull(),
  createdBy: varchar("created_by", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("uk_knowledge_version").on(table.documentId, table.version),
  index("idx_knowledge_version_created").on(table.documentId, table.createdAt),
]);

/** Persisted jobs keep indexing failures visible and explicitly retryable. */
export const knowledgeIndexJobs = mysqlTable("knowledge_index_job", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("document_id").references(() => knowledgeDocuments.id, { onDelete: "set null" }),
  targetVersion: int("target_version"),
  status: mysqlEnum("status", ["PENDING", "RUNNING", "SUCCEEDED", "FAILED"]).notNull().default("PENDING"),
  attempts: int("attempts").notNull().default(0),
  requestedBy: varchar("requested_by", { length: 100 }).notNull(),
  lastError: text("last_error"),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [index("idx_knowledge_job_status").on(table.status, table.createdAt)]);

/** Chat remains anonymous by default, while ownership is enforced server-side per signed visitor. */
export const chatSessions = mysqlTable("chat_session", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("session_id", { length: 128 }).notNull(),
  visitorHash: varchar("visitor_hash", { length: 64 }).notNull(),
  title: varchar("title", { length: 120 }).notNull().default("新会话"),
  status: mysqlEnum("status", ["ACTIVE", "DELETED"]).notNull().default("ACTIVE"),
  lastActiveAt: timestamp("last_active_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
}, (table) => [
  uniqueIndex("uk_chat_session_id").on(table.sessionId),
  index("idx_chat_session_visitor").on(table.visitorHash, table.status, table.lastActiveAt),
]);

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
