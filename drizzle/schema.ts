import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  bigint,
  float,
  boolean,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Monitor check history — last 100 records
export const monitorChecks = mysqlTable("monitor_checks", {
  id: int("id").autoincrement().primaryKey(),
  httpCode: int("http_code").notNull(),
  ttfbMs: int("ttfb_ms").notNull(),
  cacheStatus: varchar("cache_status", { length: 32 }).default("UNKNOWN"),
  cfRay: varchar("cf_ray", { length: 64 }),
  isUp: boolean("is_up").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MonitorCheck = typeof monitorChecks.$inferSelect;
export type InsertMonitorCheck = typeof monitorChecks.$inferInsert;

// Alert log
export const alertLog = mysqlTable("alert_log", {
  id: int("id").autoincrement().primaryKey(),
  alertType: mysqlEnum("alert_type", ["downtime", "high_latency", "security"]).notNull(),
  message: text("message").notNull(),
  autoFixApplied: boolean("auto_fix_applied").default(false),
  httpCode: int("http_code"),
  ttfbMs: int("ttfb_ms"),
  resolved: boolean("resolved").default(false),
  pendingPurge: boolean("pending_purge").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AlertLog = typeof alertLog.$inferSelect;
export type InsertAlertLog = typeof alertLog.$inferInsert;

// Scheduler state — tracks last/next run for each job
export const schedulerState = mysqlTable("scheduler_state", {
  id: int("id").autoincrement().primaryKey(),
  jobName: varchar("job_name", { length: 64 }).notNull().unique(),
  scheduleCronTaskUid: varchar("schedule_cron_task_uid", { length: 65 }),
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),
  lastStatus: varchar("last_status", { length: 32 }).default("pending"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SchedulerState = typeof schedulerState.$inferSelect;
export type InsertSchedulerState = typeof schedulerState.$inferInsert;

// Alert cooldown tracking
export const alertCooldown = mysqlTable("alert_cooldown", {
  id: int("id").autoincrement().primaryKey(),
  alertType: varchar("alert_type", { length: 32 }).notNull().unique(),
  lastAlertAt: timestamp("last_alert_at").defaultNow().notNull(),
  cooldownMinutes: int("cooldown_minutes").default(30).notNull(),
});

export type AlertCooldown = typeof alertCooldown.$inferSelect;

// Broken links — top 404 URLs tracked from Cloudflare analytics
export const brokenLinks = mysqlTable("broken_links", {
  id: int("id").autoincrement().primaryKey(),
  url: varchar("url", { length: 2048 }).notNull().unique(),
  hits: int("hits").notNull().default(0),
  isCritical: boolean("is_critical").notNull().default(false),
  isFixed: boolean("is_fixed").notNull().default(false),
  lastSeen: timestamp("last_seen").defaultNow().notNull(),
  firstSeen: timestamp("first_seen").defaultNow().notNull(),
});

export type BrokenLink = typeof brokenLinks.$inferSelect;
export type InsertBrokenLink = typeof brokenLinks.$inferInsert;

// Cache diagnostics — latest header analysis from the homepage
export const cacheDiagnostics = mysqlTable("cache_diagnostics", {
  id: int("id").autoincrement().primaryKey(),
  cfCacheStatus: varchar("cf_cache_status", { length: 32 }).notNull().default("UNKNOWN"),
  cacheControl: varchar("cache_control", { length: 512 }).notNull().default(""),
  vary: varchar("vary", { length: 256 }).notNull().default(""),
  wpCookiesDetected: varchar("wp_cookies_detected", { length: 512 }).notNull().default(""),
  potentialCause: varchar("potential_cause", { length: 256 }).notNull().default(""),
  checkedAt: timestamp("checked_at").defaultNow().notNull(),
});
export type CacheDiagnostic = typeof cacheDiagnostics.$inferSelect;

// Banned IPs — Protocol 1: Auto-Ban
export const bannedIPs = mysqlTable("banned_ips", {
  id: int("id").autoincrement().primaryKey(),
  ip: varchar("ip", { length: 64 }).notNull().unique(),
  count404: int("count_404").notNull().default(0),
  wafBlocked: boolean("waf_blocked").notNull().default(false),
  blockMessage: text("block_message"),
  bannedAt: timestamp("banned_at").defaultNow().notNull(),
});

export type BannedIP = typeof bannedIPs.$inferSelect;
export type InsertBannedIP = typeof bannedIPs.$inferInsert;

// CF Analytics Cache — daily snapshot fetched at 04:00 AM, reused by all reports
export const cfAnalyticsCache = mysqlTable("cf_analytics_cache", {
  id: int("id").autoincrement().primaryKey(),
  // Core traffic metrics
  totalRequests: int("total_requests").notNull().default(0),
  cachedRequests: int("cached_requests").notNull().default(0),
  bandwidth: bigint("bandwidth", { mode: "number" }).notNull().default(0),
  threats: int("threats").notNull().default(0),
  visits: int("visits").notNull().default(0),
  pageViews: int("page_views").notNull().default(0),
  cacheHitRate: int("cache_hit_rate").notNull().default(0),
  // Block rate (threats / totalRequests * 100)
  blockRate: int("block_rate").notNull().default(0),
  // 404 stats
  count404: int("count_404").notNull().default(0),
  // Top posts JSON (array of { path, count })
  topPostsJson: text("top_posts_json").notNull().default("[]"),
  countryJson: text("country_json"),
  // Window in days this snapshot covers (1=daily, 7=weekly, 30=monthly)
  windowDays: int("window_days").notNull().default(1),
  snapshotAt: timestamp("snapshot_at").defaultNow().notNull(),
});
export type CFAnalyticsCache = typeof cfAnalyticsCache.$inferSelect;
export type InsertCFAnalyticsCache = typeof cfAnalyticsCache.$inferInsert;

// Personal Agenda — daily tasks/notes entered via dashboard, used in Morning Brief
export const personalAgenda = mysqlTable("personal_agenda", {
  id: int("id").autoincrement().primaryKey(),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
  content: text("content").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type PersonalAgenda = typeof personalAgenda.$inferSelect;
export type InsertPersonalAgenda = typeof personalAgenda.$inferInsert;

// Action Log — records every automated action taken by the system (auto-ban, cache purge, under-attack, etc.)
export const actionLog = mysqlTable("action_log", {
  id: int("id").autoincrement().primaryKey(),
  actionType: varchar("action_type", { length: 64 }).notNull(), // e.g. "auto-ban", "cache-purge", "under-attack", "recovery"
  description: text("description").notNull(),
  metadata: text("metadata"), // JSON string for extra context
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type ActionLog = typeof actionLog.$inferSelect;
export type InsertActionLog = typeof actionLog.$inferInsert;

// Quality Audit Results — weekly SEO/broken-link/image scan results
export const qualityAuditResults = mysqlTable("quality_audit_results", {
  id: int("id").autoincrement().primaryKey(),
  auditType: varchar("audit_type", { length: 32 }).notNull(), // "broken-links" | "seo" | "images"
  url: varchar("url", { length: 512 }).notNull(),
  issue: text("issue").notNull(),
  severity: varchar("severity", { length: 16 }).notNull().default("warning"), // "critical" | "warning" | "info"
  isFixed: boolean("is_fixed").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type QualityAuditResult = typeof qualityAuditResults.$inferSelect;
export type InsertQualityAuditResult = typeof qualityAuditResults.$inferInsert;

// Reply Templates — editable from Dashboard (V3.4)
export const replyTemplates = mysqlTable("reply_templates", {
  id: int("id").autoincrement().primaryKey(),
  template: text("template").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type ReplyTemplate = typeof replyTemplates.$inferSelect;
export type InsertReplyTemplate = typeof replyTemplates.$inferInsert;

// Toxic Keywords — editable from Dashboard (V3.4)
export const toxicKeywords = mysqlTable("toxic_keywords", {
  id: int("id").autoincrement().primaryKey(),
  keyword: varchar("keyword", { length: 255 }).notNull(),
  category: varchar("category", { length: 64 }).notNull().default("spam"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type ToxicKeyword = typeof toxicKeywords.$inferSelect;

// WordPress DB Latency Log — V5.2 persistent latency history
export const wpDbLatencyLog = mysqlTable("wp_db_latency_log", {
  id: int("id").autoincrement().primaryKey(),
  latencyMs: int("latency_ms").notNull(),
  status: varchar("status", { length: 16 }).notNull().default("ok"), // "ok" | "slow" | "critical" | "error"
  httpCode: int("http_code").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type WpDbLatencyLog = typeof wpDbLatencyLog.$inferSelect;
export type InsertWpDbLatencyLog = typeof wpDbLatencyLog.$inferInsert;
export type InsertToxicKeyword = typeof toxicKeywords.$inferInsert;
