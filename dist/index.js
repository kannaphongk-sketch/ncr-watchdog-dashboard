var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// drizzle/schema.ts
import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  bigint,
  boolean
} from "drizzle-orm/mysql-core";
var users, monitorChecks, alertLog, schedulerState, alertCooldown, brokenLinks, cacheDiagnostics, bannedIPs, cfAnalyticsCache, personalAgenda, actionLog, qualityAuditResults, replyTemplates, toxicKeywords, wpDbLatencyLog;
var init_schema = __esm({
  "drizzle/schema.ts"() {
    "use strict";
    users = mysqlTable("users", {
      id: int("id").autoincrement().primaryKey(),
      openId: varchar("openId", { length: 64 }).notNull().unique(),
      name: text("name"),
      email: varchar("email", { length: 320 }),
      loginMethod: varchar("loginMethod", { length: 64 }),
      role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
      lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
    });
    monitorChecks = mysqlTable("monitor_checks", {
      id: int("id").autoincrement().primaryKey(),
      httpCode: int("http_code").notNull(),
      ttfbMs: int("ttfb_ms").notNull(),
      cacheStatus: varchar("cache_status", { length: 32 }).default("UNKNOWN"),
      cfRay: varchar("cf_ray", { length: 64 }),
      isUp: boolean("is_up").notNull().default(true),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    alertLog = mysqlTable("alert_log", {
      id: int("id").autoincrement().primaryKey(),
      alertType: mysqlEnum("alert_type", ["downtime", "high_latency", "security"]).notNull(),
      message: text("message").notNull(),
      autoFixApplied: boolean("auto_fix_applied").default(false),
      httpCode: int("http_code"),
      ttfbMs: int("ttfb_ms"),
      resolved: boolean("resolved").default(false),
      pendingPurge: boolean("pending_purge").default(false),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    schedulerState = mysqlTable("scheduler_state", {
      id: int("id").autoincrement().primaryKey(),
      jobName: varchar("job_name", { length: 64 }).notNull().unique(),
      scheduleCronTaskUid: varchar("schedule_cron_task_uid", { length: 65 }),
      lastRunAt: timestamp("last_run_at"),
      nextRunAt: timestamp("next_run_at"),
      lastStatus: varchar("last_status", { length: 32 }).default("pending"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    alertCooldown = mysqlTable("alert_cooldown", {
      id: int("id").autoincrement().primaryKey(),
      alertType: varchar("alert_type", { length: 32 }).notNull().unique(),
      lastAlertAt: timestamp("last_alert_at").defaultNow().notNull(),
      cooldownMinutes: int("cooldown_minutes").default(30).notNull()
    });
    brokenLinks = mysqlTable("broken_links", {
      id: int("id").autoincrement().primaryKey(),
      url: varchar("url", { length: 2048 }).notNull().unique(),
      hits: int("hits").notNull().default(0),
      isCritical: boolean("is_critical").notNull().default(false),
      isFixed: boolean("is_fixed").notNull().default(false),
      lastSeen: timestamp("last_seen").defaultNow().notNull(),
      firstSeen: timestamp("first_seen").defaultNow().notNull()
    });
    cacheDiagnostics = mysqlTable("cache_diagnostics", {
      id: int("id").autoincrement().primaryKey(),
      cfCacheStatus: varchar("cf_cache_status", { length: 32 }).notNull().default("UNKNOWN"),
      cacheControl: varchar("cache_control", { length: 512 }).notNull().default(""),
      vary: varchar("vary", { length: 256 }).notNull().default(""),
      wpCookiesDetected: varchar("wp_cookies_detected", { length: 512 }).notNull().default(""),
      potentialCause: varchar("potential_cause", { length: 256 }).notNull().default(""),
      checkedAt: timestamp("checked_at").defaultNow().notNull()
    });
    bannedIPs = mysqlTable("banned_ips", {
      id: int("id").autoincrement().primaryKey(),
      ip: varchar("ip", { length: 64 }).notNull().unique(),
      count404: int("count_404").notNull().default(0),
      wafBlocked: boolean("waf_blocked").notNull().default(false),
      blockMessage: text("block_message"),
      bannedAt: timestamp("banned_at").defaultNow().notNull()
    });
    cfAnalyticsCache = mysqlTable("cf_analytics_cache", {
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
      snapshotAt: timestamp("snapshot_at").defaultNow().notNull()
    });
    personalAgenda = mysqlTable("personal_agenda", {
      id: int("id").autoincrement().primaryKey(),
      date: varchar("date", { length: 10 }).notNull(),
      // YYYY-MM-DD
      content: text("content").notNull().default(""),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull()
    });
    actionLog = mysqlTable("action_log", {
      id: int("id").autoincrement().primaryKey(),
      actionType: varchar("action_type", { length: 64 }).notNull(),
      // e.g. "auto-ban", "cache-purge", "under-attack", "recovery"
      description: text("description").notNull(),
      metadata: text("metadata"),
      // JSON string for extra context
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    qualityAuditResults = mysqlTable("quality_audit_results", {
      id: int("id").autoincrement().primaryKey(),
      auditType: varchar("audit_type", { length: 32 }).notNull(),
      // "broken-links" | "seo" | "images"
      url: varchar("url", { length: 512 }).notNull(),
      issue: text("issue").notNull(),
      severity: varchar("severity", { length: 16 }).notNull().default("warning"),
      // "critical" | "warning" | "info"
      isFixed: boolean("is_fixed").notNull().default(false),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull()
    });
    replyTemplates = mysqlTable("reply_templates", {
      id: int("id").autoincrement().primaryKey(),
      template: text("template").notNull(),
      isActive: boolean("is_active").notNull().default(true),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull()
    });
    toxicKeywords = mysqlTable("toxic_keywords", {
      id: int("id").autoincrement().primaryKey(),
      keyword: varchar("keyword", { length: 255 }).notNull(),
      category: varchar("category", { length: 64 }).notNull().default("spam"),
      isActive: boolean("is_active").notNull().default(true),
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    wpDbLatencyLog = mysqlTable("wp_db_latency_log", {
      id: int("id").autoincrement().primaryKey(),
      latencyMs: int("latency_ms").notNull(),
      status: varchar("status", { length: 16 }).notNull().default("ok"),
      // "ok" | "slow" | "critical" | "error"
      httpCode: int("http_code").notNull().default(0),
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
  }
});

// server/_core/env.ts
var env_exports = {};
__export(env_exports, {
  ENV: () => ENV
});
var EXACT_TELEGRAM_IDS, ENV;
var init_env = __esm({
  "server/_core/env.ts"() {
    "use strict";
    EXACT_TELEGRAM_IDS = "8855631169,8674647124,8216202664";
    ENV = {
      cfApiToken: process.env.CF_API_TOKEN ?? "",
      cfZoneId: process.env.CF_ZONE_ID ?? "",
      tgBotToken: process.env.TELEGRAM_BOT_TOKEN ?? process.env.TG_BOT_TOKEN ?? "",
      tgChatId: EXACT_TELEGRAM_IDS,
      tgAuthorizedChatIds: EXACT_TELEGRAM_IDS,
      dashboardUrl: process.env.DASHBOARD_URL ?? process.env.FRONTEND_URL ?? "https://29bfa18a.ncr-dashboard.pages.dev",
      targetSite: "https://nakornchiangrainews.com",
      ttfbThresholdMs: 500,
      appId: process.env.VITE_APP_ID ?? "",
      cookieSecret: process.env.JWT_SECRET ?? "",
      databaseUrl: process.env.DATABASE_URL ?? "",
      oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
      ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
      isProduction: process.env.NODE_ENV === "production",
      wpSiteUrl: process.env.WP_SITE_URL ?? "https://nakornchiangrainews.com",
      wpSentinelUrl: process.env.WP_SENTINEL_URL ?? "https://nakornchiangrainews.com/wp-json/ncr/v3/monitor",
      ncrApiSecret: process.env.NCR_API_SECRET ?? "",
      wpUser: process.env.WP_USER ?? "",
      wpAppPassword: process.env.WP_APP_PASSWORD ?? "",
      forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
      forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
      googleClientEmail: process.env.GOOGLE_CLIENT_EMAIL ?? process.env.GSC_CLIENT_EMAIL ?? "",
      googlePrivateKey: (process.env.GOOGLE_PRIVATE_KEY ?? process.env.GSC_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
      googleSearchConsoleSiteUrl: process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL ?? process.env.GSC_SITE_URL ?? "https://nakornchiangrainews.com/"
    };
  }
});

// server/localWatchdogStore.ts
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
async function saveLocalMonitorCheck(check) {
  await updateStore((store) => {
    store.monitorChecks.unshift({
      id: nextId(store.monitorChecks),
      httpCode: Number(check.httpCode ?? 0),
      ttfbMs: Number(check.ttfbMs ?? 0),
      cacheStatus: check.cacheStatus ?? "UNKNOWN",
      cfRay: check.cfRay ?? "",
      isUp: Boolean(check.isUp),
      createdAt: toDate(check.createdAt).toISOString()
    });
    store.monitorChecks = store.monitorChecks.slice(0, 100);
  });
}
async function getLocalRecentChecks(limit = 100) {
  const { store } = await resolveReadableStore();
  return store.monitorChecks.slice(0, limit).map((row) => ({ ...row, createdAt: toDate(row.createdAt) }));
}
async function getLocalUptimePercent() {
  const checks = await getLocalRecentChecks(100);
  if (checks.length === 0) return 100;
  return checks.filter((check) => check.isUp).length / checks.length * 100;
}
async function getLocalAvgTtfb() {
  const checks = await getLocalRecentChecks(20);
  if (checks.length === 0) return 0;
  return Math.round(checks.reduce((sum, check) => sum + Number(check.ttfbMs || 0), 0) / checks.length);
}
async function saveLocalAlert(alert) {
  await updateStore((store) => {
    store.alerts.unshift({
      id: nextId(store.alerts),
      alertType: alert.alertType,
      message: alert.message,
      autoFixApplied: alert.autoFixApplied ?? false,
      httpCode: alert.httpCode ?? null,
      ttfbMs: alert.ttfbMs ?? null,
      resolved: alert.resolved ?? false,
      pendingPurge: alert.pendingPurge ?? false,
      createdAt: toDate(alert.createdAt).toISOString()
    });
    store.alerts = store.alerts.slice(0, 100);
  });
}
async function getLocalRecentAlerts(limit = 20) {
  const { store } = await resolveReadableStore();
  return store.alerts.slice(0, limit).map((row) => ({ ...row, createdAt: toDate(row.createdAt) }));
}
async function resolveLocalAlertPurge(id) {
  await updateStore((store) => {
    store.alerts = store.alerts.map((alert) => alert.id === id ? { ...alert, pendingPurge: false, autoFixApplied: true, resolved: true } : alert);
  });
}
async function upsertLocalBrokenLinks(entries, isCritical) {
  if (entries.length === 0) return;
  await updateStore((store) => {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    for (const entry of entries) {
      const existing = store.brokenLinks.find((row) => row.url === entry.url);
      if (existing) {
        existing.hits += Number(entry.hits || 0);
        existing.isCritical = isCritical(entry.url);
        existing.isFixed = false;
        existing.lastSeen = now;
      } else {
        store.brokenLinks.push({
          id: nextId(store.brokenLinks),
          url: entry.url,
          hits: Number(entry.hits || 0),
          isCritical: isCritical(entry.url),
          isFixed: false,
          lastSeen: now,
          firstSeen: now
        });
      }
    }
    store.brokenLinks = store.brokenLinks.sort((a, b) => b.hits - a.hits).slice(0, 100);
  });
}
async function getLocalTopBrokenLinks(limit = 20) {
  const { store } = await resolveReadableStore();
  return store.brokenLinks.filter((row) => !row.isFixed).sort((a, b) => b.hits - a.hits).slice(0, limit).map((row) => ({ ...row, firstSeen: toDate(row.firstSeen), lastSeen: toDate(row.lastSeen) }));
}
async function markLocalBrokenLinkFixed(id) {
  await updateStore((store) => {
    store.brokenLinks = store.brokenLinks.map((row) => row.id === id ? { ...row, isFixed: true } : row);
  });
}
async function getLocalActiveBrokenLinksCount() {
  const { store } = await resolveReadableStore();
  return store.brokenLinks.filter((row) => !row.isFixed).length;
}
async function getLocalCriticalBrokenLinks() {
  const links = await getLocalTopBrokenLinks(100);
  return links.filter((row) => row.isCritical);
}
async function saveLocalCacheDiagnostic(data) {
  await updateStore((store) => {
    store.cacheDiagnostics.unshift({
      id: nextId(store.cacheDiagnostics),
      ...data,
      checkedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    store.cacheDiagnostics = store.cacheDiagnostics.slice(0, 50);
  });
}
async function getLocalRecentCacheDiagnostics(limit = 20) {
  const { store } = await resolveReadableStore();
  return store.cacheDiagnostics.slice(0, limit).map((row) => ({ ...row, checkedAt: toDate(row.checkedAt) }));
}
async function getLocalLatestCacheDiagnostic() {
  const diagnostics = await getLocalRecentCacheDiagnostics(1);
  return diagnostics[0] ?? null;
}
var emptyStore, toDate, getStorePathCandidates, activeStorePath, writeChain, normalizeStore, readStoreFromPath, resolveReadableStore, writeStore, updateStore, nextId;
var init_localWatchdogStore = __esm({
  "server/localWatchdogStore.ts"() {
    "use strict";
    emptyStore = () => ({
      monitorChecks: [],
      alerts: [],
      brokenLinks: [],
      cacheDiagnostics: []
    });
    toDate = (value) => {
      if (value instanceof Date) return value;
      if (!value) return /* @__PURE__ */ new Date();
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? /* @__PURE__ */ new Date() : parsed;
    };
    getStorePathCandidates = () => {
      const configured = process.env.NCR_WATCHDOG_STORE_PATH;
      return [
        ...configured ? [configured] : [],
        path.join(process.cwd(), ".data", "ncr-watchdog-store.json"),
        path.join(os.tmpdir(), "ncr-watchdog-store.json")
      ];
    };
    activeStorePath = null;
    writeChain = Promise.resolve();
    normalizeStore = (raw) => ({
      monitorChecks: Array.isArray(raw?.monitorChecks) ? raw.monitorChecks : [],
      alerts: Array.isArray(raw?.alerts) ? raw.alerts : [],
      brokenLinks: Array.isArray(raw?.brokenLinks) ? raw.brokenLinks : [],
      cacheDiagnostics: Array.isArray(raw?.cacheDiagnostics) ? raw.cacheDiagnostics : []
    });
    readStoreFromPath = async (storePath) => {
      try {
        const text2 = await readFile(storePath, "utf8");
        return normalizeStore(JSON.parse(text2));
      } catch (error) {
        if (error.code === "ENOENT") return emptyStore();
        console.warn("[watchdog-store] failed to read local JSON store", { storePath, error });
        return emptyStore();
      }
    };
    resolveReadableStore = async () => {
      const candidates = activeStorePath ? [activeStorePath, ...getStorePathCandidates().filter((p) => p !== activeStorePath)] : getStorePathCandidates();
      for (const candidate of candidates) {
        const store = await readStoreFromPath(candidate);
        activeStorePath = candidate;
        return { storePath: candidate, store };
      }
      const fallback = path.join(os.tmpdir(), "ncr-watchdog-store.json");
      activeStorePath = fallback;
      return { storePath: fallback, store: emptyStore() };
    };
    writeStore = async (store) => {
      const candidates = activeStorePath ? [activeStorePath, ...getStorePathCandidates().filter((p) => p !== activeStorePath)] : getStorePathCandidates();
      let lastError;
      for (const candidate of candidates) {
        try {
          await mkdir(path.dirname(candidate), { recursive: true });
          const tmpPath = `${candidate}.${process.pid}.tmp`;
          await writeFile(tmpPath, `${JSON.stringify(store, null, 2)}
`, "utf8");
          await rename(tmpPath, candidate);
          activeStorePath = candidate;
          return;
        } catch (error) {
          lastError = error;
          console.warn("[watchdog-store] failed to write local JSON store; trying next path", { storePath: candidate, error });
        }
      }
      console.warn("[watchdog-store] all local JSON store writes failed", lastError);
    };
    updateStore = async (mutator) => {
      writeChain = writeChain.then(async () => {
        const { store } = await resolveReadableStore();
        mutator(store);
        await writeStore(store);
      });
      return writeChain;
    };
    nextId = (items) => Math.max(0, ...items.map((item) => Number(item.id) || 0)) + 1;
  }
});

// server/db.ts
var db_exports = {};
__export(db_exports, {
  CRITICAL_URLS: () => CRITICAL_URLS,
  computeSiteHealthScore: () => computeSiteHealthScore,
  createReplyTemplate: () => createReplyTemplate,
  createToxicKeyword: () => createToxicKeyword,
  deleteReplyTemplate: () => deleteReplyTemplate,
  deleteToxicKeyword: () => deleteToxicKeyword,
  getActiveBrokenLinksCount: () => getActiveBrokenLinksCount,
  getActiveReplyTemplates: () => getActiveReplyTemplates,
  getActiveToxicKeywords: () => getActiveToxicKeywords,
  getAllReplyTemplates: () => getAllReplyTemplates,
  getAllToxicKeywords: () => getAllToxicKeywords,
  getAvgTtfb: () => getAvgTtfb,
  getBannedIPs: () => getBannedIPs,
  getCriticalBrokenLinks: () => getCriticalBrokenLinks,
  getDb: () => getDb,
  getLatestCFAnalyticsSnapshot: () => getLatestCFAnalyticsSnapshot,
  getLatestCacheDiagnostic: () => getLatestCacheDiagnostic,
  getOpenQualityAuditResults: () => getOpenQualityAuditResults,
  getPersonalAgenda: () => getPersonalAgenda,
  getRecentActionLog: () => getRecentActionLog,
  getRecentAgendas: () => getRecentAgendas,
  getRecentAlerts: () => getRecentAlerts,
  getRecentCacheDiagnostics: () => getRecentCacheDiagnostics,
  getRecentChecks: () => getRecentChecks,
  getSchedulerStates: () => getSchedulerStates,
  getTopBrokenLinks: () => getTopBrokenLinks,
  getTtfbVariance: () => getTtfbVariance,
  getUptimePercent: () => getUptimePercent,
  getUserByOpenId: () => getUserByOpenId,
  getWpDbLatencyHistory: () => getWpDbLatencyHistory,
  getWpDbLatencyTimeline: () => getWpDbLatencyTimeline,
  isBannedIP: () => isBannedIP,
  isInCooldown: () => isInCooldown,
  logAction: () => logAction,
  markBrokenLinkFixed: () => markBrokenLinkFixed,
  markQualityAuditFixed: () => markQualityAuditFixed,
  resolveAlertPurge: () => resolveAlertPurge,
  saveAlert: () => saveAlert,
  saveCFAnalyticsSnapshot: () => saveCFAnalyticsSnapshot,
  saveCacheDiagnostic: () => saveCacheDiagnostic,
  saveMonitorCheck: () => saveMonitorCheck,
  saveWpDbLatency: () => saveWpDbLatency,
  setCooldown: () => setCooldown,
  updateReplyTemplate: () => updateReplyTemplate,
  updateToxicKeyword: () => updateToxicKeyword,
  upsertBannedIP: () => upsertBannedIP,
  upsertBrokenLinks: () => upsertBrokenLinks,
  upsertPersonalAgenda: () => upsertPersonalAgenda,
  upsertQualityAuditResult: () => upsertQualityAuditResult,
  upsertSchedulerState: () => upsertSchedulerState,
  upsertUser: () => upsertUser
});
import { eq, desc, asc, sql, gt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values = {
      openId: user.openId
    };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod"];
    const assignNullable = (field) => {
      const value = user[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== void 0) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = /* @__PURE__ */ new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return void 0;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function saveMonitorCheck(check) {
  await saveLocalMonitorCheck(check);
  const db = await getDb();
  if (!db) return;
  await db.insert(monitorChecks).values(check);
  await db.execute(sql`
    DELETE FROM monitor_checks WHERE id NOT IN (
      SELECT id FROM (
        SELECT id FROM monitor_checks ORDER BY createdAt DESC LIMIT 100
      ) AS t
    )
  `);
}
async function getRecentChecks(limit = 100) {
  const db = await getDb();
  if (!db) return getLocalRecentChecks(limit);
  const checks = await db.select().from(monitorChecks).orderBy(desc(monitorChecks.createdAt)).limit(limit);
  return checks.length > 0 ? checks : getLocalRecentChecks(limit);
}
async function getUptimePercent() {
  const db = await getDb();
  if (!db) return getLocalUptimePercent();
  const checks = await db.select().from(monitorChecks).orderBy(desc(monitorChecks.createdAt)).limit(100);
  if (checks.length === 0) return getLocalUptimePercent();
  const upCount = checks.filter((c) => c.isUp).length;
  return upCount / checks.length * 100;
}
async function getAvgTtfb() {
  const db = await getDb();
  if (!db) return getLocalAvgTtfb();
  const checks = await db.select().from(monitorChecks).orderBy(desc(monitorChecks.createdAt)).limit(20);
  if (checks.length === 0) return getLocalAvgTtfb();
  return Math.round(checks.reduce((sum, c) => sum + c.ttfbMs, 0) / checks.length);
}
async function saveAlert(alert) {
  await saveLocalAlert(alert);
  const db = await getDb();
  if (!db) return;
  await db.insert(alertLog).values(alert);
}
async function getRecentAlerts(limit = 20) {
  const db = await getDb();
  if (!db) return getLocalRecentAlerts(limit);
  const alerts = await db.select().from(alertLog).orderBy(desc(alertLog.createdAt)).limit(limit);
  return alerts.length > 0 ? alerts : getLocalRecentAlerts(limit);
}
async function resolveAlertPurge(id) {
  await resolveLocalAlertPurge(id);
  const db = await getDb();
  if (!db) return;
  await db.update(alertLog).set({ pendingPurge: false, autoFixApplied: true, resolved: true }).where(eq(alertLog.id, id));
}
async function isInCooldown(type) {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select().from(alertCooldown).where(eq(alertCooldown.alertType, type)).limit(1);
  if (rows.length === 0) return false;
  const row = rows[0];
  const cooldownMs = row.cooldownMinutes * 60 * 1e3;
  return Date.now() - row.lastAlertAt.getTime() < cooldownMs;
}
async function setCooldown(type, minutes = 30) {
  const db = await getDb();
  if (!db) return;
  await db.insert(alertCooldown).values({ alertType: type, lastAlertAt: /* @__PURE__ */ new Date(), cooldownMinutes: minutes }).onDuplicateKeyUpdate({ set: { lastAlertAt: /* @__PURE__ */ new Date(), cooldownMinutes: minutes } });
}
async function getSchedulerStates() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(schedulerState).orderBy(asc(schedulerState.jobName));
}
async function upsertSchedulerState(jobName, patch) {
  const db = await getDb();
  if (!db) return;
  await db.insert(schedulerState).values({ jobName, ...patch }).onDuplicateKeyUpdate({ set: patch });
}
async function upsertBrokenLinks(entries) {
  await upsertLocalBrokenLinks(
    entries,
    (url) => CRITICAL_URLS.some((p) => url === p || url.startsWith(p + "?"))
  );
  const db = await getDb();
  if (!db || entries.length === 0) return;
  const now = /* @__PURE__ */ new Date();
  for (const entry of entries) {
    const critical = CRITICAL_URLS.some(
      (p) => entry.url === p || entry.url.startsWith(p + "?")
    );
    await db.insert(brokenLinks).values({
      url: entry.url,
      hits: entry.hits,
      isCritical: critical,
      lastSeen: now,
      firstSeen: now
    }).onDuplicateKeyUpdate({
      set: {
        hits: sql`hits + ${entry.hits}`,
        isCritical: critical,
        lastSeen: now,
        // Auto-reopen: if this URL was previously marked as fixed but is
        // generating new 404 hits, set isFixed back to false so it
        // re-surfaces in the active Broken Links Log.
        isFixed: false
      }
    });
  }
}
async function getTopBrokenLinks(limit = 20) {
  const db = await getDb();
  if (!db) return getLocalTopBrokenLinks(limit);
  const links = await db.select().from(brokenLinks).where(eq(brokenLinks.isFixed, false)).orderBy(desc(brokenLinks.hits)).limit(limit);
  return links.length > 0 ? links : getLocalTopBrokenLinks(limit);
}
async function markBrokenLinkFixed(id) {
  await markLocalBrokenLinkFixed(id);
  const db = await getDb();
  if (!db) return;
  await db.update(brokenLinks).set({ isFixed: true }).where(eq(brokenLinks.id, id));
}
async function getActiveBrokenLinksCount() {
  const db = await getDb();
  if (!db) return getLocalActiveBrokenLinksCount();
  const rows = await db.select({ count: sql`COUNT(*)` }).from(brokenLinks).where(eq(brokenLinks.isFixed, false));
  const count = rows[0]?.count ?? 0;
  return count > 0 ? count : getLocalActiveBrokenLinksCount();
}
async function getCriticalBrokenLinks() {
  const db = await getDb();
  if (!db) return getLocalCriticalBrokenLinks();
  const links = await db.select().from(brokenLinks).where(eq(brokenLinks.isCritical, true)).orderBy(desc(brokenLinks.hits));
  return links.length > 0 ? links : getLocalCriticalBrokenLinks();
}
async function saveCacheDiagnostic(data) {
  await saveLocalCacheDiagnostic(data);
  const db = await getDb();
  if (!db) return;
  await db.insert(cacheDiagnostics).values({ ...data, checkedAt: /* @__PURE__ */ new Date() });
  await db.execute(sql`
    DELETE FROM cache_diagnostics WHERE id NOT IN (
      SELECT id FROM (
        SELECT id FROM cache_diagnostics ORDER BY checked_at DESC LIMIT 50
      ) AS t
    )
  `);
}
async function getRecentCacheDiagnostics(n = 20) {
  const db = await getDb();
  if (!db) return getLocalRecentCacheDiagnostics(n);
  const diagnostics = await db.select().from(cacheDiagnostics).orderBy(desc(cacheDiagnostics.checkedAt)).limit(n);
  return diagnostics.length > 0 ? diagnostics : getLocalRecentCacheDiagnostics(n);
}
async function getLatestCacheDiagnostic() {
  const db = await getDb();
  if (!db) return getLocalLatestCacheDiagnostic();
  const rows = await db.select().from(cacheDiagnostics).orderBy(desc(cacheDiagnostics.checkedAt)).limit(1);
  return rows[0] ?? await getLocalLatestCacheDiagnostic();
}
async function upsertBannedIP(ip, count404, wafBlocked, blockMessage) {
  const db = await getDb();
  if (!db) return;
  await db.insert(bannedIPs).values({ ip, count404, wafBlocked, blockMessage, bannedAt: /* @__PURE__ */ new Date() }).onDuplicateKeyUpdate({
    set: {
      count404: sql`count_404 + ${count404}`,
      wafBlocked,
      blockMessage,
      bannedAt: /* @__PURE__ */ new Date()
    }
  });
}
async function getBannedIPs(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(bannedIPs).orderBy(desc(bannedIPs.bannedAt)).limit(limit);
}
async function isBannedIP(ip) {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select({ id: bannedIPs.id }).from(bannedIPs).where(eq(bannedIPs.ip, ip)).limit(1);
  return rows.length > 0;
}
async function saveCFAnalyticsSnapshot(data) {
  const db = await getDb();
  if (!db) return;
  await db.insert(cfAnalyticsCache).values({
    ...data,
    snapshotAt: /* @__PURE__ */ new Date()
  });
}
async function getLatestCFAnalyticsSnapshot(windowDays) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(cfAnalyticsCache).where(eq(cfAnalyticsCache.windowDays, windowDays)).orderBy(desc(cfAnalyticsCache.snapshotAt)).limit(1);
  return rows[0] ?? null;
}
async function upsertPersonalAgenda(date, content) {
  const db = await getDb();
  if (!db) return;
  await db.insert(personalAgenda).values({ date, content }).onDuplicateKeyUpdate({ set: { content, updatedAt: /* @__PURE__ */ new Date() } });
}
async function getPersonalAgenda(date) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(personalAgenda).where(eq(personalAgenda.date, date)).limit(1);
  return rows[0] ?? null;
}
async function getRecentAgendas(limit = 7) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(personalAgenda).orderBy(desc(personalAgenda.date)).limit(limit);
}
async function logAction(actionType, description, metadata) {
  const db = await getDb();
  if (!db) return;
  await db.insert(actionLog).values({
    actionType,
    description,
    metadata: metadata ? JSON.stringify(metadata) : null
  });
}
async function getRecentActionLog(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(actionLog).orderBy(desc(actionLog.createdAt)).limit(limit);
}
async function upsertQualityAuditResult(item) {
  const db = await getDb();
  if (!db) return;
  await db.insert(qualityAuditResults).values({
    auditType: item.auditType,
    url: item.url,
    issue: item.issue,
    severity: item.severity ?? "warning"
  }).onDuplicateKeyUpdate({
    set: { issue: item.issue, severity: item.severity ?? "warning", updatedAt: /* @__PURE__ */ new Date(), isFixed: false }
  });
}
async function getOpenQualityAuditResults(auditType) {
  const db = await getDb();
  if (!db) return [];
  const q = db.select().from(qualityAuditResults).where(eq(qualityAuditResults.isFixed, false));
  return q.orderBy(desc(qualityAuditResults.createdAt)).limit(50);
}
async function markQualityAuditFixed(id) {
  const db = await getDb();
  if (!db) return;
  await db.update(qualityAuditResults).set({ isFixed: true, updatedAt: /* @__PURE__ */ new Date() }).where(eq(qualityAuditResults.id, id));
}
async function getActiveReplyTemplates() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(replyTemplates).where(eq(replyTemplates.isActive, true)).orderBy(asc(replyTemplates.id));
}
async function getAllReplyTemplates() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(replyTemplates).orderBy(asc(replyTemplates.id));
}
async function createReplyTemplate(template) {
  const db = await getDb();
  if (!db) return;
  await db.insert(replyTemplates).values({ template, isActive: true });
}
async function updateReplyTemplate(id, patch) {
  const db = await getDb();
  if (!db) return;
  await db.update(replyTemplates).set({ ...patch, updatedAt: /* @__PURE__ */ new Date() }).where(eq(replyTemplates.id, id));
}
async function deleteReplyTemplate(id) {
  const db = await getDb();
  if (!db) return;
  await db.delete(replyTemplates).where(eq(replyTemplates.id, id));
}
async function getActiveToxicKeywords() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(toxicKeywords).where(eq(toxicKeywords.isActive, true)).orderBy(asc(toxicKeywords.keyword));
}
async function getAllToxicKeywords() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(toxicKeywords).orderBy(asc(toxicKeywords.keyword));
}
async function createToxicKeyword(keyword, category = "spam") {
  const db = await getDb();
  if (!db) return;
  await db.insert(toxicKeywords).values({ keyword, category, isActive: true });
}
async function updateToxicKeyword(id, patch) {
  const db = await getDb();
  if (!db) return;
  await db.update(toxicKeywords).set(patch).where(eq(toxicKeywords.id, id));
}
async function deleteToxicKeyword(id) {
  const db = await getDb();
  if (!db) return;
  await db.delete(toxicKeywords).where(eq(toxicKeywords.id, id));
}
async function computeSiteHealthScore() {
  const uptime = await getUptimePercent();
  const avgTtfb = await getAvgTtfb();
  const brokenCount = await getActiveBrokenLinksCount();
  const cached = await getLatestCFAnalyticsSnapshot(1);
  const blockRate = cached?.blockRate ?? 0;
  const uptimeScore = Math.round(uptime / 100 * 40);
  const ttfbScore = avgTtfb <= 500 ? 30 : avgTtfb <= 1e3 ? 20 : avgTtfb <= 2e3 ? 10 : 0;
  const blockScore = blockRate <= 5 ? 20 : blockRate <= 15 ? 15 : blockRate <= 25 ? 10 : 5;
  const brokenScore = brokenCount === 0 ? 10 : brokenCount <= 3 ? 7 : brokenCount <= 10 ? 4 : 0;
  const latestWpLatency = await getWpDbLatencyHistory(1);
  const wpDbExcellentBonus = latestWpLatency !== null && latestWpLatency.avgLatencyMs >= 0 && latestWpLatency.avgLatencyMs < 100 ? 5 : 0;
  const rawScore = uptimeScore + ttfbScore + blockScore + brokenScore + wpDbExcellentBonus;
  const score = Math.min(100, rawScore);
  const grade = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 45 ? "D" : "F";
  return { score, grade, factors: { uptimeScore, ttfbScore, blockScore, brokenScore, wpDbExcellentBonus } };
}
async function getTtfbVariance(limit = 20) {
  const db = await getDb();
  if (!db) return { variance: 0, maxTtfb: 0, minTtfb: 0, avgTtfb: 0, samples: 0, isUnstable: false };
  const checks = await db.select().from(monitorChecks).orderBy(desc(monitorChecks.createdAt)).limit(limit);
  if (checks.length < 2) return { variance: 0, maxTtfb: 0, minTtfb: 0, avgTtfb: 0, samples: checks.length, isUnstable: false };
  const ttfbs = checks.map((c) => c.ttfbMs);
  const maxTtfb = Math.max(...ttfbs);
  const minTtfb = Math.min(...ttfbs);
  const avgTtfb = Math.round(ttfbs.reduce((s, v) => s + v, 0) / ttfbs.length);
  const variance = maxTtfb - minTtfb;
  const isUnstable = variance > 50;
  return { variance, maxTtfb, minTtfb, avgTtfb, samples: checks.length, isUnstable };
}
async function saveWpDbLatency(latencyMs, status, httpCode) {
  const db = await getDb();
  if (!db) return;
  await db.insert(wpDbLatencyLog).values({ latencyMs, status, httpCode });
  await db.execute(
    sql`DELETE FROM wp_db_latency_log WHERE id NOT IN (SELECT id FROM (SELECT id FROM wp_db_latency_log ORDER BY created_at DESC LIMIT 200) t)`
  );
}
async function getWpDbLatencyHistory(hours = 24) {
  const db = await getDb();
  if (!db) return null;
  const since = new Date(Date.now() - hours * 60 * 60 * 1e3);
  const rows = await db.select().from(wpDbLatencyLog).where(gt(wpDbLatencyLog.createdAt, since)).orderBy(desc(wpDbLatencyLog.createdAt));
  if (!rows.length) return null;
  const avgLatencyMs = Math.round(rows.reduce((s, r) => s + r.latencyMs, 0) / rows.length);
  const slowCount = rows.filter((r) => r.status === "slow").length;
  const criticalCount = rows.filter((r) => r.status === "critical").length;
  return { avgLatencyMs, samples: rows.length, slowCount, criticalCount };
}
async function getWpDbLatencyTimeline(hours = 24) {
  const db = await getDb();
  if (!db) return [];
  const since = new Date(Date.now() - hours * 60 * 60 * 1e3);
  const rows = await db.select().from(wpDbLatencyLog).where(gt(wpDbLatencyLog.createdAt, since)).orderBy(wpDbLatencyLog.createdAt);
  return rows.map((r) => ({ ts: new Date(r.createdAt).getTime(), latencyMs: r.latencyMs, status: r.status }));
}
var _db, CRITICAL_URLS;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema();
    init_env();
    init_localWatchdogStore();
    init_schema();
    init_schema();
    _db = null;
    CRITICAL_URLS = [
      "/",
      "/category/news/",
      "/category/lifestyle/",
      "/category/sport/",
      "/category/entertainment/",
      "/category/local/",
      "/category/politics/"
    ];
  }
});

// server/cloudflare.ts
var cloudflare_exports = {};
__export(cloudflare_exports, {
  blockIPInCFWAF: () => blockIPInCFWAF,
  get404SpikeData: () => get404SpikeData,
  get404Stats: () => get404Stats,
  getBruteForceLoginAttempts: () => getBruteForceLoginAttempts,
  getCFAnalytics: () => getCFAnalytics,
  getCacheEfficiencyData: () => getCacheEfficiencyData,
  getCacheMissPatterns: () => getCacheMissPatterns,
  getCountryTraffic: () => getCountryTraffic,
  getFBTrafficValidation: () => getFBTrafficValidation,
  getTop404IPsLast5Min: () => getTop404IPsLast5Min,
  getTopPosts: () => getTopPosts,
  getTrendingTrafficSpikes: () => getTrendingTrafficSpikes,
  purgeCFCache: () => purgeCFCache
});
async function purgeCFCache() {
  if (!ENV.cfApiToken || !ENV.cfZoneId) {
    return { success: false, message: "CF credentials not configured" };
  }
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${ENV.cfZoneId}/purge_cache`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ENV.cfApiToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ purge_everything: true })
      }
    );
    const data = await res.json();
    if (data.success) {
      return { success: true, message: "Cloudflare cache purged successfully" };
    } else {
      const errMsg = data.errors?.map((e) => e.message).join(", ") || "Unknown CF error";
      return { success: false, message: errMsg };
    }
  } catch (err) {
    return { success: false, message: `CF purge failed: ${err.message}` };
  }
}
async function getCFAnalytics(windowDays = 1) {
  if (!ENV.cfApiToken || !ENV.cfZoneId) {
    return CF_ANALYTICS_EMPTY;
  }
  try {
    const now = Date.now();
    const safeDays = Math.max(1, Math.min(Math.round(windowDays), 31));
    const since = new Date(now - safeDays * 24 * 60 * 60 * 1e3).toISOString();
    const until = new Date(now).toISOString();
    const sinceDate = since.slice(0, 10);
    const untilDate = until.slice(0, 10);
    const query = `
      query {
        viewer {
          zones(filter: { zoneTag: "${ENV.cfZoneId}" }) {
            httpRequests1dGroups(
              limit: ${Math.min(safeDays + 1, 31)}
              filter: { date_geq: "${sinceDate}", date_leq: "${untilDate}" }
            ) {
              sum {
                requests
                cachedRequests
                bytes
                cachedBytes
                threats
                pageViews
              }
              uniq {
                uniques
              }
            }
            httpRequestsAdaptiveGroups(
              limit: 10
              orderBy: [count_DESC]
              filter: { datetime_geq: "${since}", datetime_leq: "${until}", edgeResponseStatus: 404 }
            ) {
              count
              dimensions {
                clientRequestPath
              }
            }
            countryGroups: httpRequestsAdaptiveGroups(
              limit: 5
              orderBy: [count_DESC]
              filter: { datetime_geq: "${since}", datetime_leq: "${until}" }
            ) {
              count
              dimensions {
                clientCountryName
              }
            }
          }
        }
      }
    `;
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ENV.cfApiToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query })
    });
    const data = await res.json();
    const groups = data?.data?.viewer?.zones?.[0]?.httpRequests1dGroups ?? [];
    if (groups.length === 0) {
      return CF_ANALYTICS_EMPTY;
    }
    const totals = groups.reduce(
      (acc, group) => {
        acc.requests += group.sum.requests ?? 0;
        acc.cachedRequests += group.sum.cachedRequests ?? 0;
        acc.bytes += group.sum.bytes ?? 0;
        acc.threats += group.sum.threats ?? 0;
        acc.pageViews += group.sum.pageViews ?? 0;
        acc.uniques += group.uniq?.uniques ?? 0;
        return acc;
      },
      { requests: 0, cachedRequests: 0, bytes: 0, threats: 0, pageViews: 0, uniques: 0 }
    );
    const cacheHitRate = totals.requests > 0 ? Math.round(totals.cachedRequests / totals.requests * 100) : 0;
    const zone = data?.data?.viewer?.zones?.[0];
    const adaptiveGroups = zone?.httpRequestsAdaptiveGroups ?? [];
    const count404 = adaptiveGroups.reduce((acc, g) => acc + (g.count ?? 0), 0);
    const top404Urls = adaptiveGroups.filter((g) => g.dimensions?.clientRequestPath).map((g) => ({ url: g.dimensions.clientRequestPath, hits: g.count })).slice(0, 10);
    const countryTraffic = (zone?.countryGroups ?? []).filter((g) => g.dimensions?.clientCountryName).map((g) => ({ country: g.dimensions.clientCountryName, requests: g.count })).slice(0, 5);
    return {
      cacheHitRate,
      totalRequests: totals.requests,
      cachedRequests: totals.cachedRequests,
      bandwidth: totals.bytes,
      threats: totals.threats,
      pageViews: totals.pageViews,
      visits: totals.uniques,
      count404,
      top404Urls,
      countryTraffic
    };
  } catch {
    return CF_ANALYTICS_EMPTY;
  }
}
async function getTop404IPsLast5Min(threshold = 100) {
  if (!ENV.cfApiToken || !ENV.cfZoneId) return [];
  try {
    const now = Date.now();
    const since = new Date(now - 5 * 60 * 1e3).toISOString();
    const until = new Date(now).toISOString();
    const query = `
      query {
        viewer {
          zones(filter: { zoneTag: "${ENV.cfZoneId}" }) {
            httpRequestsAdaptiveGroups(
              limit: 10
              orderBy: [count_DESC]
              filter: { datetime_geq: "${since}", datetime_leq: "${until}", edgeResponseStatus: 404 }
            ) {
              count
              dimensions {
                clientIP
              }
            }
          }
        }
      }
    `;
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: { Authorization: `Bearer ${ENV.cfApiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query })
    });
    const data = await res.json();
    const groups = data?.data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups ?? [];
    return groups.filter((g) => g.count >= threshold && g.dimensions?.clientIP).map((g) => ({ ip: g.dimensions.clientIP, count: g.count }));
  } catch {
    return [];
  }
}
async function blockIPInCFWAF(ip) {
  if (!ENV.cfApiToken || !ENV.cfZoneId) {
    return { success: false, message: "CF credentials not configured", wafBlocked: false };
  }
  let underAttackActivated = false;
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${ENV.cfZoneId}/settings/security_level`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${ENV.cfApiToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ value: "under_attack" })
      }
    );
    const data = await res.json();
    underAttackActivated = data.success;
  } catch {
  }
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${ENV.cfZoneId}/firewall/access-rules/rules`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${ENV.cfApiToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "block",
          configuration: { target: "ip", value: ip },
          notes: `Auto-banned by NCR Watchdog: high 404 rate (>100 in 5min)`
        })
      }
    );
    const data = await res.json();
    if (data.success) {
      return {
        success: true,
        message: `\u{1F6A8} IP ${ip} permanently blocked in CF WAF. Under Attack mode also activated.`,
        wafBlocked: true
      };
    }
  } catch {
  }
  if (underAttackActivated) {
    return {
      success: true,
      message: `\u26A1 CF "Under Attack" mode ACTIVATED immediately (IP: ${ip}). WAF IP block requires token upgrade.`,
      wafBlocked: false
    };
  }
  return {
    success: false,
    message: `CF defense failed for IP ${ip}. Manual action required.`,
    wafBlocked: false
  };
}
async function get404Stats() {
  if (!ENV.wpUser || !ENV.wpAppPassword) {
    return { count404: 0, top404Urls: [] };
  }
  try {
    const credentials = Buffer.from(`${ENV.wpUser}:${ENV.wpAppPassword}`).toString("base64");
    const since = new Date(Date.now() - 24 * 60 * 60 * 1e3).toISOString();
    const res = await fetch(
      `${ENV.wpSiteUrl}/wp-json/redirection/v1/404?per_page=100&orderby=last_access&direction=desc`,
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          Accept: "application/json",
          "User-Agent": "NCRWatchdog/1.0 (monitoring bot; +https://nakornchiangrainews.com)"
        }
      }
    );
    if (!res.ok) {
      return { count404: 0, top404Urls: [] };
    }
    const data = await res.json();
    const items = data.items ?? [];
    const count404 = data.total ?? items.length;
    const urlMap = /* @__PURE__ */ new Map();
    for (const item of items) {
      urlMap.set(item.url, (urlMap.get(item.url) ?? 0) + (item.hits ?? 1));
    }
    const top404Urls = Array.from(urlMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([url, hits]) => ({ url, hits }));
    return { count404, top404Urls };
  } catch {
    return { count404: 0, top404Urls: [] };
  }
}
async function getTopPosts(days, limit = 10) {
  const { ENV: ENV2 } = await Promise.resolve().then(() => (init_env(), env_exports));
  const cfApiToken = ENV2.cfApiToken;
  const cfZoneId = ENV2.cfZoneId;
  const hoursBack = Math.min(days * 24, 23);
  const dateISO = new Date(Date.now() - hoursBack * 60 * 60 * 1e3).toISOString();
  const query = `{
    viewer {
      zones(filter: { zoneTag: "${cfZoneId}" }) {
        httpRequestsAdaptiveGroups(
          limit: 50,
          filter: { datetime_gt: "${dateISO}", edgeResponseStatus: 200 },
          orderBy: [count_DESC]
        ) {
          dimensions { clientRequestPath }
          count
        }
      }
    }
  }`;
  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfApiToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query })
    });
    const json = await res.json();
    if (json.errors?.length) {
      console.warn("[getTopPosts] CF GraphQL errors:", json.errors);
      return [];
    }
    const raw = json.data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups ?? [];
    const filtered = raw.filter((item) => {
      const p = item.dimensions.clientRequestPath;
      return p.length > 2 && !p.includes(".") && !p.includes("wp-") && !p.includes("admin") && !p.startsWith("/feed") && !p.startsWith("/sitemap") && !p.startsWith("/xmlrpc") && p !== "/";
    }).slice(0, limit).map((item) => ({ path: item.dimensions.clientRequestPath, count: item.count }));
    return filtered;
  } catch (err) {
    console.warn("[getTopPosts] fetch error:", err);
    return [];
  }
}
async function getCountryTraffic(limit = 10) {
  const { ENV: ENV2 } = await Promise.resolve().then(() => (init_env(), env_exports));
  const cfApiToken = ENV2.cfApiToken;
  const cfZoneId = ENV2.cfZoneId;
  const dateISO = new Date(Date.now() - 23 * 60 * 60 * 1e3).toISOString();
  const query = `{
    viewer {
      zones(filter: { zoneTag: "${cfZoneId}" }) {
        httpRequestsAdaptiveGroups(
          limit: ${limit},
          filter: { datetime_gt: "${dateISO}" },
          orderBy: [count_DESC]
        ) {
          dimensions { clientCountryName }
          count
        }
      }
    }
  }`;
  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfApiToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query })
    });
    const json = await res.json();
    if (json.errors?.length) {
      console.warn("[getCountryTraffic] CF GraphQL errors:", json.errors);
      return [];
    }
    const raw = json.data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups ?? [];
    return raw.map((item) => ({
      country: item.dimensions.clientCountryName,
      requests: item.count
    }));
  } catch (err) {
    console.warn("[getCountryTraffic] fetch error:", err);
    return [];
  }
}
async function get404SpikeData() {
  const empty = { totalRequests: 0, count404: 0, rate404: 0, isSpike: false, top404Urls: [] };
  if (!ENV.cfApiToken || !ENV.cfZoneId) return empty;
  const now = Date.now();
  const since = new Date(now - 60 * 60 * 1e3).toISOString();
  const until = new Date(now).toISOString();
  const query = `{
    viewer {
      zones(filter: { zoneTag: "${ENV.cfZoneId}" }) {
        total: httpRequestsAdaptiveGroups(
          limit: 1
          filter: { datetime_geq: "${since}", datetime_leq: "${until}" }
        ) {
          count
        }
        errors404: httpRequestsAdaptiveGroups(
          limit: 10
          orderBy: [count_DESC]
          filter: { datetime_geq: "${since}", datetime_leq: "${until}", edgeResponseStatus: 404 }
        ) {
          count
          dimensions { clientRequestPath }
        }
      }
    }
  }`;
  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: { Authorization: `Bearer ${ENV.cfApiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query })
    });
    const json = await res.json();
    if (json.errors?.length) {
      console.warn("[get404SpikeData] CF GraphQL errors:", json.errors);
      return empty;
    }
    const zone = json.data?.viewer?.zones?.[0];
    if (!zone) return empty;
    const totalRequests = zone.total.reduce((s, r) => s + r.count, 0);
    const count404 = zone.errors404.reduce((s, r) => s + r.count, 0);
    const rate404 = totalRequests > 0 ? count404 / totalRequests : 0;
    const isSpike = rate404 > 0.05;
    const urlMap = /* @__PURE__ */ new Map();
    for (const item of zone.errors404) {
      const path4 = item.dimensions.clientRequestPath;
      urlMap.set(path4, (urlMap.get(path4) ?? 0) + item.count);
    }
    const top404Urls = Array.from(urlMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([url, hits]) => ({ url, hits }));
    return { totalRequests, count404, rate404, isSpike, top404Urls };
  } catch (err) {
    console.warn("[get404SpikeData] fetch error:", err);
    return empty;
  }
}
async function getCacheEfficiencyData() {
  const empty = {
    cacheHitRate: 0,
    totalRequests: 0,
    cachedRequests: 0,
    fbclidRequests: 0,
    adjustedCacheHitRate: 0,
    meetsTarget: false
  };
  if (!ENV.cfApiToken || !ENV.cfZoneId) return empty;
  const now = Date.now();
  const since = new Date(now - 6 * 60 * 60 * 1e3).toISOString();
  const until = new Date(now).toISOString();
  const query = `{
    viewer {
      zones(filter: { zoneTag: "${ENV.cfZoneId}" }) {
        allRequests: httpRequestsAdaptiveGroups(
          limit: 1
          filter: { datetime_geq: "${since}", datetime_leq: "${until}" }
        ) {
          count
          sum { cachedRequests }
        }
        fbclidMiss: httpRequestsAdaptiveGroups(
          limit: 1
          filter: {
            datetime_geq: "${since}",
            datetime_leq: "${until}",
            clientRequestQuery_contains: "fbclid",
            cacheStatus_neq: "hit"
          }
        ) {
          count
        }
      }
    }
  }`;
  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: { Authorization: `Bearer ${ENV.cfApiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query })
    });
    const json = await res.json();
    if (json.errors?.length) {
      console.warn("[getCacheEfficiencyData] CF GraphQL errors:", json.errors);
      return await getCacheEfficiencyDataSimple();
    }
    const zone = json.data?.viewer?.zones?.[0];
    if (!zone) return empty;
    const totalRequests = zone.allRequests.reduce((s, r) => s + r.count, 0);
    const cachedRequests = zone.allRequests.reduce((s, r) => s + (r.sum?.cachedRequests ?? 0), 0);
    const fbclidRequests = zone.fbclidMiss.reduce((s, r) => s + r.count, 0);
    const cacheHitRate = totalRequests > 0 ? cachedRequests / totalRequests : 0;
    const adjustedTotal = Math.max(totalRequests - fbclidRequests, 1);
    const adjustedCacheHitRate = adjustedTotal > 0 ? Math.min(cachedRequests / adjustedTotal, 1) : 0;
    const meetsTarget = adjustedCacheHitRate >= 0.85;
    return { cacheHitRate, totalRequests, cachedRequests, fbclidRequests, adjustedCacheHitRate, meetsTarget };
  } catch (err) {
    console.warn("[getCacheEfficiencyData] fetch error:", err);
    return empty;
  }
}
async function getCacheEfficiencyDataSimple() {
  const empty = {
    cacheHitRate: 0,
    totalRequests: 0,
    cachedRequests: 0,
    fbclidRequests: 0,
    adjustedCacheHitRate: 0,
    meetsTarget: false
  };
  if (!ENV.cfApiToken || !ENV.cfZoneId) return empty;
  const now = Date.now();
  const since = new Date(now - 6 * 60 * 60 * 1e3).toISOString();
  const until = new Date(now).toISOString();
  const query = `{
    viewer {
      zones(filter: { zoneTag: "${ENV.cfZoneId}" }) {
        allRequests: httpRequestsAdaptiveGroups(
          limit: 1
          filter: { datetime_geq: "${since}", datetime_leq: "${until}" }
        ) {
          count
          sum { cachedRequests }
        }
      }
    }
  }`;
  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: { Authorization: `Bearer ${ENV.cfApiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query })
    });
    const json = await res.json();
    if (json.errors?.length) return empty;
    const zone = json.data?.viewer?.zones?.[0];
    if (!zone) return empty;
    const totalRequests = zone.allRequests.reduce((s, r) => s + r.count, 0);
    const cachedRequests = zone.allRequests.reduce((s, r) => s + (r.sum?.cachedRequests ?? 0), 0);
    const cacheHitRate = totalRequests > 0 ? cachedRequests / totalRequests : 0;
    return {
      cacheHitRate,
      totalRequests,
      cachedRequests,
      fbclidRequests: 0,
      adjustedCacheHitRate: cacheHitRate,
      meetsTarget: cacheHitRate >= 0.85
    };
  } catch {
    return empty;
  }
}
async function getFBTrafficValidation() {
  const empty = {
    fbclidTotal: 0,
    fbclidSuccess: 0,
    fbclidFailure: 0,
    successRate: 1,
    hasIssue: false
  };
  if (!ENV.cfApiToken || !ENV.cfZoneId) return empty;
  const now = Date.now();
  const since = new Date(now - 24 * 60 * 60 * 1e3).toISOString();
  const until = new Date(now).toISOString();
  const query = `{
    viewer {
      zones(filter: { zoneTag: "${ENV.cfZoneId}" }) {
        fbclidAll: httpRequestsAdaptiveGroups(
          limit: 1
          filter: {
            datetime_geq: "${since}",
            datetime_leq: "${until}",
            clientRequestQuery_contains: "fbclid"
          }
        ) {
          count
        }
        fbclidSuccess: httpRequestsAdaptiveGroups(
          limit: 1
          filter: {
            datetime_geq: "${since}",
            datetime_leq: "${until}",
            clientRequestQuery_contains: "fbclid",
            edgeResponseStatus_lt: 400
          }
        ) {
          count
        }
        fbclidFailure: httpRequestsAdaptiveGroups(
          limit: 1
          filter: {
            datetime_geq: "${since}",
            datetime_leq: "${until}",
            clientRequestQuery_contains: "fbclid",
            edgeResponseStatus_geq: 400
          }
        ) {
          count
        }
      }
    }
  }`;
  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: { Authorization: `Bearer ${ENV.cfApiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query })
    });
    const json = await res.json();
    if (json.errors?.length) {
      console.warn("[getFBTrafficValidation] CF GraphQL errors (plan may not support clientRequestQuery filter):", json.errors);
      return { ...empty, fbclidTotal: -1 };
    }
    const zone = json.data?.viewer?.zones?.[0];
    if (!zone) return empty;
    const fbclidTotal = zone.fbclidAll.reduce((s, r) => s + r.count, 0);
    const fbclidSuccess = zone.fbclidSuccess.reduce((s, r) => s + r.count, 0);
    const fbclidFailure = zone.fbclidFailure.reduce((s, r) => s + r.count, 0);
    const successRate = fbclidTotal > 0 ? fbclidSuccess / fbclidTotal : 1;
    const hasIssue = fbclidTotal > 0 && successRate < 0.95;
    return { fbclidTotal, fbclidSuccess, fbclidFailure, successRate, hasIssue };
  } catch (err) {
    console.warn("[getFBTrafficValidation] fetch error:", err);
    return empty;
  }
}
async function getCacheMissPatterns() {
  const empty = {
    topMissUrls: [],
    totalMissRequests: 0,
    totalRequests: 0,
    missRate: 0,
    hasHighMissRate: false
  };
  if (!ENV.cfApiToken || !ENV.cfZoneId) return empty;
  const since = new Date(Date.now() - 6 * 60 * 60 * 1e3).toISOString();
  const until = (/* @__PURE__ */ new Date()).toISOString();
  const query = `{
    viewer {
      zones(filter: { zoneTag: "${ENV.cfZoneId}" }) {
        missGroups: httpRequestsAdaptiveGroups(
          filter: { datetime_geq: "${since}", datetime_leq: "${until}", cacheStatus: "miss" }
          limit: 10
          orderBy: [count_DESC]
        ) {
          count
          dimensions { clientRequestPath }
        }
        allGroups: httpRequestsAdaptiveGroups(
          filter: { datetime_geq: "${since}", datetime_leq: "${until}" }
          limit: 1
        ) {
          count
        }
      }
    }
  }`;
  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: { Authorization: `Bearer ${ENV.cfApiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query })
    });
    const json = await res.json();
    if (json.errors?.length) {
      console.warn("[getCacheMissPatterns] CF GraphQL errors:", json.errors);
      return empty;
    }
    const zone = json.data?.viewer?.zones?.[0];
    if (!zone) return empty;
    const totalRequests = zone.allGroups.reduce((s, r) => s + r.count, 0);
    const totalMissRequests = zone.missGroups.reduce((s, r) => s + r.count, 0);
    const topMissUrls = zone.missGroups.map((g) => ({
      url: g.dimensions.clientRequestPath,
      missCount: g.count
    }));
    const missRate = totalRequests > 0 ? totalMissRequests / totalRequests : 0;
    const hasHighMissRate = missRate > 0.2;
    return { topMissUrls, totalMissRequests, totalRequests, missRate, hasHighMissRate };
  } catch (err) {
    console.warn("[getCacheMissPatterns] fetch error:", err);
    return empty;
  }
}
function isLikelyNewsArticlePath(path4) {
  if (!path4 || path4 === "/") return false;
  if (path4.startsWith("/wp-") || path4.startsWith("/api/") || path4.startsWith("/.netlify/")) return false;
  if (/\.(?:css|js|json|xml|jpg|jpeg|png|gif|webp|svg|ico|woff2?|ttf|map)$/i.test(path4)) return false;
  return path4.split("/").filter(Boolean).length >= 2;
}
async function getTrendingTrafficSpikes(threshold = 500) {
  const empty = { threshold, windowMinutes: 60, spikes: [] };
  if (!ENV.cfApiToken || !ENV.cfZoneId) return empty;
  const since = new Date(Date.now() - 60 * 60 * 1e3).toISOString();
  const until = (/* @__PURE__ */ new Date()).toISOString();
  const query = `{
    viewer {
      zones(filter: { zoneTag: "${ENV.cfZoneId}" }) {
        articleGroups: httpRequestsAdaptiveGroups(
          limit: 50
          orderBy: [count_DESC]
          filter: { datetime_geq: "${since}", datetime_leq: "${until}", edgeResponseStatus_lt: 400 }
        ) {
          count
          dimensions { clientRequestPath }
        }
      }
    }
  }`;
  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: { Authorization: `Bearer ${ENV.cfApiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query })
    });
    const json = await res.json();
    if (json.errors?.length) {
      console.warn("[getTrendingTrafficSpikes] CF GraphQL errors:", json.errors);
      return empty;
    }
    const groups = json.data?.viewer?.zones?.[0]?.articleGroups ?? [];
    const spikes = groups.map((g) => ({ url: g.dimensions?.clientRequestPath ?? "", views: g.count })).filter((item) => item.views >= threshold && isLikelyNewsArticlePath(item.url)).slice(0, 10).map((item) => ({ ...item, fullUrl: `${ENV.wpSiteUrl.replace(/\/$/, "")}${item.url}` }));
    return { ...empty, spikes };
  } catch (err) {
    console.warn("[getTrendingTrafficSpikes] fetch error:", err);
    return empty;
  }
}
async function getBruteForceLoginAttempts(threshold = 20) {
  const empty = { threshold, windowMinutes: 15, offenders: [] };
  if (!ENV.cfApiToken || !ENV.cfZoneId) return empty;
  const since = new Date(Date.now() - 15 * 60 * 1e3).toISOString();
  const until = (/* @__PURE__ */ new Date()).toISOString();
  const query = `{
    viewer {
      zones(filter: { zoneTag: "${ENV.cfZoneId}" }) {
        wpLogin: httpRequestsAdaptiveGroups(
          limit: 50
          orderBy: [count_DESC]
          filter: { datetime_geq: "${since}", datetime_leq: "${until}", edgeResponseStatus_geq: 400, clientRequestPath: "/wp-login.php" }
        ) {
          count
          dimensions { clientIP clientRequestPath }
        }
        wpAdmin: httpRequestsAdaptiveGroups(
          limit: 50
          orderBy: [count_DESC]
          filter: { datetime_geq: "${since}", datetime_leq: "${until}", edgeResponseStatus_geq: 400, clientRequestPath_contains: "/wp-admin/" }
        ) {
          count
          dimensions { clientIP clientRequestPath }
        }
      }
    }
  }`;
  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: { Authorization: `Bearer ${ENV.cfApiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query })
    });
    const json = await res.json();
    if (json.errors?.length) {
      console.warn("[getBruteForceLoginAttempts] CF GraphQL errors:", json.errors);
      return empty;
    }
    const combined = [...json.data?.viewer?.zones?.[0]?.wpLogin ?? [], ...json.data?.viewer?.zones?.[0]?.wpAdmin ?? []];
    const byIp = /* @__PURE__ */ new Map();
    for (const item of combined) {
      const ip = item.dimensions?.clientIP ?? "";
      if (!ip) continue;
      const current = byIp.get(ip) ?? { ip, attempts: 0, topPath: item.dimensions?.clientRequestPath ?? "/wp-login.php" };
      current.attempts += item.count;
      byIp.set(ip, current);
    }
    const offenders = Array.from(byIp.values()).filter((item) => item.attempts >= threshold).sort((a, b) => b.attempts - a.attempts).slice(0, 10);
    return { ...empty, offenders };
  } catch (err) {
    console.warn("[getBruteForceLoginAttempts] fetch error:", err);
    return empty;
  }
}
var CF_ANALYTICS_EMPTY;
var init_cloudflare = __esm({
  "server/cloudflare.ts"() {
    "use strict";
    init_env();
    CF_ANALYTICS_EMPTY = {
      cacheHitRate: 0,
      totalRequests: 0,
      cachedRequests: 0,
      bandwidth: 0,
      threats: 0,
      visits: 0,
      pageViews: 0,
      count404: 0,
      top404Urls: [],
      countryTraffic: []
    };
  }
});

// server/telegram.ts
var telegram_exports = {};
__export(telegram_exports, {
  build404SpikeAlert: () => build404SpikeAlert,
  buildAdaptiveSecurityAlert: () => buildAdaptiveSecurityAlert,
  buildAlertMessage: () => buildAlertMessage,
  buildArticleSpikeAlert: () => buildArticleSpikeAlert,
  buildAutoBanAlert: () => buildAutoBanAlert,
  buildBlockRateAlert: () => buildBlockRateAlert,
  buildBruteForceLoginAlert: () => buildBruteForceLoginAlert,
  buildCacheBypassAlert: () => buildCacheBypassAlert,
  buildCacheEfficiencyReport: () => buildCacheEfficiencyReport,
  buildCacheMissReport: () => buildCacheMissReport,
  buildCacheWarmedAlert: () => buildCacheWarmedAlert,
  buildCritical404Alert: () => buildCritical404Alert,
  buildDailyReport: () => buildDailyReport,
  buildFBTrafficReport: () => buildFBTrafficReport,
  buildGoogleIndexingReport: () => buildGoogleIndexingReport,
  buildHostatomDownAlert: () => buildHostatomDownAlert,
  buildHostatomRecoveredAlert: () => buildHostatomRecoveredAlert,
  buildMonthlyReport: () => buildMonthlyReport,
  buildPageSpeedPayloadAlert: () => buildPageSpeedPayloadAlert,
  buildPredictiveWarning: () => buildPredictiveWarning,
  buildSmartDiagnosisAlert: () => buildSmartDiagnosisAlert,
  buildTopPostsReport: () => buildTopPostsReport,
  buildWeeklyReport: () => buildWeeklyReport,
  buildWpDbLatencyAlert: () => buildWpDbLatencyAlert,
  sendTelegramMessage: () => sendTelegramMessage
});
async function sendTelegramMessage(text2) {
  const chatIds = getTelegramChatIds();
  if (!ENV.tgBotToken || chatIds.length === 0) {
    return { success: false, error: "Telegram credentials not configured" };
  }
  const messageIds = [];
  const errors = [];
  await Promise.all(
    chatIds.map(async (chatId) => {
      try {
        const res = await fetch(`https://api.telegram.org/bot${ENV.tgBotToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: text2,
            parse_mode: "HTML",
            disable_web_page_preview: false,
            link_preview_options: { url: ENV.dashboardUrl }
          })
        });
        const data = await res.json();
        if (data.ok) {
          if (data.result?.message_id !== void 0) messageIds.push(data.result.message_id);
        } else {
          errors.push(data.description ?? "Telegram API returned an unsuccessful response");
        }
      } catch (err) {
        errors.push(err.message);
      }
    })
  );
  if (errors.length > 0) {
    return { success: false, messageIds, error: errors.join("; ") };
  }
  return { success: true, messageId: messageIds[0], messageIds };
}
function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
function formatMs(ms) {
  return ms >= 1e3 ? `${(ms / 1e3).toFixed(2)}s` : `${ms}ms`;
}
function getBangkokTime() {
  return (/* @__PURE__ */ new Date()).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}
function buildTop404Section(top404Urls) {
  if (!top404Urls || top404Urls.length === 0) return "";
  const lines = top404Urls.slice(0, 5).map((item, i) => `${i + 1}. <code>${item.url}</code> (${item.hits.toLocaleString()}x)`);
  return `

<b>Top 5 404 URLs:</b>
${lines.join("\n")}`;
}
function buildTopBrokenLinksSection(period, links) {
  if (period !== "morning" || !links || links.length === 0) return "";
  const lines = links.slice(0, 3).map((item, i) => `${i + 1}. <code>${item.url}</code> (${item.hits.toLocaleString()}x)`);
  return `

<b>\u{1F517} Top Broken Links:</b>
${lines.join("\n")}`;
}
function buildCountrySection(countryTraffic) {
  if (!countryTraffic || countryTraffic.length === 0) return "";
  const lines = countryTraffic.slice(0, 5).map((item, i) => `${i + 1}. <code>${item.country}</code> \u2014 ${item.requests.toLocaleString()} requests`);
  return `
Top 5 Countries:
${lines.join("\n")}`;
}
function buildDailyReport(period, data) {
  const periodLabel = period === "morning" ? "\u{1F305} Morning Report (09:00)" : "\u{1F306} Evening Report (18:00)";
  const statusIcon = data.isUp ? "\u{1F7E2}" : "\u{1F534}";
  const ttfbIcon = data.ttfbMs <= 1e3 ? "\u26A1" : data.ttfbMs <= 3e3 ? "\u26A0\uFE0F" : "\u{1F534}";
  return `<b>${statusIcon} NCR Watchdog \u2014 ${periodLabel}</b>
\u{1F550} ${getBangkokTime()} (Bangkok)
\u{1F310} <a href="https://nakornchiangrainews.com">nakornchiangrainews.com</a>

<b>\u2501\u2501\u2501 \u{1F4CA} Site Status \u2501\u2501\u2501</b>
HTTP: <code>${data.httpCode}</code> ${data.isUp ? "\u2705 Online" : "\u274C Offline"}
TTFB: ${ttfbIcon} <code>${formatMs(data.ttfbMs)}</code>
Uptime: <code>${data.uptimePercent.toFixed(1)}%</code>
Cache: <code>${data.cacheStatus}</code>

<b>\u2501\u2501\u2501 \u{1F6A6} Traffic (24h) \u2501\u2501\u2501</b>
Daily Visitor Sum: <code>${data.visits.toLocaleString()}</code>
Requests: <code>${data.totalRequests.toLocaleString()}</code>
Page Views: <code>${data.pageViews.toLocaleString()}</code>
Unique Visitors: <code>${data.visits.toLocaleString()}</code>
Bandwidth: <code>${formatBytes(data.bandwidth)}</code>${buildCountrySection(data.countryTraffic)}
Cache Hit Rate: <code>${data.cacheHitRate}%</code>${period === "morning" && data.cacheHealthSummary ? `
Cache Health: <code>${data.cacheHealthSummary}</code>` : ""}
<b>\u2501\u2501\u2501 \u26A1 Performance \u2501\u2501\u2501</b>
Avg TTFB: <code>${formatMs(data.avgTtfbMs)}</code>
Threshold: <code>3,000ms</code>

<b>\u2501\u2501\u2501 \u{1F6E1}\uFE0F Security \u2501\u2501\u2501</b>
Threats Blocked: <code>${data.threats}</code>
Recent Alerts: <code>${data.recentAlerts}</code>
404 Errors (24h): <code>${data.count404 ?? 0}</code>${buildTop404Section(data.top404Urls)}${buildTopBrokenLinksSection(period, data.topBrokenLinks)}

<b>\u2501\u2501\u2501 \u{1F517} Dashboard \u2501\u2501\u2501</b>
${ENV.dashboardUrl}`;
}
function buildWeeklyReport(data) {
  const statusIcon = data.isUp ? "\u{1F7E2}" : "\u{1F534}";
  return `<b>${statusIcon} NCR Watchdog \u2014 \u{1F4C5} Weekly Report</b>
\u{1F550} ${getBangkokTime()} (Bangkok)
\u{1F310} <a href="https://nakornchiangrainews.com">nakornchiangrainews.com</a>

<b>\u2501\u2501\u2501 \u{1F4CA} Weekly Summary \u2501\u2501\u2501</b>
HTTP: <code>${data.httpCode}</code> ${data.isUp ? "\u2705 Online" : "\u274C Offline"}
Uptime: <code>${data.uptimePercent.toFixed(2)}%</code>
Checks: <code>${data.checksUp}/${data.checksTotal}</code> passed

<b>\u2501\u2501\u2501 \u{1F6A6} Traffic (7 days) \u2501\u2501\u2501</b>
Weekly Cumulative Visitors: <code>${data.visits.toLocaleString()}</code>
Total Requests: <code>${data.totalRequests.toLocaleString()}</code>
Page Views: <code>${data.pageViews.toLocaleString()}</code>
Unique Visitors: <code>${data.visits.toLocaleString()}</code>
Total Bandwidth: <code>${formatBytes(data.bandwidth)}</code>${buildCountrySection(data.countryTraffic)}
Avg Cache Hit Rate: <code>${data.cacheHitRate}%</code>

<b>\u2501\u2501\u2501 \u26A1 Performance \u2501\u2501\u2501</b>
Avg TTFB: <code>${formatMs(data.avgTtfbMs)}</code>
Best TTFB: <code>${formatMs(Math.min(data.ttfbMs, data.avgTtfbMs))}</code>
Threshold: <code>3,000ms</code>

<b>\u2501\u2501\u2501 \u{1F6E1}\uFE0F Security \u2501\u2501\u2501</b>
Threats Blocked: <code>${data.threats}</code>
Total Alerts: <code>${data.recentAlerts}</code>
404 Errors (24h): <code>${data.count404 ?? 0}</code>

<b>\u2501\u2501\u2501 \u{1F517} Dashboard \u2501\u2501\u2501</b>
${ENV.dashboardUrl}`;
}
function buildMonthlyReport(data) {
  const statusIcon = data.isUp ? "\u{1F7E2}" : "\u{1F534}";
  return `<b>${statusIcon} NCR Watchdog \u2014 \u{1F4C6} Monthly Report \u2014 ${data.month}</b>
\u{1F550} ${getBangkokTime()} (Bangkok)
\u{1F310} <a href="https://nakornchiangrainews.com">nakornchiangrainews.com</a>

<b>\u2501\u2501\u2501 \u{1F4CA} Monthly Summary \u2501\u2501\u2501</b>
HTTP: <code>${data.httpCode}</code> ${data.isUp ? "\u2705 Online" : "\u274C Offline"}
Uptime: <code>${data.uptimePercent.toFixed(2)}%</code>
Total Checks: <code>${data.checksTotal}</code>
Passed: <code>${data.checksUp}</code>

<b>\u2501\u2501\u2501 \u{1F6A6} Traffic (30 days) \u2501\u2501\u2501</b>
Monthly Cumulative Visitors: <code>${data.visits.toLocaleString()}</code>
Total Requests: <code>${data.totalRequests.toLocaleString()}</code>
Page Views: <code>${data.pageViews.toLocaleString()}</code>
Unique Visitors: <code>${data.visits.toLocaleString()}</code>
Total Bandwidth: <code>${formatBytes(data.bandwidth)}</code>${buildCountrySection(data.countryTraffic)}
Avg Cache Hit Rate: <code>${data.cacheHitRate}%</code>

<b>\u2501\u2501\u2501 \u26A1 Performance \u2501\u2501\u2501</b>
Avg TTFB: <code>${formatMs(data.avgTtfbMs)}</code>
Threshold: <code>3,000ms</code>

<b>\u2501\u2501\u2501 \u{1F6E1}\uFE0F Security \u2501\u2501\u2501</b>
Threats Blocked: <code>${data.threats}</code>
Total Alerts: <code>${data.recentAlerts}</code>
404 Errors (24h): <code>${data.count404 ?? 0}</code>

<b>\u2501\u2501\u2501 \u{1F517} Dashboard \u2501\u2501\u2501</b>
${ENV.dashboardUrl}`;
}
function buildCritical404Alert(urls) {
  const lines = urls.map((u) => `\u2022 <code>${u}</code>`).join("\n");
  return `\u{1F6A8} <b>NCR Watchdog \u2014 CRITICAL 404 ALERT</b>
\u{1F550} ${getBangkokTime()} (Bangkok)
\u{1F310} <a href="https://nakornchiangrainews.com">nakornchiangrainews.com</a>

<b>\u26D4 Critical page(s) returning 404:</b>
${lines}

These pages should never return 404. Please check immediately.

<b>\u{1F517} Dashboard:</b> ${ENV.dashboardUrl}`;
}
function buildAlertMessage(alertType, data) {
  const icons = {
    downtime: "\u{1F534}",
    high_latency: "\u26A0\uFE0F",
    security: "\u{1F6E1}\uFE0F"
  };
  const titles = {
    downtime: "DOWNTIME DETECTED",
    high_latency: "HIGH LATENCY DETECTED",
    security: "SECURITY THREAT DETECTED"
  };
  const icon = icons[alertType];
  const title = titles[alertType];
  const autoFixLine = data.autoFixApplied ? "\n\u2705 <b>Auto-Fix Applied:</b> Cloudflare cache purged" : "\n\u26A0\uFE0F Auto-fix attempted";
  let detailLines = "";
  if (alertType === "downtime" && data.httpCode !== void 0) {
    detailLines = `
HTTP Code: <code>${data.httpCode}</code>`;
  } else if (alertType === "high_latency" && data.ttfbMs !== void 0) {
    detailLines = `
TTFB: <code>${formatMs(data.ttfbMs)}</code> (threshold: 3,000ms)`;
  } else if (data.detail) {
    detailLines = `
Detail: ${data.detail}`;
  }
  return `${icon} <b>NCR Watchdog ALERT \u2014 ${title}</b>
\u{1F550} ${getBangkokTime()} (Bangkok)
\u{1F310} <a href="https://nakornchiangrainews.com">nakornchiangrainews.com</a>${detailLines}${autoFixLine}

<b>\u{1F517} Dashboard:</b> ${ENV.dashboardUrl}`;
}
function buildSmartDiagnosisAlert(httpCode, ttfbMs, diagnosis) {
  return `\u{1F534} <b>NCR Watchdog ALERT \u2014 DOWNTIME DETECTED</b>
\u{1F550} ${getBangkokTime()} (Bangkok)
\u{1F310} <a href="https://nakornchiangrainews.com">nakornchiangrainews.com</a>

HTTP Code: <code>${httpCode}</code>
TTFB: <code>${formatMs(ttfbMs)}</code>

<b>\u{1F50D} Smart Diagnosis:</b>
<b>${diagnosis.label}</b>
${diagnosis.detail}

\u26A0\uFE0F Cache purge requires manual approval \u2014 see Dashboard.
<b>\u{1F517} Dashboard:</b> ${ENV.dashboardUrl}`;
}
function buildPredictiveWarning(ttfbValues) {
  const trend = ttfbValues.map((v) => `<code>${formatMs(v)}</code>`).join(" \u2192 ");
  return `\u26A0\uFE0F <b>NCR Watchdog \u2014 Performance Degradation Warning</b>
\u{1F550} ${getBangkokTime()} (Bangkok)
\u{1F310} <a href="https://nakornchiangrainews.com">nakornchiangrainews.com</a>

TTFB has increased for <b>3 consecutive checks</b>:
${trend}

This is a predictive warning \u2014 TTFB has not yet hit the 3,000ms threshold, but the trend suggests it may soon. Consider purging cache or checking server load.

<b>\u{1F517} Dashboard:</b> ${ENV.dashboardUrl}`;
}
function buildAdaptiveSecurityAlert(action, level, reason) {
  if (action === "elevated") {
    return `\u{1F6E1}\uFE0F <b>NCR Watchdog \u2014 Adaptive Security ACTIVATED</b>
\u{1F550} ${getBangkokTime()} (Bangkok)

Cloudflare Security Level set to <b>"${level}"</b>.
Reason: ${reason ?? "Spike in 5xx errors or TTFB > 4,000ms detected."}

The level will automatically revert to <b>"medium"</b> in 30 minutes once the site stabilises.

<b>\u{1F517} Dashboard:</b> ${ENV.dashboardUrl}`;
  }
  return `\u2705 <b>NCR Watchdog \u2014 Adaptive Security REVERTED</b>
\u{1F550} ${getBangkokTime()} (Bangkok)

Cloudflare Security Level restored to <b>"medium"</b>.
The site has been stable for 30 minutes.

<b>\u{1F517} Dashboard:</b> ${ENV.dashboardUrl}`;
}
function buildHostatomDownAlert(httpCode) {
  return `\u26A0\uFE0F <b>NCR Watchdog \u2014 Hostatom DOWN!</b>
\u{1F550} ${getBangkokTime()} (Bangkok)
\u{1F310} <a href="https://nakornchiangrainews.com">nakornchiangrainews.com</a>

HTTP Code: <code>${httpCode}</code>
<b>Cloudflare Stale Cache ACTIVE. (Site still online for readers)</b>
The origin server (Hostatom) is returning a ${httpCode} error. Cloudflare is serving cached pages to visitors.

<b>\u{1F517} Dashboard:</b> ${ENV.dashboardUrl}`;
}
function buildHostatomRecoveredAlert() {
  return `\u2705 <b>NCR Watchdog \u2014 Hostatom RECOVERED</b>
\u{1F550} ${getBangkokTime()} (Bangkok)
\u{1F310} <a href="https://nakornchiangrainews.com">nakornchiangrainews.com</a>

Server is back online. HTTP 200 OK confirmed.

<b>\u{1F517} Dashboard:</b> ${ENV.dashboardUrl}`;
}
function buildAutoBanAlert(ip, count404) {
  return `\u{1F6A8} <b>NCR Watchdog \u2014 [AUTO-BAN]</b>
\u{1F550} ${getBangkokTime()} (Bangkok)

Cloudflare blocked IP: <code>${ip}</code>
Reason: High 404 rate detected \u2014 <b>${count404} requests</b> in 5 minutes.

<b>\u{1F517} Dashboard:</b> ${ENV.dashboardUrl}`;
}
function buildCacheWarmedAlert(url) {
  return `\u26A1 <b>NCR Watchdog \u2014 [CACHE WARMED]</b>
\u{1F550} ${getBangkokTime()} (Bangkok)

New post ready for readers: <a href="${url}">${url}</a>

<b>\u{1F517} Dashboard:</b> ${ENV.dashboardUrl}`;
}
function buildCacheBypassAlert(status, wpCookie, potentialCause) {
  const cookieLine = wpCookie ? `
WP Cookie Detected: <code>${wpCookie}</code>` : "";
  return `\u{1F6A8} <b>NCR Watchdog \u2014 Cache BYPASS Alert</b>
\u{1F550} ${getBangkokTime()} (Bangkok)

CF Cache Status: <b>${status}</b> for 3 consecutive checks${cookieLine}
Cause: ${potentialCause}

<b>Action Required:</b> Check Cloudflare Caching settings and WordPress cookie rules to restore cache HIT rate.
<b>\u{1F517} Dashboard:</b> ${ENV.dashboardUrl}`;
}
function buildTopPostsReport(mode, posts) {
  const labels = {
    daily: "\u2600\uFE0F \u0E02\u0E48\u0E32\u0E27\u0E40\u0E14\u0E48\u0E19\u0E23\u0E32\u0E22\u0E27\u0E31\u0E19",
    weekly: "\u{1F4C5} \u0E02\u0E48\u0E32\u0E27\u0E40\u0E14\u0E48\u0E19\u0E23\u0E32\u0E22\u0E2A\u0E31\u0E1B\u0E14\u0E32\u0E2B\u0E4C",
    monthly: "\u{1F3C6} \u0E02\u0E48\u0E32\u0E27\u0E40\u0E14\u0E48\u0E19\u0E23\u0E32\u0E22\u0E40\u0E14\u0E37\u0E2D\u0E19"
  };
  const days = { daily: 1, weekly: 7, monthly: 30 };
  const label = labels[mode];
  const day = days[mode];
  const BASE_URL = "https://nakornchiangrainews.com";
  let lines = "";
  if (posts.length === 0) {
    lines = "\u2022 \u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25";
  } else {
    lines = posts.map(
      (p, i) => `${i + 1}. <a href="${BASE_URL}${p.path}">${p.path}</a>
   \u{1F441}\uFE0F <b>${p.count.toLocaleString()}</b> \u0E04\u0E23\u0E31\u0E49\u0E07`
    ).join("\n\n");
  }
  return `\u{1F4CA} <b>[NCR] ${label}</b>
\u{1F4C5} \u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E22\u0E49\u0E2D\u0E19\u0E2B\u0E25\u0E31\u0E07 ${day} \u0E27\u0E31\u0E19
\u23F0 ${getBangkokTime()} (Bangkok)

${lines}

\u{1F517} Dashboard: ${ENV.dashboardUrl}`;
}
function buildBlockRateAlert(blockRate, threats, totalRequests) {
  return `\u{1F6A8} <b>[SECURITY WARNING] Block Rate \u0E2A\u0E39\u0E07\u0E40\u0E01\u0E34\u0E19\u0E40\u0E01\u0E13\u0E11\u0E4C!</b>

\u{1F4CA} Block Rate: <b>${blockRate}%</b> (\u0E40\u0E01\u0E13\u0E11\u0E4C: 20%)
\u{1F6E1}\uFE0F Threats Blocked: <b>${threats.toLocaleString()}</b> requests
\u{1F4C8} Total Requests: <b>${totalRequests.toLocaleString()}</b>

\u26A0\uFE0F \u0E23\u0E30\u0E1A\u0E1A Cloudflare WAF \u0E01\u0E33\u0E25\u0E31\u0E07\u0E1A\u0E25\u0E47\u0E2D\u0E01 traffic \u0E08\u0E33\u0E19\u0E27\u0E19\u0E21\u0E32\u0E01
\u0E01\u0E23\u0E38\u0E13\u0E32\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A Security Events \u0E43\u0E19 Cloudflare Dashboard

\u{1F517} Dashboard: ${ENV.dashboardUrl}`;
}
function build404SpikeAlert(rate404, count404, totalRequests, top404Urls) {
  const ratePercent = (rate404 * 100).toFixed(1);
  const topLines = top404Urls.slice(0, 5).map((u, i) => `  ${i + 1}. <code>${u.url}</code> (${u.hits} hits)`).join("\n");
  return `\u{1F6A8} <b>[404 SPIKE ALERT] \u0E2D\u0E31\u0E15\u0E23\u0E32 404 \u0E2A\u0E39\u0E07\u0E1C\u0E34\u0E14\u0E1B\u0E01\u0E15\u0E34!</b>

\u{1F4CA} 404 Rate: <b>${ratePercent}%</b> (\u0E40\u0E01\u0E13\u0E11\u0E4C: 5%)
\u{1F522} 404 Errors: <b>${count404.toLocaleString()}</b> \u0E08\u0E32\u0E01 ${totalRequests.toLocaleString()} requests (1h)

\u{1F517} <b>Top 404 URLs:</b>
${topLines || "  (\u0E44\u0E21\u0E48\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25 URL)"}

\u26A0\uFE0F \u0E01\u0E23\u0E38\u0E13\u0E32\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A Broken Links \u0E41\u0E25\u0E30 Redirect Rules
\u{1F517} Dashboard: ${ENV.dashboardUrl}`;
}
function buildCacheEfficiencyReport(data) {
  const hitPct = (data.cacheHitRate * 100).toFixed(1);
  const adjPct = (data.adjustedCacheHitRate * 100).toFixed(1);
  const statusIcon = data.meetsTarget ? "\u2705" : "\u26A0\uFE0F";
  const statusText = data.meetsTarget ? "\u0E1C\u0E48\u0E32\u0E19\u0E40\u0E01\u0E13\u0E11\u0E4C (>85%)" : "\u0E15\u0E48\u0E33\u0E01\u0E27\u0E48\u0E32\u0E40\u0E01\u0E13\u0E11\u0E4C (<85%)";
  const fbclidNote = data.fbclidRequests > 0 ? `
\u{1F4F1} fbclid Requests: <b>${data.fbclidRequests.toLocaleString()}</b> (\u0E44\u0E21\u0E48\u0E19\u0E31\u0E1A\u0E43\u0E19 Adjusted Rate)` : "";
  return `${statusIcon} <b>[Cache Efficiency Audit \u2014 6h]</b>

\u{1F4CA} Cache Hit Rate: <b>${hitPct}%</b> (raw)
\u{1F3AF} Adjusted Rate: <b>${adjPct}%</b> (\u0E2B\u0E25\u0E31\u0E07 ignore fbclid) \u2014 ${statusText}
\u{1F4C8} Total Requests: <b>${data.totalRequests.toLocaleString()}</b>
\u{1F4BE} Cached Requests: <b>${data.cachedRequests.toLocaleString()}</b>${fbclidNote}

${data.meetsTarget ? "\u0E23\u0E30\u0E1A\u0E1A Cache \u0E17\u0E33\u0E07\u0E32\u0E19\u0E44\u0E14\u0E49\u0E14\u0E35 \u2728" : "\u26A0\uFE0F \u0E41\u0E19\u0E30\u0E19\u0E33\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A Cache Rules \u0E41\u0E25\u0E30 Page Rules \u0E43\u0E19 Cloudflare"}
\u{1F517} Dashboard: ${ENV.dashboardUrl}`;
}
function buildFBTrafficReport(data) {
  if (data.fbclidTotal === -1) {
    return `\u2139\uFE0F <b>[FB Traffic Validation]</b>

\u26A0\uFE0F Cloudflare plan \u0E44\u0E21\u0E48\u0E23\u0E2D\u0E07\u0E23\u0E31\u0E1A clientRequestQuery filter
\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E41\u0E22\u0E01 fbclid traffic \u0E44\u0E14\u0E49\u0E42\u0E14\u0E22\u0E15\u0E23\u0E07

\u0E41\u0E19\u0E30\u0E19\u0E33: \u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A Traffic Analytics \u0E43\u0E19 Cloudflare Dashboard \u0E41\u0E17\u0E19
\u{1F517} Dashboard: ${ENV.dashboardUrl}`;
  }
  if (data.fbclidTotal === 0) {
    return `\u2139\uFE0F <b>[FB Traffic Validation]</b>

\u{1F4CA} \u0E44\u0E21\u0E48\u0E1E\u0E1A fbclid requests \u0E43\u0E19 24h \u0E17\u0E35\u0E48\u0E1C\u0E48\u0E32\u0E19\u0E21\u0E32
\u0E2D\u0E32\u0E08\u0E40\u0E1B\u0E47\u0E19\u0E40\u0E1E\u0E23\u0E32\u0E30\u0E44\u0E21\u0E48\u0E21\u0E35\u0E42\u0E1E\u0E2A\u0E15\u0E4C Facebook \u0E43\u0E2B\u0E21\u0E48\u0E2B\u0E23\u0E37\u0E2D traffic \u0E15\u0E48\u0E33
\u{1F517} Dashboard: ${ENV.dashboardUrl}`;
  }
  const successPct = (data.successRate * 100).toFixed(1);
  const statusIcon = data.hasIssue ? "\u26A0\uFE0F" : "\u2705";
  const statusText = data.hasIssue ? "\u0E21\u0E35\u0E1B\u0E31\u0E0D\u0E2B\u0E32 \u2014 Success Rate \u0E15\u0E48\u0E33\u0E01\u0E27\u0E48\u0E32 95%" : "\u0E1B\u0E01\u0E15\u0E34";
  return `${statusIcon} <b>[FB Traffic Validation \u2014 24h]</b>

\u{1F4CA} fbclid Total: <b>${data.fbclidTotal.toLocaleString()}</b> requests
\u2705 Success (2xx): <b>${data.fbclidSuccess.toLocaleString()}</b>
\u274C Failure (4xx/5xx): <b>${data.fbclidFailure.toLocaleString()}</b>
\u{1F4C8} Success Rate: <b>${successPct}%</b> \u2014 ${statusText}

${data.hasIssue ? "\u26A0\uFE0F \u0E01\u0E23\u0E38\u0E13\u0E32\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A Redirect Rules \u0E41\u0E25\u0E30 404 URLs \u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A FB Traffic" : "FB Traffic \u0E44\u0E2B\u0E25\u0E40\u0E02\u0E49\u0E32\u0E40\u0E27\u0E47\u0E1A\u0E44\u0E14\u0E49\u0E1B\u0E01\u0E15\u0E34 \u2728"}
\u{1F517} Dashboard: ${ENV.dashboardUrl}`;
}
function buildCacheMissReport(data) {
  const missRatePct = (data.missRate * 100).toFixed(1);
  const statusIcon = data.hasHighMissRate ? "\u26A0\uFE0F" : "\u2705";
  const statusText = data.hasHighMissRate ? "MISS Rate \u0E2A\u0E39\u0E07\u0E01\u0E27\u0E48\u0E32 20% \u2014 \u0E04\u0E27\u0E23\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A Cache Rules" : "Cache MISS \u0E2D\u0E22\u0E39\u0E48\u0E43\u0E19\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E1B\u0E01\u0E15\u0E34";
  let msg = `${statusIcon} <b>[NCR V5.1] Cache MISS Pattern Analysis (6h)</b>
`;
  msg += `\u{1F4CA} Total Requests: ${data.totalRequests.toLocaleString()} | MISS: ${data.totalMissRequests.toLocaleString()} (${missRatePct}%)
`;
  msg += `${statusText}
`;
  if (data.topMissUrls.length > 0) {
    msg += `
\u{1F50D} <b>Top URLs \u0E17\u0E35\u0E48\u0E17\u0E33\u0E43\u0E2B\u0E49 TTFB \u0E1E\u0E35\u0E04:</b>
`;
    data.topMissUrls.slice(0, 5).forEach((u, i) => {
      msg += `${i + 1}. <code>${u.url}</code> \u2014 ${u.missCount.toLocaleString()} MISS
`;
    });
  }
  msg += `
\u{1F517} <a href="${ENV.dashboardUrl}">\u0E14\u0E39 Dashboard</a>`;
  return msg;
}
function buildWpDbLatencyAlert(latencyMs, status) {
  const icon = status === "critical" ? "\u{1F534}" : "\u{1F7E1}";
  const label = status === "critical" ? "\u0E27\u0E34\u0E01\u0E24\u0E15 (CRITICAL)" : "\u0E0A\u0E49\u0E32 (SLOW)";
  const threshold = status === "critical" ? "\u2265 1,000ms" : "\u2265 500ms";
  const advice = status === "critical" ? "\u26A0\uFE0F \u0E41\u0E19\u0E30\u0E19\u0E33\u0E43\u0E2B\u0E49\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A MySQL/MariaDB \u0E41\u0E25\u0E30 WP Cron \u0E17\u0E31\u0E19\u0E17\u0E35" : "\u{1F4A1} \u0E41\u0E19\u0E30\u0E19\u0E33\u0E43\u0E2B\u0E49\u0E1E\u0E31\u0E01\u0E01\u0E32\u0E23\u0E23\u0E31\u0E19\u0E23\u0E39\u0E1B\u0E20\u0E32\u0E1E (EWWW) \u0E41\u0E25\u0E30\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A Query Cache";
  return `${icon} <b>[NCR V5.2] WordPress DB \u0E0A\u0E49\u0E32\u0E1C\u0E34\u0E14\u0E1B\u0E01\u0E15\u0E34!</b>
\u23F1 Latency: <b>${latencyMs}ms</b> (${threshold})
\u0E2A\u0E16\u0E32\u0E19\u0E30: ${label}
${advice}
\u{1F517} <a href="${ENV.dashboardUrl}">\u0E14\u0E39 Dashboard</a>`;
}
function buildPageSpeedPayloadAlert(pageSizeMb) {
  const sizeFmt = pageSizeMb.toFixed(2);
  return `\u{1F534} <b>[NCR V7.0] Page Payload \u0E40\u0E01\u0E34\u0E19\u0E02\u0E35\u0E14\u0E08\u0E33\u0E01\u0E31\u0E14!</b>
\u{1F4E6} Page Size: <b>${sizeFmt} MB</b> (\u0E40\u0E01\u0E34\u0E19 5 MB)
\u26A0\uFE0F \u0E02\u0E19\u0E32\u0E14\u0E2B\u0E19\u0E49\u0E32\u0E40\u0E27\u0E47\u0E1A\u0E43\u0E2B\u0E0D\u0E48\u0E40\u0E01\u0E34\u0E19\u0E44\u0E1B\u0E2D\u0E32\u0E08\u0E17\u0E33\u0E43\u0E2B\u0E49\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E21\u0E37\u0E2D\u0E16\u0E37\u0E2D\u0E42\u0E2B\u0E25\u0E14\u0E0A\u0E49\u0E32
\u{1F4A1} \u0E41\u0E19\u0E30\u0E19\u0E33: \u0E1A\u0E35\u0E1A\u0E2D\u0E31\u0E14\u0E23\u0E39\u0E1B\u0E20\u0E32\u0E1E, \u0E40\u0E1B\u0E34\u0E14 lazy load, \u0E25\u0E14 JS/CSS \u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E08\u0E33\u0E40\u0E1B\u0E47\u0E19
\u{1F517} <a href="${ENV.dashboardUrl}">\u0E14\u0E39 Dashboard</a>`;
}
function buildArticleSpikeAlert(spikes) {
  let msg = `\u{1F680} <b>NCR Traffic Spike Alert</b>
`;
  msg += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
`;
  msg += `\u0E1E\u0E1A\u0E02\u0E48\u0E32\u0E27\u0E17\u0E35\u0E48\u0E21\u0E35\u0E1C\u0E39\u0E49\u0E40\u0E02\u0E49\u0E32\u0E0A\u0E21\u0E2A\u0E39\u0E07\u0E1C\u0E34\u0E14\u0E1B\u0E01\u0E15\u0E34\u0E43\u0E19 1 \u0E0A\u0E31\u0E48\u0E27\u0E42\u0E21\u0E07\u0E25\u0E48\u0E32\u0E2A\u0E38\u0E14

`;
  for (const item of spikes.slice(0, 5)) {
    const url = item.fullUrl ?? item.url;
    msg += `\u2022 <b>${item.views.toLocaleString()}</b> views \u2014 ${url}
`;
  }
  msg += `
\u0E04\u0E33\u0E41\u0E19\u0E30\u0E19\u0E33: \u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A Cache Hit, origin load \u0E41\u0E25\u0E30\u0E04\u0E27\u0E32\u0E21\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E02\u0E2D\u0E07\u0E1A\u0E17\u0E04\u0E27\u0E32\u0E21\u0E17\u0E35\u0E48\u0E01\u0E33\u0E25\u0E31\u0E07 viral`;
  return msg;
}
function buildBruteForceLoginAlert(offenders) {
  let msg = `\u{1F6E1}\uFE0F <b>NCR Brute-Force Login Alert</b>
`;
  msg += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
`;
  msg += `\u0E1E\u0E1A IP \u0E1E\u0E22\u0E32\u0E22\u0E32\u0E21 login/admin \u0E1C\u0E34\u0E14\u0E1E\u0E25\u0E32\u0E14\u0E2A\u0E39\u0E07\u0E43\u0E19 15 \u0E19\u0E32\u0E17\u0E35\u0E25\u0E48\u0E32\u0E2A\u0E38\u0E14

`;
  for (const item of offenders.slice(0, 5)) {
    msg += `\u2022 <code>${item.ip}</code> \u2014 <b>${item.attempts.toLocaleString()}</b> attempts (${item.topPath})
`;
  }
  msg += `
\u0E23\u0E30\u0E1A\u0E1A\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48 block \u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34\u0E08\u0E32\u0E01\u0E2A\u0E31\u0E0D\u0E0D\u0E32\u0E13\u0E19\u0E35\u0E49 \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E2B\u0E25\u0E35\u0E01\u0E40\u0E25\u0E35\u0E48\u0E22\u0E07 false positive; \u0E43\u0E0A\u0E49\u0E04\u0E39\u0E48\u0E01\u0E31\u0E1A Auto-Ban 404 \u0E40\u0E14\u0E34\u0E21\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E01\u0E23\u0E13\u0E35\u0E42\u0E08\u0E21\u0E15\u0E35\u0E0A\u0E31\u0E14\u0E40\u0E08\u0E19`;
  return msg;
}
function buildGoogleIndexingReport(result) {
  if (result.skipped) {
    return `\u{1F50E} <b>NCR Google Index Monitor</b>
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
Skipped: ${result.reason ?? "not configured"}`;
  }
  const indexed = result.results.filter((item) => item.verdict === "indexed").length;
  const needsAttention = result.results.filter((item) => item.verdict !== "indexed");
  let msg = `\u{1F50E} <b>NCR Google Index Monitor</b>
`;
  msg += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
`;
  msg += `Indexed: <b>${indexed}/${result.results.length}</b> URLs
`;
  if (needsAttention.length > 0) {
    msg += `
<b>Needs attention:</b>
`;
    for (const item of needsAttention.slice(0, 5)) {
      msg += `\u2022 <code>${item.url}</code> \u2014 ${item.coverageState ?? item.message ?? item.verdict}
`;
    }
  } else {
    msg += `
All monitored URLs are indexed or reported as indexed by Google Search Console.`;
  }
  return msg;
}
var getTelegramChatIds;
var init_telegram = __esm({
  "server/telegram.ts"() {
    "use strict";
    init_env();
    getTelegramChatIds = () => ENV.tgChatId.split(",").map((chatId) => chatId.trim()).filter(Boolean);
  }
});

// server/wordpress.ts
var wordpress_exports = {};
__export(wordpress_exports, {
  checkPageSpeedPayload: () => checkPageSpeedPayload,
  classifyWpDbLatency: () => classifyWpDbLatency,
  fetchWpSentinelV6: () => fetchWpSentinelV6,
  measureWpDbLatency: () => measureWpDbLatency
});
async function measureWpDbLatency() {
  const timestamp2 = /* @__PURE__ */ new Date();
  const url = `${WP_API_BASE}/posts?per_page=1&_fields=id`;
  try {
    const startTime = Date.now();
    const res = await fetch(url, {
      headers: { "User-Agent": "NCR-Watchdog-DbMonitor/5.2" },
      signal: AbortSignal.timeout(1e4)
      // 10s hard timeout
    });
    const latencyMs = Date.now() - startTime;
    const httpCode = res.status;
    const isError = !res.ok;
    if (isError) {
      return { latencyMs, status: "error", httpCode, isSlow: false, isCritical: false, isExcellent: false, timestamp: timestamp2 };
    }
    const isCritical = latencyMs >= 1e3;
    const isSlow = latencyMs >= 500;
    const isExcellent = latencyMs < 100;
    const status = isCritical ? "critical" : isSlow ? "slow" : isExcellent ? "excellent" : "ok";
    return { latencyMs, status, httpCode, isSlow, isCritical, isExcellent, timestamp: timestamp2 };
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "TimeoutError";
    return {
      latencyMs: isTimeout ? 1e4 : -1,
      status: "error",
      httpCode: 0,
      isSlow: true,
      isCritical: true,
      isExcellent: false,
      timestamp: timestamp2
    };
  }
}
async function fetchWpSentinelV6() {
  const fetchedAt = /* @__PURE__ */ new Date();
  try {
    const sentinelUrl = new URL(getWpSentinelUrl());
    sentinelUrl.searchParams.set("secret", ENV.ncrApiSecret);
    sentinelUrl.searchParams.set("v", String(Date.now()));
    const res = await fetch(sentinelUrl.toString(), {
      headers: {
        "User-Agent": "NCR-Watchdog-SentinelV10/10.7",
        "Cache-Control": "no-cache",
        "NCR-Secret": ENV.ncrApiSecret
      },
      signal: AbortSignal.timeout(15e3)
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const raw = await res.json();
    const dbLatencyRaw = String(raw.db_latency ?? "0");
    let dbLatencyMs;
    if (dbLatencyRaw.toLowerCase() === "low") {
      dbLatencyMs = 5;
    } else {
      const parsed = parseFloat(dbLatencyRaw.replace(/[^0-9.]/g, ""));
      dbLatencyMs = isNaN(parsed) ? -1 : Math.round(parsed * 1e3);
    }
    const diskRaw = String(raw.disk_free ?? "System Managed");
    const parsedDisk = parseFloat(diskRaw.replace(/[^0-9.]/g, ""));
    const diskSystemManaged = isNaN(parsedDisk) || diskRaw.toLowerCase().includes("system") || diskRaw.toLowerCase().includes("managed");
    const diskFreeGb = diskSystemManaged ? -1 : parsedDisk;
    const diskPermissionError = false;
    const rawStatus = raw.status;
    const operatingMode = normalizeOperatingMode(raw.operating_mode ?? raw.sentinel_mode ?? raw.mode, rawStatus);
    const health = normalizeWpHealth(raw.health ?? rawStatus);
    const status = normalizeWpStatus(rawStatus ?? raw.health);
    const wpHealth = health.label;
    const wpStatus = status.label;
    const healthAlert = health.alert;
    const statusCritical = status.critical;
    const rawTimestamp = String(raw.timestamp ?? "");
    const lastSystemCheck = rawTimestamp.includes(" ") ? rawTimestamp.split(" ")[1] : rawTimestamp;
    const memRaw = String(raw.memory_usage ?? "0 MB");
    const memoryUsageMb = parseFloat(memRaw.replace(/[^0-9.]/g, "")) || 0;
    const memoryStatus = memoryUsageMb >= 512 ? "critical" : memoryUsageMb >= 256 ? "warning" : "ok";
    const optimizedImagesRaw = firstPresent(raw, ["optimized_images", "images_optimized", "optimizedImages", "imagesOptimized", "ewww_optimized_images", "webp_images"]);
    const totalImagesRaw = firstPresent(raw, ["total_images", "images_total", "totalImages", "imagesTotal", "media_count", "total_media", "attachment_count", "attachments"]);
    const parsedOptimizedImages = parseNonNegativeNumber(optimizedImagesRaw);
    const parsedTotalImages = parseNonNegativeNumber(totalImagesRaw);
    const optimizedImages = Math.round(parsedOptimizedImages ?? 0);
    const totalImages = Math.round(parsedTotalImages ?? optimizedImages);
    const imageOptimizationPct = totalImages > 0 ? Math.min(100, Math.round(optimizedImages / totalImages * 100)) : 100;
    const verified404 = Number(raw.verified_404 ?? 0);
    const ttfbMs = dbLatencyMs;
    const cacheStatusLabel = ttfbMs >= 0 && ttfbMs < 100 ? "Cache Status: Stable" : "Cache Status: Checking";
    const dbStatus = dbLatencyMs < 0 ? "error" : dbLatencyMs >= 1e3 ? "critical" : dbLatencyMs >= 500 ? "slow" : "ok";
    const diskStatus = diskSystemManaged ? "system_managed" : diskFreeGb < 1.5 ? "critical" : diskFreeGb < 3 ? "warning" : "ok";
    return {
      dbLatencyMs,
      diskFreeGb,
      diskRawValue: diskRaw,
      diskSystemManaged,
      operatingMode,
      diskPermissionError,
      dbStatus,
      diskStatus,
      fetchedAt,
      rawResponse: raw,
      memoryUsageMb,
      memoryStatus,
      optimizedImages,
      totalImages,
      imageOptimizationPct,
      verified404,
      ttfbMs,
      cacheStatusLabel,
      wpHealth,
      wpStatus,
      healthAlert,
      statusCritical,
      lastSystemCheck
    };
  } catch (err) {
    return {
      dbLatencyMs: -1,
      diskFreeGb: -1,
      diskRawValue: "N/A",
      diskSystemManaged: false,
      operatingMode: "Unknown (fetch error)",
      diskPermissionError: false,
      dbStatus: "error",
      diskStatus: "system_managed",
      fetchedAt,
      rawResponse: {},
      memoryUsageMb: 0,
      memoryStatus: "ok",
      optimizedImages: 0,
      totalImages: 0,
      imageOptimizationPct: 0,
      verified404: 0,
      ttfbMs: -1,
      cacheStatusLabel: "Cache Status: Checking",
      wpHealth: "Unknown",
      wpStatus: "Unknown",
      healthAlert: true,
      statusCritical: true,
      lastSystemCheck: ""
    };
  }
}
function classifyWpDbLatency(latencyMs) {
  if (latencyMs < 0) return { icon: "\u26AB", label: "\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E15\u0E48\u0E2D\u0E44\u0E14\u0E49", status: "error" };
  if (latencyMs >= 1e3) return { icon: "\u{1F534}", label: "\u0E27\u0E34\u0E01\u0E24\u0E15 (CRITICAL)", status: "critical" };
  if (latencyMs >= 500) return { icon: "\u{1F7E1}", label: "\u0E0A\u0E49\u0E32 (SLOW)", status: "slow" };
  if (latencyMs < 100) return { icon: "\u{1F7E2}\u2728", label: "\u0E22\u0E2D\u0E14\u0E40\u0E22\u0E35\u0E48\u0E22\u0E21 (EXCELLENT)", status: "excellent" };
  return { icon: "\u{1F7E2}", label: "\u0E1B\u0E01\u0E15\u0E34 (OK)", status: "ok" };
}
async function checkPageSpeedPayload(url = "https://nakornchiangrainews.com/") {
  const fetchedAt = /* @__PURE__ */ new Date();
  const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&category=performance`;
  try {
    const res = await fetch(apiUrl, {
      headers: { "User-Agent": "NCR-Watchdog-PageSpeed/7.0" },
      signal: AbortSignal.timeout(3e4)
      // PageSpeed can be slow
    });
    if (!res.ok) {
      throw new Error(`PageSpeed API HTTP ${res.status}`);
    }
    const data = await res.json();
    const audits = data?.lighthouseResult?.audits;
    const totalByteWeight = audits?.["total-byte-weight"]?.numericValue ?? 0;
    const pageSizeBytes = Math.round(totalByteWeight);
    const pageSizeMb = pageSizeBytes / (1024 * 1024);
    const isOversized = pageSizeMb > 5;
    return { pageSizeBytes, pageSizeMb, isOversized, fetchedAt };
  } catch (err) {
    return {
      pageSizeBytes: 0,
      pageSizeMb: 0,
      isOversized: false,
      fetchedAt,
      error: err instanceof Error ? err.message : "Unknown error"
    };
  }
}
var WP_API_BASE, getWpSentinelUrl, normalizeSentinelToken, isPositiveSentinelToken, isWarningSentinelToken, normalizeWpHealth, normalizeWpStatus, normalizeOperatingMode, firstPresent, parseNonNegativeNumber;
var init_wordpress = __esm({
  "server/wordpress.ts"() {
    "use strict";
    init_env();
    WP_API_BASE = "https://nakornchiangrainews.com/wp-json/wp/v2";
    getWpSentinelUrl = () => ENV.wpSentinelUrl || `${ENV.wpSiteUrl.replace(/\/$/, "")}/wp-json/ncr/v3/monitor`;
    normalizeSentinelToken = (value) => String(value ?? "").trim().toLowerCase();
    isPositiveSentinelToken = (value) => {
      return ["ok", "safe", "stable", "healthy", "active", "enabled", "pass", "passed", "green", "full-autonomous mode", "autonomous"].includes(value);
    };
    isWarningSentinelToken = (value) => {
      return ["warning", "warn", "degraded", "attention", "slow", "amber", "yellow"].includes(value);
    };
    normalizeWpHealth = (value) => {
      const normalized = normalizeSentinelToken(value);
      if (isPositiveSentinelToken(normalized)) return { label: "Stable", alert: false };
      if (isWarningSentinelToken(normalized)) return { label: "Warning", alert: true };
      if (["critical", "error", "failed", "fail", "down", "red"].includes(normalized)) return { label: "Critical", alert: true };
      return { label: String(value ?? "Unknown") || "Unknown", alert: true };
    };
    normalizeWpStatus = (value) => {
      const normalized = normalizeSentinelToken(value);
      if (isPositiveSentinelToken(normalized)) return { label: "Full-Autonomous Mode", critical: false };
      if (isWarningSentinelToken(normalized)) return { label: "Attention Required", critical: true };
      if (["critical", "error", "failed", "fail", "down", "red"].includes(normalized)) return { label: "Critical", critical: true };
      const label = String(value ?? "Unknown") || "Unknown";
      return { label, critical: label !== "Full-Autonomous Mode" };
    };
    normalizeOperatingMode = (value, fallbackStatus) => {
      const normalized = normalizeSentinelToken(value);
      if (normalized && normalized !== "unknown") {
        if (isPositiveSentinelToken(normalized)) return "Autonomous Caretaker Active";
        if (isWarningSentinelToken(normalized)) return "Attention Required";
        if (["critical", "error", "failed", "fail", "down", "red"].includes(normalized)) return "Critical";
        return String(value).trim();
      }
      const statusToken = normalizeSentinelToken(fallbackStatus);
      if (isPositiveSentinelToken(statusToken)) return "Autonomous Caretaker Active";
      if (isWarningSentinelToken(statusToken)) return "Attention Required";
      if (["critical", "error", "failed", "fail", "down", "red"].includes(statusToken)) return "Critical";
      return "Autonomous Caretaker Active";
    };
    firstPresent = (raw, keys) => {
      for (const key of keys) {
        if (raw[key] !== void 0 && raw[key] !== null && String(raw[key]).trim() !== "") return raw[key];
      }
      return void 0;
    };
    parseNonNegativeNumber = (value) => {
      if (value === void 0 || value === null) return null;
      const normalized = String(value).replace(/,/g, "").trim();
      if (!normalized || normalized === "\u2014" || normalized === "-") return null;
      const parsed = Number.parseFloat(normalized.replace(/[^0-9.]/g, ""));
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
    };
  }
});

// server/_core/llm.ts
var llm_exports = {};
__export(llm_exports, {
  invokeLLM: () => invokeLLM
});
async function invokeLLM(params) {
  assertApiKey();
  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format
  } = params;
  const payload = {
    model: "gemini-2.5-flash",
    messages: messages.map(normalizeMessage)
  };
  if (tools && tools.length > 0) {
    payload.tools = tools;
  }
  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }
  payload.max_tokens = 32768;
  payload.thinking = {
    "budget_tokens": 128
  };
  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema
  });
  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }
  const response = await fetch(resolveApiUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.forgeApiKey}`
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} \u2013 ${errorText}`
    );
  }
  return await response.json();
}
var ensureArray, normalizeContentPart, normalizeMessage, normalizeToolChoice, resolveApiUrl, assertApiKey, normalizeResponseFormat;
var init_llm = __esm({
  "server/_core/llm.ts"() {
    "use strict";
    init_env();
    ensureArray = (value) => Array.isArray(value) ? value : [value];
    normalizeContentPart = (part) => {
      if (typeof part === "string") {
        return { type: "text", text: part };
      }
      if (part.type === "text") {
        return part;
      }
      if (part.type === "image_url") {
        return part;
      }
      if (part.type === "file_url") {
        return part;
      }
      throw new Error("Unsupported message content part");
    };
    normalizeMessage = (message) => {
      const { role, name, tool_call_id } = message;
      if (role === "tool" || role === "function") {
        const content = ensureArray(message.content).map((part) => typeof part === "string" ? part : JSON.stringify(part)).join("\n");
        return {
          role,
          name,
          tool_call_id,
          content
        };
      }
      const contentParts = ensureArray(message.content).map(normalizeContentPart);
      if (contentParts.length === 1 && contentParts[0].type === "text") {
        return {
          role,
          name,
          content: contentParts[0].text
        };
      }
      return {
        role,
        name,
        content: contentParts
      };
    };
    normalizeToolChoice = (toolChoice, tools) => {
      if (!toolChoice) return void 0;
      if (toolChoice === "none" || toolChoice === "auto") {
        return toolChoice;
      }
      if (toolChoice === "required") {
        if (!tools || tools.length === 0) {
          throw new Error(
            "tool_choice 'required' was provided but no tools were configured"
          );
        }
        if (tools.length > 1) {
          throw new Error(
            "tool_choice 'required' needs a single tool or specify the tool name explicitly"
          );
        }
        return {
          type: "function",
          function: { name: tools[0].function.name }
        };
      }
      if ("name" in toolChoice) {
        return {
          type: "function",
          function: { name: toolChoice.name }
        };
      }
      return toolChoice;
    };
    resolveApiUrl = () => ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0 ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions` : "https://forge.manus.im/v1/chat/completions";
    assertApiKey = () => {
      if (!ENV.forgeApiKey) {
        throw new Error("OPENAI_API_KEY is not configured");
      }
    };
    normalizeResponseFormat = ({
      responseFormat,
      response_format,
      outputSchema,
      output_schema
    }) => {
      const explicitFormat = responseFormat || response_format;
      if (explicitFormat) {
        if (explicitFormat.type === "json_schema" && !explicitFormat.json_schema?.schema) {
          throw new Error(
            "responseFormat json_schema requires a defined schema object"
          );
        }
        return explicitFormat;
      }
      const schema = outputSchema || output_schema;
      if (!schema) return void 0;
      if (!schema.name || !schema.schema) {
        throw new Error("outputSchema requires both name and schema");
      }
      return {
        type: "json_schema",
        json_schema: {
          name: schema.name,
          schema: schema.schema,
          ...typeof schema.strict === "boolean" ? { strict: schema.strict } : {}
        }
      };
    };
  }
});

// server/morningBrief.ts
var morningBrief_exports = {};
__export(morningBrief_exports, {
  buildMorningBriefMessage: () => buildMorningBriefMessage,
  fetchGlobalNews: () => fetchGlobalNews,
  fetchThaiNews: () => fetchThaiNews,
  generateEnglishSentences: () => generateEnglishSentences
});
async function fetchRSS(url, limit = 3) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "NCR-Watchdog/1.0 (+https://nakornchiangrainews.com)" },
      signal: AbortSignal.timeout(8e3)
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items = [];
    const itemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
    let match;
    while ((match = itemRegex.exec(xml)) !== null && items.length < limit) {
      const block = match[1];
      const titleMatch = block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
      const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/i) || block.match(/<guid[^>]*>(https?:\/\/[^<]+)<\/guid>/i);
      const title = titleMatch?.[1]?.trim().replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">") ?? "";
      const link = linkMatch?.[1]?.trim() ?? "";
      if (title) items.push({ title, link });
    }
    return items;
  } catch {
    return [];
  }
}
async function fetchThaiNews() {
  return fetchRSS("https://nakornchiangrainews.com/feed/", 3);
}
async function fetchGlobalNews() {
  const reuters = await fetchRSS("https://feeds.reuters.com/reuters/topNews", 3);
  if (reuters.length > 0) return reuters;
  return fetchRSS("https://feeds.bbci.co.uk/news/world/rss.xml", 3);
}
async function generateEnglishSentences() {
  try {
    const today = (/* @__PURE__ */ new Date()).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Asia/Bangkok"
    });
    const resp = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are an English teacher for Thai news journalists. Generate exactly 3 practical English sentences for daily use in a newsroom. Each sentence should be useful, natural, and at intermediate level. Format: numbered list 1. 2. 3. \u2014 no extra commentary."
        },
        {
          role: "user",
          content: `Today is ${today}. Generate 3 useful English sentences for a Thai journalist's morning practice.`
        }
      ]
    });
    const content = resp.choices?.[0]?.message?.content;
    const text2 = typeof content === "string" ? content.trim() : "";
    return text2 || "1. Good morning! 2. Today's news is ready. 3. Let's get started.";
  } catch {
    return "1. Good morning! 2. Today's news is ready. 3. Let's get started.";
  }
}
function buildMorningBriefMessage(params) {
  const { thaiNews, globalNews, agendaContent, englishSentences, dateLabel } = params;
  const thSection = thaiNews.length > 0 ? thaiNews.map((n, i) => `${i + 1}. <a href="${n.link}">${n.title}</a>`).join("\n") : "\u2022 \u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25";
  const globalSection = globalNews.length > 0 ? globalNews.map((n, i) => `${i + 1}. <a href="${n.link}">${n.title}</a>`).join("\n") : "\u2022 \u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25";
  const agendaSection = agendaContent?.trim() ? agendaContent.trim() : "\u2022 (\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E01\u0E23\u0E2D\u0E01\u0E27\u0E32\u0E23\u0E30\u0E27\u0E31\u0E19\u0E19\u0E35\u0E49)";
  const englishSection = englishSentences || "1. Good morning! 2. Today's news is ready. 3. Let's get started.";
  return `\u{1F305} <b>Morning Brief \u2014 ${dateLabel}</b>

\u{1F4F0} <b>\u0E02\u0E48\u0E32\u0E27\u0E40\u0E14\u0E48\u0E19 NCR \u0E27\u0E31\u0E19\u0E19\u0E35\u0E49</b>
${thSection}

\u{1F30D} <b>\u0E02\u0E48\u0E32\u0E27\u0E42\u0E25\u0E01</b>
${globalSection}

\u{1F4CB} <b>\u0E27\u0E32\u0E23\u0E30\u0E27\u0E31\u0E19\u0E19\u0E35\u0E49</b>
${agendaSection}

\u{1F1EC}\u{1F1E7} <b>English Practice (3 Sentences)</b>
${englishSection}

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u{1F6E1}\uFE0F NCR Watchdog \u2014 Credit-Optimized Mode`;
}
var init_morningBrief = __esm({
  "server/morningBrief.ts"() {
    "use strict";
    init_llm();
  }
});

// server/qualityAudit.ts
var qualityAudit_exports = {};
__export(qualityAudit_exports, {
  buildQualityAuditReport: () => buildQualityAuditReport,
  runQualityAudit: () => runQualityAudit
});
async function fetchPage(path4) {
  try {
    const res = await fetch(`${SITE_URL}${path4}`, {
      headers: { "User-Agent": "NCR-Watchdog/3.0 QualityAudit" },
      signal: AbortSignal.timeout(1e4)
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}
async function checkBrokenLinks(pagePath, html) {
  const issues = [];
  const hrefRegex = /href="(\/[^"#?]+)"/g;
  const links = /* @__PURE__ */ new Set();
  let m;
  while ((m = hrefRegex.exec(html)) !== null) {
    const href = m[1];
    if (href.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|webp)$/i)) continue;
    links.add(href);
  }
  const sample = Array.from(links).slice(0, 10);
  for (const link of sample) {
    try {
      const res = await fetch(`${SITE_URL}${link}`, {
        method: "HEAD",
        headers: { "User-Agent": "NCR-Watchdog/3.0 QualityAudit" },
        signal: AbortSignal.timeout(8e3)
      });
      if (res.status === 404) {
        issues.push({
          auditType: "broken-links",
          url: link,
          issue: `404 Not Found (found on ${pagePath})`,
          severity: "warning"
        });
      }
    } catch {
    }
  }
  return issues;
}
function checkSEO(pagePath, html) {
  const issues = [];
  if (!/<title[^>]*>[^<]{5,}<\/title>/i.test(html)) {
    issues.push({ auditType: "seo", url: pagePath, issue: "Missing or empty <title> tag", severity: "critical" });
  }
  if (!/<meta[^>]+name=["']description["'][^>]+content=["'][^"']{10,}["']/i.test(html)) {
    issues.push({ auditType: "seo", url: pagePath, issue: "Missing or short meta description", severity: "warning" });
  }
  if (!/<meta[^>]+property=["']og:title["'][^>]+content=["'][^"']{3,}["']/i.test(html)) {
    issues.push({ auditType: "seo", url: pagePath, issue: "Missing og:title meta tag", severity: "info" });
  }
  if (!/<h1[^>]*>[^<]{3,}<\/h1>/i.test(html)) {
    issues.push({ auditType: "seo", url: pagePath, issue: "Missing or empty <h1> tag", severity: "warning" });
  }
  return issues;
}
async function checkOversizedImages(pagePath, html) {
  const issues = [];
  const imgRegex = /src=["'](https?:\/\/nakornchiangrainews\.com\/[^"']+\.(?:jpg|jpeg|png|gif|webp))["']/gi;
  const imgs = /* @__PURE__ */ new Set();
  let m;
  while ((m = imgRegex.exec(html)) !== null) {
    imgs.add(m[1]);
  }
  const sample = Array.from(imgs).slice(0, 5);
  for (const imgUrl of sample) {
    try {
      const res = await fetch(imgUrl, {
        method: "HEAD",
        headers: { "User-Agent": "NCR-Watchdog/3.0 QualityAudit" },
        signal: AbortSignal.timeout(8e3)
      });
      const contentLength = res.headers.get("content-length");
      if (contentLength) {
        const sizeKB = parseInt(contentLength) / 1024;
        if (sizeKB > 500) {
          issues.push({
            auditType: "images",
            url: imgUrl,
            issue: `Oversized image: ${Math.round(sizeKB)}KB (found on ${pagePath})`,
            severity: sizeKB > 1e3 ? "critical" : "warning"
          });
        }
      }
    } catch {
    }
  }
  return issues;
}
async function runQualityAudit() {
  const allIssues = [];
  for (const pagePath of AUDIT_PAGES) {
    const html = await fetchPage(pagePath);
    if (!html) {
      allIssues.push({
        auditType: "broken-links",
        url: pagePath,
        issue: "Page failed to load (network error or non-200 status)",
        severity: "critical"
      });
      continue;
    }
    const [brokenLinkIssues, seoIssues, imageIssues] = await Promise.all([
      checkBrokenLinks(pagePath, html),
      Promise.resolve(checkSEO(pagePath, html)),
      checkOversizedImages(pagePath, html)
    ]);
    allIssues.push(...brokenLinkIssues, ...seoIssues, ...imageIssues);
  }
  return allIssues;
}
function buildQualityAuditReport(issues, dashboardUrl) {
  const critical = issues.filter((i) => i.severity === "critical");
  const warnings = issues.filter((i) => i.severity === "warning");
  const infos = issues.filter((i) => i.severity === "info");
  const brokenCount = issues.filter((i) => i.auditType === "broken-links").length;
  const seoCount = issues.filter((i) => i.auditType === "seo").length;
  const imageCount = issues.filter((i) => i.auditType === "images").length;
  let msg = `\u{1F50D} <b>[NCR] Quality Audit \u0E23\u0E32\u0E22\u0E2A\u0E31\u0E1B\u0E14\u0E32\u0E2B\u0E4C</b>
`;
  msg += `\u{1F4C5} ${(/* @__PURE__ */ new Date()).toLocaleDateString("th-TH", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Bangkok" })}
`;
  msg += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
`;
  if (issues.length === 0) {
    msg += `\u2705 <b>\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E1B\u0E31\u0E0D\u0E2B\u0E32!</b> \u0E40\u0E27\u0E47\u0E1A\u0E44\u0E0B\u0E15\u0E4C\u0E2D\u0E22\u0E39\u0E48\u0E43\u0E19\u0E2A\u0E20\u0E32\u0E1E\u0E14\u0E35
`;
  } else {
    msg += `\u{1F4CA} \u0E1E\u0E1A\u0E1B\u0E31\u0E0D\u0E2B\u0E32\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14 <b>${issues.length}</b> \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23:
`;
    msg += `\u{1F517} Broken Links: <b>${brokenCount}</b>
`;
    msg += `\u{1F3F7}\uFE0F SEO Issues: <b>${seoCount}</b>
`;
    msg += `\u{1F5BC}\uFE0F Oversized Images: <b>${imageCount}</b>
`;
    msg += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
`;
    if (critical.length > 0) {
      msg += `
\u{1F6A8} <b>Critical (${critical.length}):</b>
`;
      critical.slice(0, 5).forEach((i) => {
        msg += `\u2022 <code>${i.url}</code>
  ${i.issue}
`;
      });
    }
    if (warnings.length > 0) {
      msg += `
\u26A0\uFE0F <b>Warnings (${warnings.length}):</b>
`;
      warnings.slice(0, 5).forEach((i) => {
        msg += `\u2022 <code>${i.url}</code>: ${i.issue}
`;
      });
    }
    if (infos.length > 0) {
      msg += `
\u{1F4A1} <b>Info (${infos.length}):</b>
`;
      infos.slice(0, 3).forEach((i) => {
        msg += `\u2022 <code>${i.url}</code>: ${i.issue}
`;
      });
    }
  }
  msg += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
`;
  msg += `\u{1F517} <a href="${dashboardUrl}">\u0E14\u0E39 Dashboard</a>`;
  return msg;
}
var SITE_URL, AUDIT_PAGES;
var init_qualityAudit = __esm({
  "server/qualityAudit.ts"() {
    "use strict";
    SITE_URL = "https://nakornchiangrainews.com";
    AUDIT_PAGES = [
      "/",
      "/category/news/",
      "/category/lifestyle/",
      "/category/sport/",
      "/category/entertainment/",
      "/category/local/",
      "/category/politics/"
    ];
  }
});

// server/gemini.ts
var gemini_exports = {};
__export(gemini_exports, {
  QUOTA_COOLDOWN_KEY: () => QUOTA_COOLDOWN_KEY,
  QUOTA_COOLDOWN_MINUTES: () => QUOTA_COOLDOWN_MINUTES,
  QUOTA_WARNING_KEY: () => QUOTA_WARNING_KEY,
  analyzePublicMood: () => analyzePublicMood,
  buildCrisisDraftAlert: () => buildCrisisDraftAlert,
  buildMoodScanReport: () => buildMoodScanReport,
  callGemini: () => callGemini,
  callGeminiRaw: () => callGeminiRaw,
  draftCrisisResponse: () => draftCrisisResponse,
  generateFactBasedReply: () => generateFactBasedReply,
  generateViralCaption: () => generateViralCaption
});
async function callGeminiRaw(prompt, temperature = 0.7) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");
  const r = await fetch(`${GEMINI_API_URL}?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature, maxOutputTokens: 1024 }
    }),
    signal: AbortSignal.timeout(2e4)
  });
  const data = await r.json();
  if (!r.ok) {
    const httpStatus = r.status;
    const msg = data?.error?.message ?? `HTTP ${httpStatus}`;
    const err = new Error(`Gemini API error: ${msg}`);
    err.status = httpStatus;
    throw err;
  }
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}
async function callGemini(prompt, temperature = 0.7, fallback = "") {
  const { isInCooldown: isInCooldown2, setCooldown: setCooldown2 } = await Promise.resolve().then(() => (init_db(), db_exports));
  const inCooldown = await isInCooldown2(QUOTA_COOLDOWN_KEY);
  if (inCooldown) {
    console.log("[gemini] Quota Guard active \u2014 skipping AI call to save credits.");
    return fallback;
  }
  try {
    const result = await callGeminiRaw(prompt, temperature);
    await setCooldown2(QUOTA_WARNING_KEY, 0);
    return result;
  } catch (err) {
    if (err.status === 429) {
      await setCooldown2(QUOTA_COOLDOWN_KEY, QUOTA_COOLDOWN_MINUTES);
      const warningSent = await isInCooldown2(QUOTA_WARNING_KEY);
      if (!warningSent) {
        try {
          const { sendTelegramMessage: sendTelegramMessage2 } = await Promise.resolve().then(() => (init_telegram(), telegram_exports));
          await sendTelegramMessage2(
            "\u{1F6A8} <b>[Manager Warning] \u0E42\u0E04\u0E27\u0E15\u0E32 AI (Gemini) \u0E40\u0E15\u0E47\u0E21\u0E0A\u0E31\u0E48\u0E27\u0E04\u0E23\u0E32\u0E27\u0E04\u0E23\u0E31\u0E1A\u0E17\u0E48\u0E32\u0E19 \u0E1A\u0E01.</b>\n\u0E23\u0E30\u0E1A\u0E1A\u0E08\u0E30\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48\u0E42\u0E2B\u0E21\u0E14 '\u0E1B\u0E23\u0E30\u0E2B\u0E22\u0E31\u0E14\u0E1E\u0E25\u0E31\u0E07\u0E07\u0E32\u0E19' 60 \u0E19\u0E32\u0E17\u0E35 \u0E42\u0E14\u0E22\u0E08\u0E30\u0E2A\u0E48\u0E07\u0E40\u0E09\u0E1E\u0E32\u0E30\u0E23\u0E32\u0E22\u0E07\u0E32\u0E19\u0E15\u0E31\u0E27\u0E40\u0E25\u0E02\u0E14\u0E34\u0E1A (Text Only) \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E44\u0E21\u0E48\u0E43\u0E2B\u0E49\u0E23\u0E30\u0E1A\u0E1A Ghost \u0E41\u0E25\u0E30\u0E08\u0E30\u0E01\u0E25\u0E31\u0E1A\u0E21\u0E32\u0E43\u0E0A\u0E49 AI \u0E1B\u0E01\u0E15\u0E34\u0E43\u0E19\u0E2D\u0E35\u0E01 1 \u0E0A\u0E21. \u0E04\u0E23\u0E31\u0E1A"
          );
          await setCooldown2(QUOTA_WARNING_KEY, QUOTA_COOLDOWN_MINUTES);
        } catch (tgErr) {
          console.warn("[gemini] Failed to send quota warning to Telegram:", tgErr);
        }
      }
      console.warn("[gemini] 429 Quota exceeded \u2014 entering 60-min cooldown.");
      return fallback;
    }
    throw err;
  }
}
async function generateViralCaption(postTitle, postExcerpt, postUrl) {
  const prompt = `\u0E04\u0E38\u0E13\u0E40\u0E1B\u0E47\u0E19 Social Media Manager \u0E21\u0E37\u0E2D\u0E2D\u0E32\u0E0A\u0E35\u0E1E\u0E02\u0E2D\u0E07\u0E2A\u0E33\u0E19\u0E31\u0E01\u0E02\u0E48\u0E32\u0E27 "\u0E19\u0E04\u0E23\u0E40\u0E0A\u0E35\u0E22\u0E07\u0E23\u0E32\u0E22\u0E19\u0E34\u0E27\u0E2A\u0E4C"

\u0E1A\u0E17\u0E04\u0E27\u0E32\u0E21: "${postTitle}"
\u0E2A\u0E23\u0E38\u0E1B\u0E22\u0E48\u0E2D: "${postExcerpt.substring(0, 400)}"
\u0E25\u0E34\u0E07\u0E01\u0E4C: ${postUrl}

\u0E2A\u0E23\u0E49\u0E32\u0E07 Facebook Caption \u0E20\u0E32\u0E29\u0E32\u0E44\u0E17\u0E22\u0E42\u0E14\u0E22\u0E43\u0E0A\u0E49 AIDA Framework:
- Attention: \u0E1B\u0E23\u0E30\u0E42\u0E22\u0E04\u0E40\u0E1B\u0E34\u0E14\u0E17\u0E35\u0E48\u0E14\u0E36\u0E07\u0E14\u0E39\u0E14\u0E04\u0E27\u0E32\u0E21\u0E2A\u0E19\u0E43\u0E08 (\u0E43\u0E0A\u0E49\u0E04\u0E33\u0E16\u0E32\u0E21\u0E2B\u0E23\u0E37\u0E2D\u0E02\u0E49\u0E2D\u0E40\u0E17\u0E47\u0E08\u0E08\u0E23\u0E34\u0E07\u0E17\u0E35\u0E48\u0E19\u0E48\u0E32\u0E15\u0E01\u0E43\u0E08)
- Interest: \u0E2D\u0E18\u0E34\u0E1A\u0E32\u0E22\u0E2A\u0E32\u0E23\u0E30\u0E2A\u0E33\u0E04\u0E31\u0E0D\u0E02\u0E2D\u0E07\u0E02\u0E48\u0E32\u0E27 2-3 \u0E1B\u0E23\u0E30\u0E42\u0E22\u0E04
- Desire: \u0E40\u0E2B\u0E15\u0E38\u0E1C\u0E25\u0E17\u0E35\u0E48\u0E1C\u0E39\u0E49\u0E2D\u0E48\u0E32\u0E19\u0E04\u0E27\u0E23\u0E2A\u0E19\u0E43\u0E08
- Action: CTA \u0E43\u0E2B\u0E49\u0E04\u0E25\u0E34\u0E01\u0E2D\u0E48\u0E32\u0E19\u0E15\u0E48\u0E2D

\u0E02\u0E49\u0E2D\u0E01\u0E33\u0E2B\u0E19\u0E14:
- \u0E04\u0E27\u0E32\u0E21\u0E22\u0E32\u0E27\u0E23\u0E27\u0E21 100-150 \u0E04\u0E33
- \u0E43\u0E0A\u0E49 emoji 2-3 \u0E15\u0E31\u0E27\u0E17\u0E35\u0E48\u0E40\u0E2B\u0E21\u0E32\u0E30\u0E2A\u0E21
- \u0E25\u0E07\u0E17\u0E49\u0E32\u0E22\u0E14\u0E49\u0E27\u0E22 "\u0E2D\u0E48\u0E32\u0E19\u0E15\u0E48\u0E2D: ${postUrl}"
- \u0E2B\u0E49\u0E32\u0E21\u0E43\u0E0A\u0E49 clickbait \u0E2B\u0E23\u0E37\u0E2D\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E40\u0E01\u0E34\u0E19\u0E08\u0E23\u0E34\u0E07
- \u0E15\u0E2D\u0E1A\u0E40\u0E09\u0E1E\u0E32\u0E30 caption \u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19 \u0E44\u0E21\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E2D\u0E18\u0E34\u0E1A\u0E32\u0E22\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E40\u0E15\u0E34\u0E21`;
  const caption = await callGemini(prompt, 0.8, "[\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E2A\u0E23\u0E49\u0E32\u0E07 Caption \u0E44\u0E14\u0E49\u0E43\u0E19\u0E02\u0E13\u0E30\u0E19\u0E35\u0E49 \u2014 \u0E42\u0E04\u0E27\u0E15\u0E32 AI \u0E40\u0E15\u0E47\u0E21]");
  return { caption: caption.trim(), postUrl, postTitle };
}
async function analyzePublicMood(comments) {
  if (comments.length === 0) {
    return {
      overallSentiment: "neutral",
      positivePercent: 0,
      negativePercent: 0,
      neutralPercent: 100,
      emergingTopics: [],
      dramaAlert: false,
      summary: "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E04\u0E27\u0E32\u0E21\u0E04\u0E34\u0E14\u0E40\u0E2B\u0E47\u0E19\u0E43\u0E19\u0E0A\u0E48\u0E27\u0E07\u0E19\u0E35\u0E49"
    };
  }
  const commentSample = comments.slice(0, 50).map((c, i) => `${i + 1}. "${c.message.substring(0, 100)}"`).join("\n");
  const prompt = `\u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C sentiment \u0E02\u0E2D\u0E07\u0E04\u0E27\u0E32\u0E21\u0E04\u0E34\u0E14\u0E40\u0E2B\u0E47\u0E19\u0E1A\u0E19 Facebook Page "\u0E19\u0E04\u0E23\u0E40\u0E0A\u0E35\u0E22\u0E07\u0E23\u0E32\u0E22\u0E19\u0E34\u0E27\u0E2A\u0E4C" \u0E08\u0E33\u0E19\u0E27\u0E19 ${comments.length} \u0E04\u0E27\u0E32\u0E21\u0E04\u0E34\u0E14\u0E40\u0E2B\u0E47\u0E19 (\u0E15\u0E31\u0E27\u0E2D\u0E22\u0E48\u0E32\u0E07 50 \u0E04\u0E27\u0E32\u0E21\u0E04\u0E34\u0E14\u0E40\u0E2B\u0E47\u0E19):

${commentSample}

\u0E15\u0E2D\u0E1A\u0E43\u0E19\u0E23\u0E39\u0E1B\u0E41\u0E1A\u0E1A JSON \u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19 (\u0E44\u0E21\u0E48\u0E21\u0E35 markdown):
{
  "overallSentiment": "positive|neutral|negative|mixed",
  "positivePercent": <0-100>,
  "negativePercent": <0-100>,
  "neutralPercent": <0-100>,
  "emergingTopics": ["\u0E2B\u0E31\u0E27\u0E02\u0E49\u0E2D1", "\u0E2B\u0E31\u0E27\u0E02\u0E49\u0E2D2", "\u0E2B\u0E31\u0E27\u0E02\u0E49\u0E2D3"],
  "dramaAlert": <true|false>,
  "summary": "\u0E2A\u0E23\u0E38\u0E1B\u0E20\u0E32\u0E29\u0E32\u0E44\u0E17\u0E22 2-3 \u0E1B\u0E23\u0E30\u0E42\u0E22\u0E04"
}`;
  const raw = await callGemini(prompt, 0.3, "");
  if (!raw) {
    return {
      overallSentiment: "neutral",
      positivePercent: 0,
      negativePercent: 0,
      neutralPercent: 100,
      emergingTopics: [],
      dramaAlert: false,
      summary: "\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C\u0E44\u0E14\u0E49\u0E43\u0E19\u0E02\u0E13\u0E30\u0E19\u0E35\u0E49 \u2014 \u0E42\u0E04\u0E27\u0E15\u0E32 AI \u0E40\u0E15\u0E47\u0E21"
    };
  }
  try {
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return {
      overallSentiment: "neutral",
      positivePercent: 33,
      negativePercent: 33,
      neutralPercent: 34,
      emergingTopics: [],
      dramaAlert: false,
      summary: raw.substring(0, 200)
    };
  }
}
function buildMoodScanReport(result, commentCount) {
  const sentimentEmoji = result.overallSentiment === "positive" ? "\u{1F60A}" : result.overallSentiment === "negative" ? "\u{1F620}" : result.overallSentiment === "mixed" ? "\u{1F914}" : "\u{1F610}";
  const dramaLine = result.dramaAlert ? "\n\u26A0\uFE0F <b>\u0E15\u0E23\u0E27\u0E08\u0E1E\u0E1A\u0E14\u0E23\u0E32\u0E21\u0E48\u0E32\u0E17\u0E35\u0E48\u0E01\u0E33\u0E25\u0E31\u0E07\u0E40\u0E01\u0E34\u0E14\u0E02\u0E36\u0E49\u0E19!</b> \u0E01\u0E23\u0E38\u0E13\u0E32\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E14\u0E48\u0E27\u0E19" : "";
  const topics = result.emergingTopics.length > 0 ? `
\u{1F4CC} <b>\u0E2B\u0E31\u0E27\u0E02\u0E49\u0E2D\u0E17\u0E35\u0E48\u0E01\u0E33\u0E25\u0E31\u0E07\u0E21\u0E32:</b> ${result.emergingTopics.join(", ")}` : "";
  return `\u{1F3AD} <b>[NCR] Public Mood Scanner \u0E23\u0E32\u0E22\u0E2A\u0E31\u0E1B\u0E14\u0E32\u0E2B\u0E4C</b>

${sentimentEmoji} <b>Sentiment \u0E23\u0E27\u0E21:</b> ${result.overallSentiment.toUpperCase()}
\u{1F4CA} <b>\u0E2A\u0E31\u0E14\u0E2A\u0E48\u0E27\u0E19:</b> \u{1F60A} ${result.positivePercent}% | \u{1F610} ${result.neutralPercent}% | \u{1F620} ${result.negativePercent}%
\u{1F4AC} <b>\u0E04\u0E27\u0E32\u0E21\u0E04\u0E34\u0E14\u0E40\u0E2B\u0E47\u0E19\u0E17\u0E35\u0E48\u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C:</b> ${commentCount} \u0E04\u0E27\u0E32\u0E21\u0E04\u0E34\u0E14\u0E40\u0E2B\u0E47\u0E19${topics}${dramaLine}

\u{1F4DD} <b>\u0E2A\u0E23\u0E38\u0E1B:</b>
${result.summary}`;
}
async function draftCrisisResponse(comment, postTitle) {
  const prompt = `\u0E04\u0E38\u0E13\u0E40\u0E1B\u0E47\u0E19\u0E17\u0E35\u0E48\u0E1B\u0E23\u0E36\u0E01\u0E29\u0E32\u0E14\u0E49\u0E32\u0E19\u0E01\u0E32\u0E23\u0E2A\u0E37\u0E48\u0E2D\u0E2A\u0E32\u0E23\u0E27\u0E34\u0E01\u0E24\u0E15\u0E02\u0E2D\u0E07\u0E2A\u0E33\u0E19\u0E31\u0E01\u0E02\u0E48\u0E32\u0E27 "\u0E19\u0E04\u0E23\u0E40\u0E0A\u0E35\u0E22\u0E07\u0E23\u0E32\u0E22\u0E19\u0E34\u0E27\u0E2A\u0E4C"

\u0E1A\u0E17\u0E04\u0E27\u0E32\u0E21\u0E17\u0E35\u0E48\u0E40\u0E01\u0E35\u0E48\u0E22\u0E27\u0E02\u0E49\u0E2D\u0E07: "${postTitle}"
\u0E04\u0E27\u0E32\u0E21\u0E04\u0E34\u0E14\u0E40\u0E2B\u0E47\u0E19\u0E17\u0E35\u0E48\u0E21\u0E35\u0E04\u0E27\u0E32\u0E21\u0E40\u0E2A\u0E35\u0E48\u0E22\u0E07\u0E2A\u0E39\u0E07: "${comment}"

\u0E23\u0E48\u0E32\u0E07\u0E04\u0E33\u0E15\u0E2D\u0E1A\u0E21\u0E37\u0E2D\u0E2D\u0E32\u0E0A\u0E35\u0E1E\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A \u0E1A\u0E01. \u0E1E\u0E34\u0E08\u0E32\u0E23\u0E13\u0E32 \u0E42\u0E14\u0E22:
1. \u0E22\u0E2D\u0E21\u0E23\u0E31\u0E1A\u0E04\u0E27\u0E32\u0E21\u0E01\u0E31\u0E07\u0E27\u0E25\u0E02\u0E2D\u0E07\u0E1C\u0E39\u0E49\u0E2D\u0E48\u0E32\u0E19\u0E14\u0E49\u0E27\u0E22\u0E04\u0E27\u0E32\u0E21\u0E40\u0E04\u0E32\u0E23\u0E1E
2. \u0E43\u0E2B\u0E49\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E17\u0E35\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07\u0E15\u0E32\u0E21\u0E2B\u0E25\u0E31\u0E01\u0E08\u0E23\u0E34\u0E22\u0E18\u0E23\u0E23\u0E21\u0E2A\u0E37\u0E48\u0E2D
3. \u0E44\u0E21\u0E48\u0E15\u0E2D\u0E1A\u0E42\u0E15\u0E49\u0E2B\u0E23\u0E37\u0E2D\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E04\u0E27\u0E32\u0E21\u0E02\u0E31\u0E14\u0E41\u0E22\u0E49\u0E07
4. \u0E04\u0E27\u0E32\u0E21\u0E22\u0E32\u0E27\u0E44\u0E21\u0E48\u0E40\u0E01\u0E34\u0E19 3 \u0E1B\u0E23\u0E30\u0E42\u0E22\u0E04

\u0E15\u0E2D\u0E1A\u0E43\u0E19\u0E23\u0E39\u0E1B\u0E41\u0E1A\u0E1A JSON (\u0E44\u0E21\u0E48\u0E21\u0E35 markdown):
{
  "draftResponse": "\u0E04\u0E33\u0E15\u0E2D\u0E1A\u0E23\u0E48\u0E32\u0E07\u0E20\u0E32\u0E29\u0E32\u0E44\u0E17\u0E22",
  "riskLevel": "high|critical",
  "recommendedAction": "\u0E04\u0E33\u0E41\u0E19\u0E30\u0E19\u0E33\u0E2A\u0E31\u0E49\u0E19\u0E46 \u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A \u0E1A\u0E01."
}`;
  const raw = await callGemini(prompt, 0.4, "");
  if (!raw) {
    return {
      draftResponse: "[\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E23\u0E48\u0E32\u0E07\u0E04\u0E33\u0E15\u0E2D\u0E1A\u0E44\u0E14\u0E49\u0E43\u0E19\u0E02\u0E13\u0E30\u0E19\u0E35\u0E49 \u2014 \u0E42\u0E04\u0E27\u0E15\u0E32 AI \u0E40\u0E15\u0E47\u0E21 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E23\u0E48\u0E32\u0E07\u0E14\u0E49\u0E27\u0E22\u0E15\u0E19\u0E40\u0E2D\u0E07]",
      riskLevel: "high",
      recommendedAction: "\u0E42\u0E04\u0E27\u0E15\u0E32 AI \u0E40\u0E15\u0E47\u0E21 \u2014 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E41\u0E25\u0E30\u0E23\u0E48\u0E32\u0E07\u0E04\u0E33\u0E15\u0E2D\u0E1A\u0E14\u0E49\u0E27\u0E22\u0E15\u0E19\u0E40\u0E2D\u0E07"
    };
  }
  try {
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return {
      draftResponse: raw.substring(0, 300),
      riskLevel: "high",
      recommendedAction: "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E41\u0E25\u0E30\u0E1B\u0E23\u0E31\u0E1A\u0E41\u0E01\u0E49\u0E01\u0E48\u0E2D\u0E19\u0E15\u0E2D\u0E1A"
    };
  }
}
function buildCrisisDraftAlert(comment, postTitle, draft) {
  const riskEmoji = draft.riskLevel === "critical" ? "\u{1F6A8}" : "\u26A0\uFE0F";
  return `${riskEmoji} <b>[NCR Crisis Assistant] \u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E01\u0E32\u0E23\u0E1E\u0E34\u0E08\u0E32\u0E23\u0E13\u0E32</b>

\u{1F4F0} <b>\u0E1A\u0E17\u0E04\u0E27\u0E32\u0E21:</b> ${postTitle}
\u{1F4AC} <b>Comment \u0E40\u0E2A\u0E35\u0E48\u0E22\u0E07:</b>
"${comment.substring(0, 200)}"

\u270D\uFE0F <b>\u0E23\u0E48\u0E32\u0E07\u0E04\u0E33\u0E15\u0E2D\u0E1A (AI Draft):</b>
<i>${draft.draftResponse}</i>

\u{1F4CB} <b>\u0E04\u0E33\u0E41\u0E19\u0E30\u0E19\u0E33:</b> ${draft.recommendedAction}

\u26A1 <b>\u0E01\u0E23\u0E38\u0E13\u0E32\u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34\u0E2B\u0E23\u0E37\u0E2D\u0E41\u0E01\u0E49\u0E44\u0E02\u0E01\u0E48\u0E2D\u0E19\u0E15\u0E2D\u0E1A</b>`;
}
async function generateFactBasedReply(comment, articleTitle, articleContent) {
  const prompt = `\u0E04\u0E38\u0E13\u0E40\u0E1B\u0E47\u0E19\u0E1C\u0E39\u0E49\u0E0A\u0E48\u0E27\u0E22\u0E15\u0E2D\u0E1A\u0E04\u0E27\u0E32\u0E21\u0E04\u0E34\u0E14\u0E40\u0E2B\u0E47\u0E19\u0E02\u0E2D\u0E07\u0E2A\u0E33\u0E19\u0E31\u0E01\u0E02\u0E48\u0E32\u0E27 "\u0E19\u0E04\u0E23\u0E40\u0E0A\u0E35\u0E22\u0E07\u0E23\u0E32\u0E22\u0E19\u0E34\u0E27\u0E2A\u0E4C"

\u0E1A\u0E17\u0E04\u0E27\u0E32\u0E21: "${articleTitle}"
\u0E40\u0E19\u0E37\u0E49\u0E2D\u0E2B\u0E32\u0E1A\u0E17\u0E04\u0E27\u0E32\u0E21 (\u0E22\u0E48\u0E2D): "${articleContent.substring(0, 600)}"
\u0E04\u0E27\u0E32\u0E21\u0E04\u0E34\u0E14\u0E40\u0E2B\u0E47\u0E19\u0E17\u0E35\u0E48\u0E16\u0E32\u0E21\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25: "${comment}"

\u0E15\u0E2D\u0E1A\u0E04\u0E33\u0E16\u0E32\u0E21\u0E42\u0E14\u0E22\u0E2D\u0E34\u0E07\u0E02\u0E49\u0E2D\u0E40\u0E17\u0E47\u0E08\u0E08\u0E23\u0E34\u0E07\u0E08\u0E32\u0E01\u0E1A\u0E17\u0E04\u0E27\u0E32\u0E21\u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19:
- \u0E16\u0E49\u0E32\u0E1A\u0E17\u0E04\u0E27\u0E32\u0E21\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E17\u0E35\u0E48\u0E15\u0E2D\u0E1A\u0E44\u0E14\u0E49 \u2192 \u0E15\u0E2D\u0E1A\u0E2A\u0E31\u0E49\u0E19\u0E46 1-2 \u0E1B\u0E23\u0E30\u0E42\u0E22\u0E04 \u0E20\u0E32\u0E29\u0E32\u0E44\u0E17\u0E22 \u0E2A\u0E38\u0E20\u0E32\u0E1E
- \u0E16\u0E49\u0E32\u0E1A\u0E17\u0E04\u0E27\u0E32\u0E21\u0E44\u0E21\u0E48\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E40\u0E1E\u0E35\u0E22\u0E07\u0E1E\u0E2D \u2192 \u0E15\u0E2D\u0E1A\u0E27\u0E48\u0E32 "SKIP" \u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19

\u0E2B\u0E49\u0E32\u0E21\u0E40\u0E14\u0E32\u0E2B\u0E23\u0E37\u0E2D\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E21\u0E35\u0E43\u0E19\u0E1A\u0E17\u0E04\u0E27\u0E32\u0E21`;
  const reply = await callGemini(prompt, 0.3, "SKIP");
  const trimmed = reply.trim();
  if (trimmed === "SKIP" || trimmed.toUpperCase().includes("SKIP")) return null;
  return trimmed;
}
var GEMINI_API_URL, QUOTA_COOLDOWN_KEY, QUOTA_WARNING_KEY, QUOTA_COOLDOWN_MINUTES;
var init_gemini = __esm({
  "server/gemini.ts"() {
    "use strict";
    GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent";
    QUOTA_COOLDOWN_KEY = "gemini_quota_exhausted";
    QUOTA_WARNING_KEY = "gemini_quota_warning_sent";
    QUOTA_COOLDOWN_MINUTES = 60;
  }
});

// server/facebook.ts
var facebook_exports = {};
__export(facebook_exports, {
  APPRECIATION_TRIGGERS: () => APPRECIATION_TRIGGERS,
  INFO_REQUEST_TRIGGERS: () => INFO_REQUEST_TRIGGERS,
  REPLY_TEMPLATES: () => REPLY_TEMPLATES,
  SENSITIVE_TRIGGERS: () => SENSITIVE_TRIGGERS,
  TOXIC_KEYWORDS: () => TOXIC_KEYWORDS,
  buildAdGovernanceReport: () => buildAdGovernanceReport,
  buildEthicalResponderReport: () => buildEthicalResponderReport,
  buildFactNotFoundReply: () => buildFactNotFoundReply,
  buildFactReply: () => buildFactReply,
  buildModerationReport: () => buildModerationReport,
  buildSensitiveFlagAlert: () => buildSensitiveFlagAlert,
  buildViralAlert: () => buildViralAlert,
  classifyComment: () => classifyComment,
  extractFactFromArticle: () => extractFactFromArticle,
  fetchAdReport: () => fetchAdReport,
  fetchPostComments: () => fetchPostComments,
  fetchPostInsights: () => fetchPostInsights,
  fetchRecentPosts: () => fetchRecentPosts,
  fetchWPPostByUrl: () => fetchWPPostByUrl,
  getRecentPageComments: () => getRecentPageComments,
  hideComment: () => hideComment,
  isRiskyComment: () => isRiskyComment,
  isToxicComment: () => isToxicComment,
  likeComment: () => likeComment,
  pickReplyTemplate: () => pickReplyTemplate,
  replyToComment: () => replyToComment,
  runCommentModeration: () => runCommentModeration,
  runEthicalResponder: () => runEthicalResponder,
  runViralScout: () => runViralScout,
  stripHtml: () => stripHtml
});
function isToxicComment(message) {
  const lower = message.toLowerCase();
  return TOXIC_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}
function isRiskyComment(message) {
  const riskyTerms = [
    "\u0E25\u0E49\u0E21\u0E40\u0E08\u0E49\u0E32",
    "\u0E1B\u0E0F\u0E34\u0E27\u0E31\u0E15\u0E34",
    "\u0E23\u0E31\u0E10\u0E1B\u0E23\u0E30\u0E2B\u0E32\u0E23",
    "\u0E21.112",
    "overthrow",
    "coup",
    "sedition"
  ];
  const lower = message.toLowerCase();
  return riskyTerms.some((t2) => lower.includes(t2.toLowerCase()));
}
async function fetchPostComments(postId, limit = 50) {
  const url = `${FB_API_BASE}/${postId}/comments?fields=id,message,from,created_time&limit=${limit}&access_token=${PAGE_TOKEN}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) throw new Error(`FB comments error: ${data.error.message}`);
  return data.data ?? [];
}
async function hideComment(commentId) {
  const url = `${FB_API_BASE}/${commentId}?access_token=${PAGE_TOKEN}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_hidden: true })
  });
  const data = await res.json();
  if (data.error) {
    console.error(`[FB] Failed to hide comment ${commentId}:`, data.error.message);
    return false;
  }
  return data.success === true;
}
async function fetchRecentPosts(limit = 10) {
  const url = `${FB_API_BASE}/${PAGE_ID}/posts?fields=id,message,created_time,permalink_url&limit=${limit}&access_token=${PAGE_TOKEN}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) throw new Error(`FB posts error: ${data.error.message}`);
  return data.data ?? [];
}
async function runCommentModeration(postsToCheck = 5) {
  const result = { checked: 0, hidden: 0, hiddenIds: [], risky: 0, riskyIds: [] };
  const posts = await fetchRecentPosts(postsToCheck);
  for (const post of posts) {
    const comments = await fetchPostComments(post.id, 50);
    for (const comment of comments) {
      result.checked++;
      if (isToxicComment(comment.message)) {
        const ok = await hideComment(comment.id);
        if (ok) {
          result.hidden++;
          result.hiddenIds.push(comment.id);
        }
      } else if (isRiskyComment(comment.message)) {
        result.risky++;
        result.riskyIds.push(comment.id);
      }
    }
  }
  return result;
}
async function fetchPostInsights(postId, permalink) {
  try {
    const insightsUrl = `${FB_API_BASE}/${postId}/insights?metric=post_impressions_unique,post_reactions_by_type_total&access_token=${PAGE_TOKEN}`;
    const engUrl = `${FB_API_BASE}/${postId}?fields=reactions.summary(true),comments.summary(true),shares&access_token=${PAGE_TOKEN}`;
    const [insightsRes, engRes] = await Promise.all([
      fetch(insightsUrl).then((r) => r.json()),
      fetch(engUrl).then((r) => r.json())
    ]);
    if (insightsRes.error || engRes.error) return null;
    const reachMetric = insightsRes.data?.find((m) => m.name === "post_impressions_unique");
    const reach = reachMetric?.values?.[0]?.value ?? 0;
    const reactions = engRes.reactions?.summary?.total_count ?? 0;
    const comments = engRes.comments?.summary?.total_count ?? 0;
    const shares = engRes.shares?.count ?? 0;
    const engagement = reactions + comments + shares;
    const engagementRate = reach > 0 ? engagement / reach * 100 : 0;
    return { postId, permalink, reach, reactions, comments, shares, engagement, engagementRate };
  } catch {
    return null;
  }
}
async function runViralScout(threshold = 5, postsToCheck = 10) {
  const posts = await fetchRecentPosts(postsToCheck);
  const viral = [];
  for (const post of posts) {
    const insights = await fetchPostInsights(post.id, post.permalink_url);
    if (insights && insights.engagementRate >= threshold) {
      viral.push({
        postId: post.id,
        message: post.message?.substring(0, 100),
        permalink: post.permalink_url,
        engagementRate: Math.round(insights.engagementRate * 10) / 10,
        reach: insights.reach,
        engagement: insights.engagement
      });
    }
  }
  return viral;
}
async function fetchAdReport(cpcThreshold = 5) {
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const url = `${FB_API_BASE}/act_${AD_ACCOUNT_ID}/campaigns?fields=id,name,insights{spend,impressions,clicks,cpc,cpm,ctr}&time_range={"since":"${today}","until":"${today}"}&access_token=${PAGE_TOKEN}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) throw new Error(`FB Ads error: ${data.error.message}`);
  const campaigns = [];
  for (const campaign of data.data ?? []) {
    const ins = campaign.insights?.data?.[0];
    if (!ins) continue;
    campaigns.push({
      campaignId: campaign.id,
      campaignName: campaign.name,
      spend: parseFloat(ins.spend ?? "0"),
      impressions: parseInt(ins.impressions ?? "0"),
      clicks: parseInt(ins.clicks ?? "0"),
      cpc: parseFloat(ins.cpc ?? "0"),
      cpm: parseFloat(ins.cpm ?? "0"),
      ctr: parseFloat(ins.ctr ?? "0")
    });
  }
  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  const totalImpressions = campaigns.reduce((s, c) => s + c.impressions, 0);
  const totalClicks = campaigns.reduce((s, c) => s + c.clicks, 0);
  const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
  const highCpcCampaigns = campaigns.filter((c) => c.cpc > cpcThreshold);
  return { date: today, totalSpend, totalImpressions, totalClicks, avgCpc, campaigns, highCpcCampaigns };
}
function buildModerationReport(result) {
  let msg = `\u{1F6E1}\uFE0F <b>[NCR] Ethics Moderation Report</b>
`;
  msg += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
`;
  msg += `\u{1F4CB} Comments checked: <b>${result.checked}</b>
`;
  msg += `\u{1F6AB} Auto-hidden (toxic/spam): <b>${result.hidden}</b>
`;
  msg += `\u26A0\uFE0F Flagged for review (risky): <b>${result.risky}</b>
`;
  if (result.risky > 0) {
    msg += `
\u{1F50D} <b>Risky comments need human review!</b>
`;
    msg += `Please review in Facebook Page Manager.
`;
  }
  msg += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
`;
  msg += `\u{1F916} Safety Lock: AI will NOT comment on sensitive topics.`;
  return msg;
}
function buildViralAlert(posts) {
  let msg = `\u{1F525} <b>[NCR] Viral Scout Alert!</b>
`;
  msg += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
`;
  msg += `\u{1F4C8} ${posts.length} viral post(s) detected (Engagement > 5% of Reach)

`;
  for (const post of posts) {
    msg += `\u{1F680} <b>${post.engagementRate}% engagement rate</b>
`;
    if (post.message) msg += `\u{1F4DD} "${post.message}..."
`;
    msg += `\u{1F441}\uFE0F Reach: <b>${post.reach.toLocaleString()}</b> | Engagement: <b>${post.engagement.toLocaleString()}</b>
`;
    if (post.permalink) msg += `\u{1F517} <a href="${post.permalink}">\u0E14\u0E39\u0E42\u0E1E\u0E2A\u0E15\u0E4C</a>
`;
    msg += `
`;
  }
  msg += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
`;
  msg += `\u26A1 Boost this post now to maximize reach!`;
  return msg;
}
function buildAdGovernanceReport(report) {
  let msg = `\u{1F4B0} <b>[NCR] Ad Governance Report</b>
`;
  msg += `\u{1F4C5} ${report.date}
`;
  msg += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
`;
  msg += `\u{1F4B5} Total Spend: <b>\u0E3F${report.totalSpend.toFixed(2)}</b>
`;
  msg += `\u{1F441}\uFE0F Impressions: <b>${report.totalImpressions.toLocaleString()}</b>
`;
  msg += `\u{1F5B1}\uFE0F Clicks: <b>${report.totalClicks.toLocaleString()}</b>
`;
  msg += `\u{1F4CA} Avg CPC: <b>\u0E3F${report.avgCpc.toFixed(2)}</b>
`;
  if (report.campaigns.length > 0) {
    msg += `
\u{1F4CB} <b>Campaigns (${report.campaigns.length}):</b>
`;
    for (const c of report.campaigns.slice(0, 5)) {
      msg += `\u2022 ${c.campaignName}: \u0E3F${c.spend.toFixed(2)} | CPC \u0E3F${c.cpc.toFixed(2)} | CTR ${c.ctr.toFixed(2)}%
`;
    }
  }
  if (report.highCpcCampaigns.length > 0) {
    msg += `
\u{1F6A8} <b>High CPC Alert!</b> ${report.highCpcCampaigns.length} campaign(s) above threshold:
`;
    for (const c of report.highCpcCampaigns) {
      msg += `\u26A0\uFE0F ${c.campaignName}: CPC <b>\u0E3F${c.cpc.toFixed(2)}</b>
`;
    }
  }
  msg += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
`;
  msg += `\u{1F6E1}\uFE0F NCR Ad Governance Active`;
  return msg;
}
function classifyComment(message) {
  if (isToxicComment(message)) return "spam";
  if (SENSITIVE_TRIGGERS.some((t2) => message.toLowerCase().includes(t2.toLowerCase()))) {
    return "sensitive";
  }
  const hasAppreciation = APPRECIATION_TRIGGERS.some(
    (t2) => message.toLowerCase().includes(t2.toLowerCase())
  );
  if (hasAppreciation) return "appreciation";
  const hasInfoRequest = INFO_REQUEST_TRIGGERS.some(
    (t2) => message.toLowerCase().includes(t2.toLowerCase())
  );
  if (hasInfoRequest) return "info_request";
  return "ambiguous";
}
function pickReplyTemplate() {
  return REPLY_TEMPLATES[Math.floor(Math.random() * REPLY_TEMPLATES.length)];
}
async function likeComment(commentId) {
  const url = `${FB_API_BASE}/${commentId}/likes?access_token=${PAGE_TOKEN}`;
  const res = await fetch(url, { method: "POST" });
  const data = await res.json();
  if (data.error) {
    console.error(`[FB] Failed to like comment ${commentId}:`, data.error.message);
    return false;
  }
  return data.success === true;
}
async function replyToComment(commentId, message) {
  const url = `${FB_API_BASE}/${commentId}/comments?access_token=${PAGE_TOKEN}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message })
  });
  const data = await res.json();
  if (data.error) {
    console.error(`[FB] Failed to reply to comment ${commentId}:`, data.error.message);
    return false;
  }
  return !!data.id;
}
async function runEthicalResponder(postsToCheck = 5, onSensitiveFlag) {
  const result = {
    checked: 0,
    liked: 0,
    replied: 0,
    flagged: 0,
    hidden: 0,
    skipped: 0
  };
  const posts = await fetchRecentPosts(postsToCheck);
  for (const post of posts) {
    const comments = await fetchPostComments(post.id, 50);
    for (const comment of comments) {
      result.checked++;
      const scenario = classifyComment(comment.message);
      switch (scenario) {
        case "appreciation":
          await likeComment(comment.id);
          result.liked++;
          const template = pickReplyTemplate();
          const replied = await replyToComment(comment.id, template);
          if (replied) result.replied++;
          break;
        case "info_request": {
          const postUrl = post.permalink_url ?? "";
          if (postUrl) {
            try {
              const wpPost = await fetchWPPostByUrl(postUrl);
              if (wpPost) {
                const articleText = stripHtml(wpPost.content.rendered);
                const geminiReply = await generateFactBasedReply(
                  comment.message,
                  wpPost.title.rendered,
                  articleText
                );
                if (geminiReply) {
                  const factReplied = await replyToComment(comment.id, geminiReply);
                  if (factReplied) {
                    result.replied++;
                    break;
                  }
                }
              }
            } catch (err) {
              console.error("[V4.0] Gemini fact reply error:", err);
            }
          }
          result.skipped++;
          break;
        }
        case "sensitive": {
          result.flagged++;
          const postTitle = post.message?.substring(0, 80) ?? "(\u0E44\u0E21\u0E48\u0E23\u0E30\u0E1A\u0E38\u0E2B\u0E31\u0E27\u0E02\u0E49\u0E2D)";
          try {
            const draft = await draftCrisisResponse(comment.message, postTitle);
            const crisisAlert = buildCrisisDraftAlert(comment.message, postTitle, draft);
            await sendTelegramMessage(crisisAlert);
          } catch (err) {
            console.error("[V4.0] Crisis draft error:", err);
            if (onSensitiveFlag) {
              await onSensitiveFlag(comment.id, comment.message);
            }
          }
          break;
        }
        case "spam":
          await hideComment(comment.id);
          result.hidden++;
          break;
        case "ambiguous":
        default:
          result.skipped++;
          break;
      }
    }
  }
  return result;
}
function buildEthicalResponderReport(result) {
  let msg = `\u{1F916} <b>[NCR] Ethical Responder V3.3</b>
`;
  msg += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
`;
  msg += `\u{1F4CB} Comments checked: <b>${result.checked}</b>
`;
  msg += `\u{1F44D} Auto-liked: <b>${result.liked}</b>
`;
  msg += `\u{1F4AC} Auto-replied: <b>${result.replied}</b>
`;
  msg += `\u{1F6AB} Spam hidden: <b>${result.hidden}</b>
`;
  msg += `\u26A0\uFE0F Flagged for review: <b>${result.flagged}</b>
`;
  msg += `\u23ED\uFE0F Skipped (ambiguous): <b>${result.skipped}</b>
`;
  msg += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
`;
  msg += `\u{1F512} Safety Lock: AI \u0E44\u0E21\u0E48\u0E15\u0E2D\u0E1A\u0E1B\u0E23\u0E30\u0E40\u0E14\u0E47\u0E19\u0E40\u0E1B\u0E23\u0E32\u0E30\u0E1A\u0E32\u0E07`;
  return msg;
}
function buildSensitiveFlagAlert(commentId, message) {
  const preview = message.length > 100 ? message.substring(0, 100) + "..." : message;
  return `\u26A0\uFE0F <b>[NCR] Sensitive Comment \u2014 Human Review Required</b>
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u{1F50D} Comment ID: <code>${commentId}</code>
\u{1F4AC} Content: "${preview}"
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u{1F6E1}\uFE0F AI has NOT responded. \u0E1A\u0E01. \u0E01\u0E23\u0E38\u0E13\u0E32\u0E15\u0E31\u0E14\u0E2A\u0E34\u0E19\u0E43\u0E08\u0E04\u0E23\u0E31\u0E1A`;
}
async function fetchWPPostByUrl(postUrl) {
  try {
    const urlObj = new URL(postUrl);
    const slug = urlObj.pathname.replace(/^\/|\/$/g, "").split("/").pop() ?? "";
    if (!slug) return null;
    const res = await fetch(
      `${WP_API_BASE2}/posts?slug=${encodeURIComponent(slug)}&_fields=id,title,content,link,date`,
      { signal: AbortSignal.timeout(8e3) }
    );
    if (!res.ok) return null;
    const posts = await res.json();
    return posts.length > 0 ? posts[0] : null;
  } catch {
    return null;
  }
}
function stripHtml(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
}
async function extractFactFromArticle(articleTitle, articleContent, question) {
  try {
    const { invokeLLM: invokeLLM2 } = await Promise.resolve().then(() => (init_llm(), llm_exports));
    const contentPreview = articleContent.substring(0, 2e3);
    const response = await invokeLLM2({
      messages: [
        {
          role: "system",
          content: `\u0E04\u0E38\u0E13\u0E40\u0E1B\u0E47\u0E19\u0E1C\u0E39\u0E49\u0E0A\u0E48\u0E27\u0E22\u0E15\u0E2D\u0E1A\u0E04\u0E33\u0E16\u0E32\u0E21\u0E08\u0E32\u0E01\u0E1A\u0E17\u0E04\u0E27\u0E32\u0E21\u0E02\u0E48\u0E32\u0E27 \u0E19\u0E04\u0E23\u0E40\u0E0A\u0E35\u0E22\u0E07\u0E23\u0E32\u0E22\u0E19\u0E34\u0E27\u0E2A\u0E4C
\u0E01\u0E0E\u0E40\u0E2B\u0E25\u0E47\u0E01: \u0E15\u0E2D\u0E1A\u0E44\u0E14\u0E49\u0E40\u0E09\u0E1E\u0E32\u0E30\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E17\u0E35\u0E48\u0E21\u0E35\u0E2D\u0E22\u0E39\u0E48\u0E43\u0E19\u0E1A\u0E17\u0E04\u0E27\u0E32\u0E21\u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19 \u0E2B\u0E49\u0E32\u0E21\u0E04\u0E32\u0E14\u0E40\u0E14\u0E32\u0E2B\u0E23\u0E37\u0E2D\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E40\u0E15\u0E34\u0E21\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E21\u0E35\u0E43\u0E19\u0E1A\u0E17\u0E04\u0E27\u0E32\u0E21
\u0E16\u0E49\u0E32\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E04\u0E33\u0E15\u0E2D\u0E1A\u0E43\u0E19\u0E1A\u0E17\u0E04\u0E27\u0E32\u0E21 \u0E43\u0E2B\u0E49\u0E15\u0E2D\u0E1A\u0E27\u0E48\u0E32 "NOT_FOUND" \u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19
\u0E15\u0E2D\u0E1A\u0E2A\u0E31\u0E49\u0E19\u0E46 \u0E44\u0E21\u0E48\u0E40\u0E01\u0E34\u0E19 2 \u0E1B\u0E23\u0E30\u0E42\u0E22\u0E04 \u0E43\u0E0A\u0E49\u0E20\u0E32\u0E29\u0E32\u0E44\u0E17\u0E22\u0E17\u0E35\u0E48\u0E2A\u0E38\u0E20\u0E32\u0E1E\u0E41\u0E25\u0E30\u0E40\u0E1B\u0E47\u0E19\u0E01\u0E31\u0E19\u0E40\u0E2D\u0E07`
        },
        {
          role: "user",
          content: `\u0E1A\u0E17\u0E04\u0E27\u0E32\u0E21: "${articleTitle}"

\u0E40\u0E19\u0E37\u0E49\u0E2D\u0E2B\u0E32: ${contentPreview}

\u0E04\u0E33\u0E16\u0E32\u0E21: ${question}`
        }
      ]
    });
    const answer = (response.choices?.[0]?.message?.content ?? "").trim();
    if (!answer || answer === "NOT_FOUND" || answer.includes("NOT_FOUND")) {
      return null;
    }
    return answer;
  } catch (err) {
    console.error("[V3.4] extractFactFromArticle error:", err);
    return null;
  }
}
function buildFactReply(answer) {
  return `${answer}

(\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E08\u0E32\u0E01\u0E1A\u0E17\u0E04\u0E27\u0E32\u0E21\u0E19\u0E04\u0E23\u0E40\u0E0A\u0E35\u0E22\u0E07\u0E23\u0E32\u0E22\u0E19\u0E34\u0E27\u0E2A\u0E4C \u{1F4F0})`;
}
function buildFactNotFoundReply() {
  return "\u0E02\u0E2D\u0E2D\u0E20\u0E31\u0E22\u0E04\u0E23\u0E31\u0E1A \u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E17\u0E35\u0E48\u0E15\u0E23\u0E07\u0E01\u0E31\u0E1A\u0E04\u0E33\u0E16\u0E32\u0E21\u0E43\u0E19\u0E1A\u0E17\u0E04\u0E27\u0E32\u0E21\u0E19\u0E35\u0E49 \u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E2D\u0E48\u0E32\u0E19\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E40\u0E15\u0E34\u0E21\u0E44\u0E14\u0E49\u0E17\u0E35\u0E48\u0E25\u0E34\u0E07\u0E01\u0E4C\u0E1A\u0E17\u0E04\u0E27\u0E32\u0E21\u0E04\u0E23\u0E31\u0E1A \u{1F64F}";
}
async function getRecentPageComments(limit = 100) {
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  const pageId = process.env.FB_PAGE_ID;
  if (!token || !pageId) return [];
  try {
    const postsUrl = `https://graph.facebook.com/v19.0/${pageId}/posts?fields=id&limit=20&access_token=${token}`;
    const postsRes = await fetch(postsUrl, { signal: AbortSignal.timeout(8e3) });
    if (!postsRes.ok) return [];
    const postsData = await postsRes.json();
    const posts = postsData?.data ?? [];
    const allComments = [];
    for (const post of posts.slice(0, 10)) {
      if (allComments.length >= limit) break;
      const commentsUrl = `https://graph.facebook.com/v19.0/${post.id}/comments?fields=message,like_count&limit=20&access_token=${token}`;
      const commentsRes = await fetch(commentsUrl, { signal: AbortSignal.timeout(6e3) });
      if (!commentsRes.ok) continue;
      const commentsData = await commentsRes.json();
      const comments = commentsData?.data ?? [];
      for (const c of comments) {
        if (c.message) {
          allComments.push({ message: c.message, likeCount: c.like_count ?? 0 });
        }
      }
    }
    return allComments.slice(0, limit);
  } catch (err) {
    console.error("[FB] getRecentPageComments error:", err);
    return [];
  }
}
var FB_API_BASE, PAGE_ID, PAGE_TOKEN, AD_ACCOUNT_ID, TOXIC_KEYWORDS, APPRECIATION_TRIGGERS, INFO_REQUEST_TRIGGERS, SENSITIVE_TRIGGERS, REPLY_TEMPLATES, WP_API_BASE2;
var init_facebook = __esm({
  "server/facebook.ts"() {
    "use strict";
    init_gemini();
    init_telegram();
    FB_API_BASE = "https://graph.facebook.com/v19.0";
    PAGE_ID = process.env.FB_PAGE_ID ?? "";
    PAGE_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN ?? "";
    AD_ACCOUNT_ID = process.env.FB_AD_ACCOUNT_ID ?? "";
    TOXIC_KEYWORDS = [
      // Thai profanity / spam / gambling
      "\u0E2B\u0E22\u0E32\u0E1A\u0E04\u0E32\u0E22",
      "\u0E2A\u0E41\u0E1B\u0E21\u0E1E\u0E19\u0E31\u0E19",
      "\u0E14\u0E23\u0E32\u0E21\u0E48\u0E32\u0E1C\u0E34\u0E14\u0E01\u0E0E\u0E2B\u0E21\u0E32\u0E22",
      "\u0E44\u0E2D\u0E49\u0E2A\u0E31\u0E15\u0E27\u0E4C",
      "\u0E21\u0E36\u0E07",
      "\u0E2D\u0E35\u0E2A\u0E31\u0E15\u0E27\u0E4C",
      "\u0E44\u0E2D\u0E49\u0E1A\u0E49\u0E32",
      "\u0E2D\u0E35\u0E1A\u0E49\u0E32",
      "\u0E1E\u0E19\u0E31\u0E19",
      "\u0E1A\u0E32\u0E04\u0E32\u0E23\u0E48\u0E32",
      "\u0E2A\u0E25\u0E47\u0E2D\u0E15",
      "\u0E22\u0E32\u0E40\u0E2A\u0E1E\u0E15\u0E34\u0E14",
      "\u0E04\u0E25\u0E34\u0E01\u0E25\u0E34\u0E07\u0E01\u0E4C",
      "\u0E01\u0E14\u0E25\u0E34\u0E07\u0E01\u0E4C",
      "\u0E23\u0E31\u0E1A\u0E40\u0E07\u0E34\u0E19",
      "\u0E17\u0E33\u0E40\u0E07\u0E34\u0E19",
      // English spam
      "click here",
      "free money",
      "earn fast",
      "casino"
    ];
    APPRECIATION_TRIGGERS = [
      "\u0E02\u0E2D\u0E1A\u0E04\u0E38\u0E13",
      "\u0E15\u0E34\u0E14\u0E15\u0E32\u0E21",
      "\u0E02\u0E48\u0E32\u0E27\u0E14\u0E35",
      "\u0E40\u0E22\u0E35\u0E48\u0E22\u0E21",
      "\u0E2A\u0E38\u0E14\u0E22\u0E2D\u0E14",
      "\u0E14\u0E35\u0E21\u0E32\u0E01",
      "\u0E40\u0E01\u0E48\u0E07\u0E21\u0E32\u0E01",
      "\u{1F44D}",
      "\u2764\uFE0F",
      "\u{1F64F}",
      "\u{1F60A}",
      "\u{1F525}",
      "\u{1F44F}",
      "\u0E0A\u0E2D\u0E1A",
      "\u0E41\u0E0A\u0E23\u0E4C",
      "\u0E40\u0E14\u0E47\u0E14"
    ];
    INFO_REQUEST_TRIGGERS = [
      "\u0E17\u0E35\u0E48\u0E44\u0E2B\u0E19",
      "\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E44\u0E2B\u0E23\u0E48",
      "\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E44\u0E23",
      "\u0E02\u0E2D\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14",
      "\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E40\u0E15\u0E34\u0E21",
      "\u0E15\u0E34\u0E14\u0E15\u0E48\u0E2D",
      "\u0E2A\u0E2D\u0E1A\u0E16\u0E32\u0E21",
      "\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14",
      "\u0E40\u0E27\u0E25\u0E32",
      "\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48",
      "\u0E23\u0E32\u0E04\u0E32",
      "how",
      "where",
      "when"
    ];
    SENSITIVE_TRIGGERS = [
      "\u0E01\u0E32\u0E23\u0E40\u0E21\u0E37\u0E2D\u0E07\u0E23\u0E38\u0E19\u0E41\u0E23\u0E07",
      "\u0E25\u0E49\u0E21\u0E40\u0E08\u0E49\u0E32",
      "\u0E1B\u0E0F\u0E34\u0E27\u0E31\u0E15\u0E34",
      "\u0E23\u0E31\u0E10\u0E1B\u0E23\u0E30\u0E2B\u0E32\u0E23",
      "\u0E21.112",
      "\u0E14\u0E48\u0E32",
      "\uC695",
      "\u0E1B\u0E23\u0E30\u0E40\u0E14\u0E47\u0E19\u0E40\u0E1B\u0E23\u0E32\u0E30\u0E1A\u0E32\u0E07",
      "fake news",
      "\u0E02\u0E48\u0E32\u0E27\u0E1B\u0E25\u0E2D\u0E21",
      "\u0E14\u0E23\u0E32\u0E21\u0E48\u0E32",
      "\u0E42\u0E08\u0E21\u0E15\u0E35",
      "\u0E43\u0E2A\u0E48\u0E23\u0E49\u0E32\u0E22",
      "overthrow",
      "coup",
      "sedition"
    ];
    REPLY_TEMPLATES = [
      "\u0E02\u0E2D\u0E1A\u0E04\u0E38\u0E13\u0E17\u0E35\u0E48\u0E15\u0E34\u0E14\u0E15\u0E32\u0E21\u0E19\u0E04\u0E23\u0E40\u0E0A\u0E35\u0E22\u0E07\u0E23\u0E32\u0E22\u0E19\u0E34\u0E27\u0E2A\u0E4C\u0E04\u0E23\u0E31\u0E1A/\u0E04\u0E48\u0E30 \u{1F64F}",
      "\u0E02\u0E2D\u0E1A\u0E04\u0E38\u0E13\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E01\u0E33\u0E25\u0E31\u0E07\u0E43\u0E08\u0E41\u0E25\u0E30\u0E04\u0E33\u0E41\u0E19\u0E30\u0E19\u0E33\u0E04\u0E23\u0E31\u0E1A \u{1F60A}",
      "\u0E02\u0E2D\u0E1A\u0E04\u0E38\u0E13\u0E17\u0E35\u0E48\u0E23\u0E48\u0E27\u0E21\u0E15\u0E34\u0E14\u0E15\u0E32\u0E21\u0E02\u0E48\u0E32\u0E27\u0E2A\u0E32\u0E23\u0E01\u0E31\u0E1A\u0E40\u0E23\u0E32\u0E04\u0E23\u0E31\u0E1A \u2764\uFE0F",
      "\u0E22\u0E34\u0E19\u0E14\u0E35\u0E17\u0E35\u0E48\u0E44\u0E14\u0E49\u0E23\u0E31\u0E1A\u0E43\u0E0A\u0E49\u0E1C\u0E39\u0E49\u0E2D\u0E48\u0E32\u0E19\u0E17\u0E38\u0E01\u0E17\u0E48\u0E32\u0E19\u0E04\u0E23\u0E31\u0E1A \u{1F64F}",
      "\u0E02\u0E2D\u0E1A\u0E04\u0E38\u0E13\u0E21\u0E32\u0E01\u0E04\u0E23\u0E31\u0E1A \u0E15\u0E34\u0E14\u0E15\u0E32\u0E21\u0E02\u0E48\u0E32\u0E27\u0E2A\u0E32\u0E23\u0E14\u0E35\u0E46 \u0E08\u0E32\u0E01\u0E40\u0E23\u0E32\u0E44\u0E14\u0E49\u0E15\u0E25\u0E2D\u0E14\u0E19\u0E30\u0E04\u0E23\u0E31\u0E1A \u{1F4F0}"
    ];
    WP_API_BASE2 = "https://nakornchiangrainews.com/wp-json/wp/v2";
  }
});

// server/_core/index.ts
import "dotenv/config";
import express2 from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var FACEBOOK_PAUSED = true;
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/_core/oauth.ts
init_db();

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
init_db();
init_env();
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    const redirectUri = atob(state);
    return redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
      const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
      const taskUid = userInfo.taskUid ?? null;
      if (!taskUid) {
        throw ForbiddenError("Cron session missing task_uid");
      }
      return buildCronUser(userInfo);
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var CRON_OPEN_ID_PREFIX = "cron_";
function buildCronUser(userInfo) {
  const now = /* @__PURE__ */ new Date();
  return {
    id: -1,
    openId: userInfo.openId,
    name: userInfo.name || "Manus Scheduled Task",
    email: null,
    loginMethod: null,
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: userInfo.taskUid ?? void 0,
    isCron: true
  };
}
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/storageProxy.ts
init_env();
function registerStorageProxy(app) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = req.params[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }
    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/"
      );
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` }
      });
      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = await forgeResp.json();
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}

// server/routers.ts
import { z as z2 } from "zod";

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
init_env();
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/monitoring.ts
init_env();
import https from "node:https";
async function checkSite() {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const sentinelUrl = new URL(ENV.wpSentinelUrl || `${ENV.wpSiteUrl.replace(/\/$/, "")}/wp-json/ncr/v3/monitor`);
    sentinelUrl.searchParams.set("secret", ENV.ncrApiSecret);
    const options = {
      hostname: sentinelUrl.hostname,
      port: 443,
      path: `${sentinelUrl.pathname}${sentinelUrl.search}`,
      method: "HEAD",
      timeout: 1e4,
      headers: {
        "User-Agent": "NCR-Watchdog-Sentinel-V31",
        "NCR-Secret": ENV.ncrApiSecret
      }
    };
    const req = https.request(options, (res) => {
      res.resume();
      res.on("end", () => {
        const ttfbMs = Date.now() - startTime;
        const httpCode = res.statusCode ?? 0;
        const cacheStatus = res.headers["cf-cache-status"] || "UNKNOWN";
        const cfRay = res.headers["cf-ray"] || "";
        resolve({
          httpCode,
          ttfbMs,
          cacheStatus: cacheStatus.toUpperCase(),
          cfRay,
          cacheControl: res.headers["cache-control"] || "",
          vary: res.headers["vary"] || "",
          setCookieHeader: Array.isArray(res.headers["set-cookie"]) ? res.headers["set-cookie"].join("; ") : String(res.headers["set-cookie"] ?? ""),
          isUp: httpCode === 200,
          memory_usage: 0,
          disk_free: 0
        });
      });
    });
    req.on("error", (err) => {
      resolve({
        httpCode: 0,
        ttfbMs: Date.now() - startTime,
        cacheStatus: "ERROR",
        cfRay: "",
        isUp: false,
        error: err.message
      });
    });
    req.on("timeout", () => {
      req.destroy(new Error("Watchdog HEAD request timed out"));
    });
    req.end();
  });
}

// server/routers.ts
init_cloudflare();

// server/intelligence.ts
init_env();
function diagnoseError(check) {
  const { httpCode, ttfbMs, cacheStatus, error } = check;
  if (httpCode === 0 || cacheStatus === "TIMEOUT" || cacheStatus === "ERROR") {
    if (error?.toLowerCase().includes("timeout") || ttfbMs >= 14e3) {
      return {
        category: "timeout",
        label: "Connection Timeout",
        detail: "The server did not respond within 15s. Likely server overload or network issue."
      };
    }
    return {
      category: "server_overload",
      label: "Server Unreachable",
      detail: `Connection failed (${error ?? "unknown error"}). Check hosting/server status.`
    };
  }
  if ([520, 521, 522, 523, 524, 525, 526, 527, 530].includes(httpCode)) {
    return {
      category: "cf_edge_error",
      label: "Cloudflare Edge Error",
      detail: `HTTP ${httpCode} \u2014 CF cannot reach the origin server. Check if Apache/Nginx is running.`
    };
  }
  if ((httpCode === 500 || httpCode === 503) && ttfbMs < 800) {
    return {
      category: "database_failure",
      label: "Possible Database Failure",
      detail: `HTTP ${httpCode} with fast TTFB (${ttfbMs}ms) \u2014 WP may be returning a DB connection error page.`
    };
  }
  if (httpCode >= 500 && httpCode < 600) {
    return {
      category: "plugin_conflict",
      label: "PHP Fatal / Plugin Conflict",
      detail: `HTTP ${httpCode} with TTFB ${ttfbMs}ms \u2014 likely a PHP fatal error from a plugin or theme update.`
    };
  }
  if (httpCode === 404) {
    return {
      category: "plugin_conflict",
      label: "Homepage 404",
      detail: "Homepage returned 404 \u2014 WordPress rewrite rules may be broken. Try flushing permalinks."
    };
  }
  if (ttfbMs >= 4e3) {
    return {
      category: "server_overload",
      label: "Server Overload / Slow PHP",
      detail: `TTFB ${ttfbMs}ms \u2014 server is responding but very slowly. Possible traffic spike or heavy plugin.`
    };
  }
  return {
    category: "unknown",
    label: "Unknown Issue",
    detail: `HTTP ${httpCode}, TTFB ${ttfbMs}ms. Manual investigation required.`
  };
}
function detectTtfbTrend(recentChecks, window = 3) {
  const ordered = [...recentChecks].reverse();
  if (ordered.length < window) return false;
  const last = ordered.slice(-window);
  for (let i = 1; i < last.length; i++) {
    if (last[i].ttfbMs <= last[i - 1].ttfbMs) return false;
  }
  return true;
}
async function setCFSecurityLevel(level) {
  if (!ENV.cfApiToken || !ENV.cfZoneId) {
    return { success: false, message: "CF credentials not configured" };
  }
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${ENV.cfZoneId}/settings/security_level`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${ENV.cfApiToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ value: level })
      }
    );
    const data = await res.json();
    if (data.success) {
      return { success: true, message: `CF Security Level set to "${level}"` };
    }
    const errMsg = data.errors?.map((e) => e.message).join(", ") || "Unknown CF error";
    return { success: false, message: errMsg };
  } catch (err) {
    return { success: false, message: `CF API error: ${err.message}` };
  }
}
async function getCFSecurityLevel() {
  if (!ENV.cfApiToken || !ENV.cfZoneId) return null;
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${ENV.cfZoneId}/settings/security_level`,
      {
        headers: { Authorization: `Bearer ${ENV.cfApiToken}` }
      }
    );
    const data = await res.json();
    if (data.success && data.result) return data.result.value;
    return null;
  } catch {
    return null;
  }
}

// server/routers.ts
init_telegram();
init_db();

// server/cacheDiagnostic.ts
var WP_BYPASS_COOKIES = [
  "wordpress_logged_in",
  "wp-postpass",
  "comment_author",
  "woocommerce_cart_hash",
  "woocommerce_items_in_cart"
];
function analyzeCacheDiagnostic(cfCacheStatus, cacheControl, vary, setCookieHeader) {
  const status = (cfCacheStatus || "UNKNOWN").toUpperCase();
  const detectedCookies = WP_BYPASS_COOKIES.filter(
    (name) => setCookieHeader.toLowerCase().includes(name.toLowerCase())
  );
  const wpCookiesDetected = detectedCookies.join(", ");
  let potentialCause = "";
  if (["BYPASS", "MISS", "EXPIRED"].includes(status)) {
    if (detectedCookies.length > 0) {
      potentialCause = `WP cookie(s) detected (${wpCookiesDetected}) \u2014 Cloudflare bypasses cache for authenticated/cookie sessions`;
    } else if (cacheControl.includes("no-store") || cacheControl.includes("no-cache")) {
      potentialCause = `Cache-Control header set to "${cacheControl}" \u2014 origin is instructing CF not to cache this response`;
    } else if (vary.toLowerCase().includes("cookie")) {
      potentialCause = `Vary: Cookie header present \u2014 CF treats each cookie variation as a unique cache key, causing MISS/BYPASS`;
    } else if (status === "BYPASS") {
      potentialCause = "CF cache bypassed \u2014 possible Page Rule or Cache Rule set to Bypass, or origin sent a Set-Cookie header";
    } else if (status === "EXPIRED") {
      potentialCause = "Cached content expired \u2014 CF is re-fetching from origin; will be HIT on next request if cacheable";
    } else {
      potentialCause = "Cache MISS \u2014 content not yet cached; will be stored on next cacheable response from origin";
    }
  } else if (status === "HIT") {
    potentialCause = "Cache is healthy \u2014 response served from Cloudflare edge";
  } else if (status === "DYNAMIC") {
    potentialCause = "Response marked DYNAMIC by CF \u2014 not eligible for caching (e.g. API or personalised content)";
  } else if (status === "REVALIDATED") {
    potentialCause = "CF revalidated the cached asset with the origin \u2014 cache is fresh";
  } else if (["TIMEOUT", "ERROR", "UNKNOWN"].includes(status)) {
    potentialCause = "Unable to determine cache status \u2014 site may be unreachable";
  } else {
    potentialCause = `CF cache status: ${status}`;
  }
  return {
    cfCacheStatus: status,
    cacheControl: cacheControl || "(not set)",
    vary: vary || "(not set)",
    wpCookiesDetected,
    potentialCause
  };
}

// server/scheduler.ts
var BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1e3;
function toBangkokTime(date) {
  return date.toLocaleString("en-GB", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
}
function nextBangkokTime(hour, minute, dayOfWeek, dayOfMonth) {
  const now = /* @__PURE__ */ new Date();
  const bangkokNow = new Date(now.getTime() + BANGKOK_OFFSET_MS);
  let candidate = new Date(bangkokNow);
  candidate.setUTCHours(hour, minute, 0, 0);
  if (dayOfWeek !== void 0) {
    const currentDay = candidate.getUTCDay();
    let daysUntil = (dayOfWeek - currentDay + 7) % 7;
    if (daysUntil === 0 && bangkokNow.getTime() >= candidate.getTime()) {
      daysUntil = 7;
    }
    candidate.setUTCDate(candidate.getUTCDate() + daysUntil);
  } else if (dayOfMonth !== void 0) {
    candidate.setUTCDate(dayOfMonth);
    if (bangkokNow.getTime() >= candidate.getTime()) {
      candidate.setUTCMonth(candidate.getUTCMonth() + 1);
      candidate.setUTCDate(dayOfMonth);
    }
  } else {
    if (bangkokNow.getTime() >= candidate.getTime()) {
      candidate.setUTCDate(candidate.getUTCDate() + 1);
    }
  }
  return new Date(candidate.getTime() - BANGKOK_OFFSET_MS);
}
function getScheduleInfos() {
  return [
    {
      jobName: "daily-morning",
      label: "Daily Morning (09:00 BKK)",
      cronUtc: "0 0 2 * * *",
      // 09:00 BKK = 02:00 UTC
      nextRunUtc: nextBangkokTime(9, 0),
      nextRunBangkok: toBangkokTime(nextBangkokTime(9, 0))
    },
    {
      jobName: "daily-evening",
      label: "Daily Evening (18:00 BKK)",
      cronUtc: "0 0 11 * * *",
      // 18:00 BKK = 11:00 UTC
      nextRunUtc: nextBangkokTime(18, 0),
      nextRunBangkok: toBangkokTime(nextBangkokTime(18, 0))
    },
    {
      jobName: "weekly-sunday",
      label: "Weekly (Sunday 09:00 BKK)",
      cronUtc: "0 0 2 * * 0",
      // Sunday 09:00 BKK = Sunday 02:00 UTC
      nextRunUtc: nextBangkokTime(9, 0, 0),
      nextRunBangkok: toBangkokTime(nextBangkokTime(9, 0, 0))
    },
    {
      jobName: "monthly-first",
      label: "Monthly (1st 09:00 BKK)",
      cronUtc: "0 0 2 1 * *",
      // 1st of month 09:00 BKK = 02:00 UTC
      nextRunUtc: nextBangkokTime(9, 0, void 0, 1),
      nextRunBangkok: toBangkokTime(nextBangkokTime(9, 0, void 0, 1))
    }
  ];
}
function getCurrentBangkokTime() {
  return (/* @__PURE__ */ new Date()).toLocaleString("en-GB", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
}

// server/autofix.ts
init_telegram();
init_db();
init_env();
async function runMonitorCycle() {
  const check = await checkSite();
  await saveMonitorCheck({
    httpCode: check.httpCode,
    ttfbMs: check.ttfbMs,
    cacheStatus: check.cacheStatus,
    cfRay: check.cfRay,
    isUp: check.isUp
  });
  const alertsFired = [];
  if (!check.isUp) {
    const inCooldown = await isInCooldown("downtime");
    if (!inCooldown) {
      const diagnosis = diagnoseError(check);
      const msg = buildSmartDiagnosisAlert(check.httpCode, check.ttfbMs, diagnosis);
      await sendTelegramMessage(msg);
      await setCooldown("downtime", 30);
      await saveAlert({
        alertType: "downtime",
        message: `Site returned HTTP ${check.httpCode}. Diagnosis: ${diagnosis.label}. Awaiting manual cache purge approval.`,
        autoFixApplied: false,
        pendingPurge: true,
        httpCode: check.httpCode,
        ttfbMs: check.ttfbMs
      });
      alertsFired.push("downtime");
    }
  }
  if (check.isUp && check.ttfbMs >= ENV.ttfbThresholdMs) {
    const inCooldown = await isInCooldown("high_latency");
    if (!inCooldown) {
      const diagnosis = diagnoseError(check);
      const msg = buildSmartDiagnosisAlert(check.httpCode, check.ttfbMs, diagnosis);
      await sendTelegramMessage(msg);
      await setCooldown("high_latency", 30);
      await saveAlert({
        alertType: "high_latency",
        message: `TTFB ${check.ttfbMs}ms exceeded threshold ${ENV.ttfbThresholdMs}ms. Diagnosis: ${diagnosis.label}. Awaiting manual cache purge approval.`,
        autoFixApplied: false,
        pendingPurge: true,
        httpCode: check.httpCode,
        ttfbMs: check.ttfbMs
      });
      alertsFired.push("high_latency");
    }
  }
  if (check.isUp && check.ttfbMs < ENV.ttfbThresholdMs) {
    const recentChecks = await getRecentChecks(5);
    if (detectTtfbTrend(recentChecks, 3)) {
      const inCooldown = await isInCooldown("predictive_ttfb");
      if (!inCooldown) {
        const trendValues = [...recentChecks].reverse().slice(-3).map((c) => c.ttfbMs);
        const msg = buildPredictiveWarning(trendValues);
        await sendTelegramMessage(msg);
        await setCooldown("predictive_ttfb", 60);
        await saveAlert({
          alertType: "high_latency",
          message: `Predictive warning: TTFB trending upward (${trendValues.join("ms \u2192 ")}ms). Not yet at threshold.`,
          autoFixApplied: false,
          pendingPurge: false,
          httpCode: check.httpCode,
          ttfbMs: check.ttfbMs
        });
        alertsFired.push("predictive_ttfb");
      }
    }
  }
  const isAttack = !check.isUp && check.httpCode >= 500;
  const isSevereLatency = check.isUp && check.ttfbMs > 4e3;
  if (isAttack || isSevereLatency) {
    const inCooldown = await isInCooldown("adaptive_security");
    if (!inCooldown) {
      const level = isAttack ? "under_attack" : "high";
      const reason = isAttack ? `HTTP ${check.httpCode} \u2014 server returning 5xx errors` : `TTFB ${check.ttfbMs}ms \u2014 severe performance degradation`;
      const result = await setCFSecurityLevel(level);
      if (result.success) {
        const msg = buildAdaptiveSecurityAlert("elevated", level, reason);
        await sendTelegramMessage(msg);
        await setCooldown("adaptive_security", 30);
        await saveAlert({
          alertType: "security",
          message: `Adaptive Security: CF Security Level set to "${level}". Reason: ${reason}`,
          autoFixApplied: true,
          pendingPurge: false,
          httpCode: check.httpCode,
          ttfbMs: check.ttfbMs
        });
        alertsFired.push("adaptive_security_elevated");
      }
    }
  } else {
    await maybeRevertSecurityLevel(alertsFired);
  }
  try {
    const snapshot = await getLatestCFAnalyticsSnapshot(1);
    if (snapshot && snapshot.blockRate >= 20) {
      const inCooldown = await isInCooldown("block_rate_high");
      if (!inCooldown) {
        const msg = buildBlockRateAlert(snapshot.blockRate, snapshot.threats, snapshot.totalRequests);
        await sendTelegramMessage(msg);
        await setCooldown("block_rate_high", 120);
        await saveAlert({
          alertType: "security",
          message: `Block Rate ${snapshot.blockRate}% exceeds 20% threshold. Threats: ${snapshot.threats}/${snapshot.totalRequests} requests.`,
          autoFixApplied: false,
          pendingPurge: false,
          httpCode: check.httpCode,
          ttfbMs: check.ttfbMs
        });
        alertsFired.push("block_rate_high");
      }
    }
  } catch (e) {
    console.warn("[block-rate-check]", e);
  }
  const uptimePercent = await getUptimePercent();
  const avgTtfbMs = await getAvgTtfb();
  return { check, alertsFired, autoFixApplied: false, uptimePercent, avgTtfbMs };
}
async function maybeRevertSecurityLevel(alertsFired) {
  const stillElevated = await isInCooldown("adaptive_security");
  if (stillElevated) return;
  const currentLevel = await getCFSecurityLevel();
  if (!currentLevel || currentLevel === "medium" || currentLevel === "low" || currentLevel === "essentially_off") {
    return;
  }
  const result = await setCFSecurityLevel("medium");
  if (result.success) {
    const msg = buildAdaptiveSecurityAlert("reverted", "medium");
    await sendTelegramMessage(msg);
    await saveAlert({
      alertType: "security",
      message: `Adaptive Security: CF Security Level reverted to "medium" \u2014 site stable for 30 minutes.`,
      autoFixApplied: true,
      pendingPurge: false,
      httpCode: 200,
      ttfbMs: 0
    });
    alertsFired.push("adaptive_security_reverted");
  }
}

// server/routers.ts
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    })
  }),
  monitor: router({
    runCheck: publicProcedure.mutation(async () => {
      const result = await runMonitorCycle();
      try {
        const diag = analyzeCacheDiagnostic(
          result.check.cacheStatus,
          result.check.cacheControl ?? "",
          result.check.vary ?? "",
          result.check.setCookieHeader ?? ""
        );
        await saveCacheDiagnostic(diag);
      } catch (e) {
        console.warn("[cache-diag] failed to save:", e);
      }
      try {
        const cfData = await getCFAnalytics();
        if (cfData.top404Urls.length > 0) {
          await upsertBrokenLinks(cfData.top404Urls);
          const criticalHits = cfData.top404Urls.filter(
            (entry) => CRITICAL_URLS.some((p) => entry.url === p || entry.url.startsWith(p + "?"))
          );
          if (criticalHits.length > 0 && !await isInCooldown("critical_404")) {
            const { buildCritical404Alert: buildCritical404Alert2 } = await Promise.resolve().then(() => (init_telegram(), telegram_exports));
            await sendTelegramMessage(buildCritical404Alert2(criticalHits.map((e) => e.url)));
            await setCooldown("critical_404", 60);
          }
        }
      } catch (e) {
        console.error("[runCheck] broken links upsert failed:", e);
      }
      return {
        httpCode: result.check.httpCode,
        ttfbMs: result.check.ttfbMs,
        cacheStatus: result.check.cacheStatus,
        cfRay: result.check.cfRay,
        isUp: result.check.isUp,
        alertsFired: result.alertsFired,
        autoFixApplied: result.autoFixApplied,
        uptimePercent: result.uptimePercent,
        avgTtfbMs: result.avgTtfbMs,
        error: result.check.error
      };
    }),
    quickStatus: publicProcedure.query(async () => {
      const check = await checkSite();
      const uptimePercent = await getUptimePercent();
      const avgTtfbMs = await getAvgTtfb();
      return { ...check, uptimePercent, avgTtfbMs };
    }),
    history: publicProcedure.query(async () => {
      const checks = await getRecentChecks(100);
      return checks.map((c) => ({
        id: c.id,
        httpCode: c.httpCode,
        ttfbMs: c.ttfbMs,
        cacheStatus: c.cacheStatus ?? "UNKNOWN",
        cfRay: c.cfRay ?? "",
        isUp: c.isUp,
        createdAt: c.createdAt
      }));
    }),
    purgeCache: publicProcedure.mutation(async () => {
      return purgeCFCache();
    }),
    cfAnalytics: publicProcedure.query(async () => {
      const [cf, stats404] = await Promise.all([getCFAnalytics(), get404Stats()]);
      return { ...cf, top404Urls: cf.top404Urls };
    }),
    sendTestReport: publicProcedure.mutation(async () => {
      const checks = await getRecentChecks(1);
      const latestCheck = checks[0];
      const uptimePercent = await getUptimePercent();
      const avgTtfbMs = await getAvgTtfb();
      const cfData = await getCFAnalytics();
      const alerts = await getRecentAlerts(10);
      const reportData = {
        httpCode: latestCheck?.httpCode ?? 200,
        ttfbMs: latestCheck?.ttfbMs ?? 0,
        cacheStatus: latestCheck?.cacheStatus ?? "UNKNOWN",
        isUp: latestCheck?.isUp ?? true,
        uptimePercent,
        cacheHitRate: cfData.cacheHitRate,
        totalRequests: cfData.totalRequests,
        cachedRequests: cfData.cachedRequests,
        bandwidth: cfData.bandwidth,
        threats: cfData.threats,
        visits: cfData.visits,
        pageViews: cfData.pageViews,
        avgTtfbMs,
        recentAlerts: alerts.length,
        count404: cfData.count404,
        top404Urls: cfData.top404Urls
      };
      const msg = buildDailyReport("morning", reportData);
      const result = await sendTelegramMessage(msg);
      return { success: result.success, messageId: result.messageId, error: result.error };
    }),
    schedulerStatus: publicProcedure.query(async () => {
      const scheduleInfos = getScheduleInfos();
      const dbStates = await getSchedulerStates();
      const currentTime = getCurrentBangkokTime();
      return {
        currentBangkokTime: currentTime,
        schedules: scheduleInfos.map((info) => {
          const dbState = dbStates.find((s) => s.jobName === info.jobName);
          return {
            jobName: info.jobName,
            label: info.label,
            cronUtc: info.cronUtc,
            nextRunBangkok: info.nextRunBangkok,
            nextRunUtc: info.nextRunUtc,
            lastRunAt: dbState?.lastRunAt ?? null,
            lastStatus: dbState?.lastStatus ?? "pending",
            taskUid: dbState?.scheduleCronTaskUid ?? null
          };
        })
      };
    }),
    alerts: publicProcedure.query(async () => {
      return getRecentAlerts(20);
    }),
    approvePurge: publicProcedure.input((v) => {
      const { alertId } = v;
      if (typeof alertId !== "number") throw new Error("alertId must be a number");
      return { alertId };
    }).mutation(async ({ input }) => {
      const purgeResult = await purgeCFCache();
      if (purgeResult.success) {
        await resolveAlertPurge(input.alertId);
      }
      return { success: purgeResult.success, message: purgeResult.message };
    }),
    brokenLinks: publicProcedure.query(async () => {
      return getTopBrokenLinks(20);
    }),
    activeBrokenLinksCount: publicProcedure.query(async () => {
      const count = await getActiveBrokenLinksCount();
      return { count };
    }),
    markFixed: publicProcedure.input(z2.object({ id: z2.number().int().positive() })).mutation(async ({ input }) => {
      await markBrokenLinkFixed(input.id);
      return { success: true };
    }),
    securityLevel: publicProcedure.query(async () => {
      const level = await getCFSecurityLevel();
      return { level: level ?? "medium" };
    }),
    cacheDiagnostic: publicProcedure.query(async () => {
      return getLatestCacheDiagnostic();
    }),
    /** Returns last 20 cache diagnostics for the status bar chart (newest first). */
    cacheHistory: publicProcedure.query(async () => {
      return getRecentCacheDiagnostics(20);
    }),
    summary: publicProcedure.query(async () => {
      const uptimePercent = await getUptimePercent();
      const avgTtfbMs = await getAvgTtfb();
      const cfData = await getCFAnalytics();
      const recentAlerts = await getRecentAlerts(5);
      const scheduleInfos = getScheduleInfos();
      return {
        uptimePercent,
        avgTtfbMs,
        cfData,
        recentAlerts,
        scheduleInfos,
        currentBangkokTime: getCurrentBangkokTime()
      };
    })
  }),
  // ─── Reply Templates (V3.4) ──────────────────────────────────────────────────
  replyTemplates: router({
    list: protectedProcedure.query(async () => getAllReplyTemplates()),
    create: protectedProcedure.input(z2.object({ template: z2.string().min(1).max(500) })).mutation(async ({ input }) => {
      await createReplyTemplate(input.template);
      return { success: true };
    }),
    update: protectedProcedure.input(z2.object({ id: z2.number().int().positive(), template: z2.string().min(1).max(500).optional(), isActive: z2.boolean().optional() })).mutation(async ({ input }) => {
      const { id, ...patch } = input;
      await updateReplyTemplate(id, patch);
      return { success: true };
    }),
    delete: protectedProcedure.input(z2.object({ id: z2.number().int().positive() })).mutation(async ({ input }) => {
      await deleteReplyTemplate(input.id);
      return { success: true };
    })
  }),
  // ─── Toxic Keywords (V3.4) ───────────────────────────────────────────────────
  toxicKeywords: router({
    list: protectedProcedure.query(async () => getAllToxicKeywords()),
    create: protectedProcedure.input(z2.object({ keyword: z2.string().min(1).max(255), category: z2.string().default("spam") })).mutation(async ({ input }) => {
      await createToxicKeyword(input.keyword, input.category);
      return { success: true };
    }),
    update: protectedProcedure.input(z2.object({ id: z2.number().int().positive(), keyword: z2.string().min(1).max(255).optional(), category: z2.string().optional(), isActive: z2.boolean().optional() })).mutation(async ({ input }) => {
      const { id, ...patch } = input;
      await updateToxicKeyword(id, patch);
      return { success: true };
    }),
    delete: protectedProcedure.input(z2.object({ id: z2.number().int().positive() })).mutation(async ({ input }) => {
      await deleteToxicKeyword(input.id);
      return { success: true };
    })
  }),
  // ─── WP Sentinel V6.0 ────────────────────────────────────────────────────────
  wpSentinel: router({
    getV6Data: publicProcedure.query(async () => {
      const { fetchWpSentinelV6: fetchWpSentinelV62 } = await Promise.resolve().then(() => (init_wordpress(), wordpress_exports));
      return fetchWpSentinelV62();
    }),
    // V12.2: DB Latency Sparkline — 24h timeline data points
    getLatencyTimeline: publicProcedure.query(async () => {
      const { getWpDbLatencyTimeline: getWpDbLatencyTimeline2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      return getWpDbLatencyTimeline2(24);
    })
  }),
  // ─── Personal Agenda (V3.4) ──────────────────────────────────────────────────
  agenda: router({
    get: protectedProcedure.input(z2.object({ date: z2.string().regex(/^\d{4}-\d{2}-\d{2}$/) })).query(async ({ input }) => getPersonalAgenda(input.date)),
    save: protectedProcedure.input(z2.object({ date: z2.string().regex(/^\d{4}-\d{2}-\d{2}$/), content: z2.string().max(2e3) })).mutation(async ({ input }) => {
      await upsertPersonalAgenda(input.date, input.content);
      return { success: true };
    }),
    recent: protectedProcedure.query(async () => getRecentAgendas(7))
  })
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/vite.ts
import express from "express";
import fs2 from "fs";
import { nanoid } from "nanoid";
import path3 from "path";
import { createServer as createViteServer } from "vite";

// vite.config.ts
import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path2 from "node:path";
import { defineConfig } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";
var PROJECT_ROOT = import.meta.dirname;
var LOG_DIR = path2.join(PROJECT_ROOT, ".manus-logs");
var MAX_LOG_SIZE_BYTES = 1 * 1024 * 1024;
var TRIM_TARGET_BYTES = Math.floor(MAX_LOG_SIZE_BYTES * 0.6);
function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}
function trimLogFile(logPath, maxSize) {
  try {
    if (!fs.existsSync(logPath) || fs.statSync(logPath).size <= maxSize) {
      return;
    }
    const lines = fs.readFileSync(logPath, "utf-8").split("\n");
    const keptLines = [];
    let keptBytes = 0;
    const targetSize = TRIM_TARGET_BYTES;
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineBytes = Buffer.byteLength(`${lines[i]}
`, "utf-8");
      if (keptBytes + lineBytes > targetSize) break;
      keptLines.unshift(lines[i]);
      keptBytes += lineBytes;
    }
    fs.writeFileSync(logPath, keptLines.join("\n"), "utf-8");
  } catch {
  }
}
function writeToLogFile(source, entries) {
  if (entries.length === 0) return;
  ensureLogDir();
  const logPath = path2.join(LOG_DIR, `${source}.log`);
  const lines = entries.map((entry) => {
    const ts = (/* @__PURE__ */ new Date()).toISOString();
    return `[${ts}] ${JSON.stringify(entry)}`;
  });
  fs.appendFileSync(logPath, `${lines.join("\n")}
`, "utf-8");
  trimLogFile(logPath, MAX_LOG_SIZE_BYTES);
}
function vitePluginManusDebugCollector() {
  return {
    name: "manus-debug-collector",
    transformIndexHtml(html) {
      if (process.env.NODE_ENV === "production") {
        return html;
      }
      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: {
              src: "/__manus__/debug-collector.js",
              defer: true
            },
            injectTo: "head"
          }
        ]
      };
    },
    configureServer(server) {
      server.middlewares.use("/__manus__/logs", (req, res, next) => {
        if (req.method !== "POST") {
          return next();
        }
        const handlePayload = (payload) => {
          if (payload.consoleLogs?.length > 0) {
            writeToLogFile("browserConsole", payload.consoleLogs);
          }
          if (payload.networkRequests?.length > 0) {
            writeToLogFile("networkRequests", payload.networkRequests);
          }
          if (payload.sessionEvents?.length > 0) {
            writeToLogFile("sessionReplay", payload.sessionEvents);
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        };
        const reqBody = req.body;
        if (reqBody && typeof reqBody === "object") {
          try {
            handlePayload(reqBody);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
          return;
        }
        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });
        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            handlePayload(payload);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
        });
      });
    }
  };
}
var vite_config_default = defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    jsxLocPlugin(),
    vitePluginManusRuntime(),
    vitePluginManusDebugCollector()
  ],
  resolve: {
    alias: {
      "@": path2.resolve(import.meta.dirname, "client", "src"),
      "@shared": path2.resolve(import.meta.dirname, "shared"),
      "@assets": path2.resolve(import.meta.dirname, "attached_assets")
    }
  },
  envDir: path2.resolve(import.meta.dirname),
  root: path2.resolve(import.meta.dirname, "client"),
  publicDir: path2.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path2.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1"
    ],
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/_core/vite.ts
async function setupVite(app, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    server: serverOptions,
    appType: "custom"
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path3.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );
      let template = await fs2.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app) {
  const distPath = process.env.NODE_ENV === "development" ? path3.resolve(import.meta.dirname, "../..", "dist", "public") : path3.resolve(import.meta.dirname, "public");
  if (!fs2.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app.use(express.static(distPath));
  app.use("*", (_req, res) => {
    res.sendFile(path3.resolve(distPath, "index.html"));
  });
}

// server/heartbeatHandlers.ts
init_telegram();
init_db();
init_cloudflare();
async function buildReportData(windowDays = 1) {
  const checks = await getRecentChecks(1);
  const latestCheck = checks[0];
  const uptimePercent = await getUptimePercent();
  const avgTtfbMs = await getAvgTtfb();
  const alerts = await getRecentAlerts(10);
  const cached = await getLatestCFAnalyticsSnapshot(windowDays);
  let cfData;
  if (cached) {
    const countryTraffic = cached.countryJson ? JSON.parse(cached.countryJson) : [];
    cfData = {
      cacheHitRate: cached.cacheHitRate,
      totalRequests: cached.totalRequests,
      cachedRequests: cached.cachedRequests,
      bandwidth: cached.bandwidth,
      threats: cached.threats,
      visits: cached.visits,
      pageViews: cached.pageViews,
      count404: cached.count404,
      top404Urls: [],
      countryTraffic
    };
  } else {
    cfData = await getCFAnalytics(windowDays);
  }
  return {
    httpCode: latestCheck?.httpCode ?? 200,
    ttfbMs: latestCheck?.ttfbMs ?? 0,
    cacheStatus: latestCheck?.cacheStatus ?? "UNKNOWN",
    isUp: latestCheck?.isUp ?? true,
    uptimePercent,
    cacheHitRate: cfData.cacheHitRate,
    totalRequests: cfData.totalRequests,
    cachedRequests: cfData.cachedRequests,
    bandwidth: cfData.bandwidth,
    threats: cfData.threats,
    visits: cfData.visits,
    pageViews: cfData.pageViews,
    avgTtfbMs,
    recentAlerts: alerts.length,
    count404: cfData.count404,
    top404Urls: cfData.top404Urls,
    countryTraffic: cfData.countryTraffic
  };
}
async function buildExtendedReportData(windowDays = 7) {
  const allChecks = await getRecentChecks(100);
  const checksTotal = allChecks.length;
  const checksUp = allChecks.filter((c) => c.isUp).length;
  const base = await buildReportData(windowDays);
  return { ...base, checksTotal, checksUp };
}
async function handleCFSnapshot(req, res) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });
    const windows = [1, 7, 30];
    const results = {};
    for (const days of windows) {
      try {
        const cfData = await getCFAnalytics(days);
        const topPosts = await getTopPosts(days, 10);
        const blockRate = cfData.totalRequests > 0 ? Math.round(cfData.threats / cfData.totalRequests * 100) : 0;
        await saveCFAnalyticsSnapshot({
          totalRequests: cfData.totalRequests,
          cachedRequests: cfData.cachedRequests,
          bandwidth: cfData.bandwidth,
          threats: cfData.threats,
          visits: cfData.visits,
          pageViews: cfData.pageViews,
          cacheHitRate: cfData.cacheHitRate,
          blockRate,
          count404: cfData.count404,
          topPostsJson: JSON.stringify(topPosts),
          countryJson: JSON.stringify(cfData.countryTraffic),
          windowDays: days
        });
        results[days] = "ok";
      } catch (e) {
        console.warn(`[cf-snapshot] window=${days}d failed:`, e);
        results[days] = "error";
      }
    }
    await upsertSchedulerState("cf-snapshot", {
      lastRunAt: /* @__PURE__ */ new Date(),
      lastStatus: Object.values(results).every((r) => r === "ok") ? "ok" : "partial"
    });
    res.json({ ok: true, windows: results });
  } catch (err) {
    console.error("[heartbeat:cf-snapshot]", err);
    res.status(500).json({ error: err.message });
  }
}
async function handleMonitorCheck(req, res) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });
    const result = await runMonitorCycle();
    try {
      const diag = analyzeCacheDiagnostic(
        result.check.cacheStatus,
        result.check.cacheControl ?? "",
        result.check.vary ?? "",
        result.check.setCookieHeader ?? ""
      );
      await saveCacheDiagnostic(diag);
    } catch (e) {
      console.warn("[cache-diag] failed to save:", e);
    }
    const cfData = await getCFAnalytics();
    if (cfData.top404Urls.length > 0) {
      await upsertBrokenLinks(cfData.top404Urls);
      const criticalHits = cfData.top404Urls.filter(
        (entry) => CRITICAL_URLS.some((p) => entry.url === p || entry.url.startsWith(p + "?"))
      );
      if (criticalHits.length > 0) {
        const inCooldown = await isInCooldown("critical_404");
        if (!inCooldown) {
          const msg = buildCritical404Alert(criticalHits.map((e) => e.url));
          await sendTelegramMessage(msg);
          await setCooldown("critical_404", 60);
        }
      }
    }
    try {
      const highRate404IPs = await getTop404IPsLast5Min(100);
      for (const { ip, count } of highRate404IPs) {
        const alreadyBanned = await isBannedIP(ip);
        if (!alreadyBanned) {
          const blockResult = await blockIPInCFWAF(ip);
          await upsertBannedIP(ip, count, blockResult.wafBlocked, blockResult.message);
          const msg = buildAutoBanAlert(ip, count);
          await sendTelegramMessage(msg);
        }
      }
    } catch (e) {
      console.warn("[protocol1-autoban]", e);
    }
    try {
      const spikeResult = await getTrendingTrafficSpikes(500);
      if (spikeResult.spikes.length > 0 && !await isInCooldown("article_spike_1h")) {
        await sendTelegramMessage(buildArticleSpikeAlert(spikeResult.spikes));
        await setCooldown("article_spike_1h", 60);
      }
    } catch (e) {
      console.warn("[advanced-article-spike]", e);
    }
    try {
      const bruteForce = await getBruteForceLoginAttempts(20);
      if (bruteForce.offenders.length > 0 && !await isInCooldown("bruteforce_login_15m")) {
        await sendTelegramMessage(buildBruteForceLoginAlert(bruteForce.offenders));
        await setCooldown("bruteforce_login_15m", 30);
      }
    } catch (e) {
      console.warn("[advanced-bruteforce-login]", e);
    }
    try {
      const httpCode = result.check.httpCode;
      const isHostatomDown = [502, 503, 504].includes(httpCode);
      const wasDown = await isInCooldown("hostatom_down");
      if (isHostatomDown && !wasDown) {
        await sendTelegramMessage(buildHostatomDownAlert(httpCode));
        await setCooldown("hostatom_down", 60);
      } else if (!isHostatomDown && wasDown) {
        await sendTelegramMessage(buildHostatomRecoveredAlert());
        await setCooldown("hostatom_down", 0);
      }
    } catch (e) {
      console.warn("[protocol2-uptime]", e);
    }
    try {
      const recentDiags = await getRecentCacheDiagnostics(3);
      const BYPASS_STATUSES = ["BYPASS", "MISS", "EXPIRED"];
      if (recentDiags.length === 3 && recentDiags.every((d) => BYPASS_STATUSES.includes(d.cfCacheStatus)) && !await isInCooldown("cache_bypass_streak")) {
        const latest = recentDiags[0];
        const { buildCacheBypassAlert: buildCacheBypassAlert2 } = await Promise.resolve().then(() => (init_telegram(), telegram_exports));
        await sendTelegramMessage(buildCacheBypassAlert2(
          latest.cfCacheStatus,
          latest.wpCookiesDetected,
          latest.potentialCause
        ));
        await setCooldown("cache_bypass_streak", 60);
      }
    } catch (e) {
      console.warn("[cache-bypass-streak]", e);
    }
    await upsertSchedulerState("monitor-5min", {
      lastRunAt: /* @__PURE__ */ new Date(),
      lastStatus: result.check.isUp ? "ok" : "alert"
    });
    res.json({ ok: true, httpCode: result.check.httpCode, ttfbMs: result.check.ttfbMs, alerts: result.alertsFired });
  } catch (err) {
    console.error("[heartbeat:monitor-check]", err);
    res.status(500).json({ error: err.message });
  }
}
async function runExecutiveBriefLogic() {
  const { computeSiteHealthScore: computeSiteHealthScore2, getRecentActionLog: getRecentActionLog2, getUptimePercent: getUptimePercent2, getAvgTtfb: getAvgTtfb2, getActiveBrokenLinksCount: getActiveBrokenLinksCount2, getTtfbVariance: getTtfbVariance2, getWpDbLatencyHistory: getWpDbLatencyHistory2 } = await Promise.resolve().then(() => (init_db(), db_exports));
  const { getCacheEfficiencyData: getCacheEfficiencyData2 } = await Promise.resolve().then(() => (init_cloudflare(), cloudflare_exports));
  const { measureWpDbLatency: measureWpDbLatency2, classifyWpDbLatency: classifyWpDbLatency2, fetchWpSentinelV6: fetchWpSentinelV62 } = await Promise.resolve().then(() => (init_wordpress(), wordpress_exports));
  const [healthResult, actionLogEntries, cachedResult, cacheEffResult, uptimeResult, avgTtfbResult, brokenCountResult, varianceResult, wpDbResult, wpDbHistoryResult, sentinelV6Result] = await Promise.allSettled([
    computeSiteHealthScore2(),
    getRecentActionLog2(10),
    getLatestCFAnalyticsSnapshot(1),
    getCacheEfficiencyData2(),
    getUptimePercent2(),
    getAvgTtfb2(),
    getActiveBrokenLinksCount2(),
    getTtfbVariance2(20),
    measureWpDbLatency2(),
    getWpDbLatencyHistory2(24),
    fetchWpSentinelV62()
  ]);
  const health = healthResult.status === "fulfilled" ? healthResult.value : { score: 0, grade: "?", factors: {} };
  const actions = actionLogEntries.status === "fulfilled" ? actionLogEntries.value : [];
  const cf = cachedResult.status === "fulfilled" ? cachedResult.value : null;
  const cacheEff = cacheEffResult.status === "fulfilled" ? cacheEffResult.value : null;
  const uptimePct = uptimeResult.status === "fulfilled" ? uptimeResult.value : null;
  const avgTtfbMs = avgTtfbResult.status === "fulfilled" ? avgTtfbResult.value : null;
  const brokenCount = brokenCountResult.status === "fulfilled" ? brokenCountResult.value : null;
  const ttfbVariance = varianceResult.status === "fulfilled" ? varianceResult.value : null;
  const wpDb = wpDbResult.status === "fulfilled" ? wpDbResult.value : null;
  const wpDbHistory = wpDbHistoryResult.status === "fulfilled" ? wpDbHistoryResult.value : null;
  const sentinelV6 = sentinelV6Result.status === "fulfilled" ? sentinelV6Result.value : null;
  const gradeEmoji = health.grade === "A" ? "\u{1F7E2}" : health.grade === "B" ? "\u{1F7E1}" : health.grade === "C" ? "\u{1F7E0}" : "\u{1F534}";
  let pageSpeedSizeMb = null;
  try {
    const { checkPageSpeedPayload: checkPageSpeedPayload2 } = await Promise.resolve().then(() => (init_wordpress(), wordpress_exports));
    const ps = await checkPageSpeedPayload2();
    if (!ps.error) pageSpeedSizeMb = ps.pageSizeMb;
  } catch {
  }
  const autoFixCount = actions.filter((a) => a.actionType?.toLowerCase().includes("fix") || a.actionType?.toLowerCase().includes("purge") || a.actionType?.toLowerCase().includes("block")).length;
  const uptimeDisplay = uptimePct !== null ? `${uptimePct.toFixed(1)}%` : "N/A";
  const ttfbDisplay = avgTtfbMs !== null ? `${avgTtfbMs}ms` : "N/A";
  const brokenDisplay = brokenCount !== null ? `${brokenCount} \u0E25\u0E34\u0E07\u0E01\u0E4C` : "N/A";
  const blockDisplay = cf ? `${cf.blockRate}%` : "N/A";
  const overallStatus = health.score >= 80 ? "Healthy \u{1F7E2}" : health.score >= 60 ? "Warning \u{1F7E1}" : "Critical \u{1F534}";
  const psDisplay = pageSpeedSizeMb !== null ? `${pageSpeedSizeMb.toFixed(2)} MB${pageSpeedSizeMb > 5 ? " \u26A0\uFE0F >5MB" : " \u2705"}` : "N/A";
  const wpDbAvgDisplay = wpDbHistory ? `${wpDbHistory.avgLatencyMs}ms` : wpDb ? `${wpDb.latencyMs}ms` : "N/A";
  const bangkokDateShort = (/* @__PURE__ */ new Date()).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Bangkok" });
  let msg = `\u{1F4CA} <b>NCR Morning Brief | ${bangkokDateShort}</b>
`;
  msg += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
`;
  msg += `\u2022 <b>Overall Health:</b> ${overallStatus} (${health.score}/100)
`;
  msg += `\u2022 <b>PageSpeed (Mobile):</b> ${psDisplay} (Goal: 90+)
`;
  msg += `\u2022 <b>System Pulse (Avg):</b> ${wpDbAvgDisplay} (Goal: <0.1s)
`;
  msg += `\u2022 <b>Auto-Fixes:</b> ${autoFixCount} cleanups in 24h
`;
  msg += `\u2022 <b>Uptime:</b> ${uptimeDisplay}
`;
  msg += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
`;
  msg += `
${gradeEmoji} <b>Health Score: ${health.score}/100 (Grade ${health.grade})</b>
`;
  msg += `\u2022 \u26A1 Avg TTFB: ${ttfbDisplay} (${health.factors.ttfbScore ?? 0}/30 pts)
`;
  msg += `\u2022 \u{1F6E1}\uFE0F Security Block Rate: ${blockDisplay} (${health.factors.blockScore ?? 0}/20 pts)
`;
  msg += `\u2022 \u{1F517} Broken Links: ${brokenDisplay} (${health.factors.brokenScore ?? 0}/10 pts)
`;
  if (cf) {
    msg += `
\u{1F4CA} <b>Resource Efficiency (24h):</b>
`;
    msg += `\u2022 Requests: ${cf.totalRequests.toLocaleString()} | Cache Hit: ${cf.cacheHitRate}%
`;
    msg += `\u2022 Visitors: ${cf.visits.toLocaleString()} | Page Views: ${cf.pageViews.toLocaleString()}
`;
    msg += `\u2022 Threats Blocked: ${cf.threats.toLocaleString()} (${cf.blockRate}%)
`;
  }
  if (cacheEff) {
    const adjPct = (cacheEff.adjustedCacheHitRate * 100).toFixed(1);
    const rawPct = cf ? `${cf.cacheHitRate}%` : "N/A";
    const targetIcon = cacheEff.meetsTarget ? "\u2705" : "\u26A0\uFE0F";
    const trend = cf ? (() => {
      const diff = cacheEff.adjustedCacheHitRate * 100 - cf.cacheHitRate;
      if (Math.abs(diff) < 1) return "\u27A1\uFE0F \u0E40\u0E2A\u0E16\u0E35\u0E22\u0E23";
      return diff > 0 ? `\u2B06\uFE0F +${diff.toFixed(1)}% vs 24h` : `\u2B07\uFE0F ${diff.toFixed(1)}% vs 24h`;
    })() : "";
    msg += `
${targetIcon} <b>Cache Efficiency:</b>
`;
    msg += `\u2022 24h Hit Rate: ${rawPct} | 6h Adjusted: ${adjPct}% ${trend}
`;
    msg += `\u2022 \u0E2A\u0E16\u0E32\u0E19\u0E30: ${cacheEff.meetsTarget ? "\u0E1C\u0E48\u0E32\u0E19\u0E40\u0E01\u0E13\u0E11\u0E4C (>80%)" : "\u26A0\uFE0F \u0E15\u0E48\u0E33\u0E01\u0E27\u0E48\u0E32\u0E40\u0E01\u0E13\u0E11\u0E4C 80%"}
`;
    if (cacheEff.fbclidRequests > 0) msg += `\u2022 fbclid MISS Requests: ${cacheEff.fbclidRequests.toLocaleString()}
`;
  }
  if (wpDb) {
    const { icon: dbIcon, label: dbLabel } = classifyWpDbLatency2(wpDb.latencyMs);
    msg += `
${dbIcon} <b>WordPress DB Latency:</b>
`;
    msg += `\u2022 \u0E40\u0E27\u0E25\u0E32\u0E15\u0E2D\u0E1A\u0E2A\u0E19\u0E2D\u0E07\u0E15\u0E2D\u0E19\u0E19\u0E35\u0E49: <b>${wpDb.latencyMs}ms</b> \u2014 ${dbLabel}
`;
    if (wpDbHistory) msg += `\u2022 24h Avg: <b>${wpDbHistory.avgLatencyMs}ms</b> (${wpDbHistory.samples} samples, slow: ${wpDbHistory.slowCount}, critical: ${wpDbHistory.criticalCount})
`;
    if (wpDb.isSlow) {
      const advice = wpDb.isCritical ? "\u26A0\uFE0F \u0E04\u0E27\u0E23\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A MySQL/MariaDB \u0E41\u0E25\u0E30 WP Cron \u0E17\u0E31\u0E19\u0E17\u0E35" : "\u{1F4A1} \u0E41\u0E19\u0E30\u0E19\u0E33\u0E43\u0E2B\u0E49\u0E1E\u0E31\u0E01\u0E01\u0E32\u0E23\u0E23\u0E31\u0E19\u0E23\u0E39\u0E1B\u0E20\u0E32\u0E1E (EWWW) \u0E0A\u0E31\u0E48\u0E27\u0E04\u0E23\u0E32\u0E27";
      msg += `\u2022 ${advice}
`;
    }
  }
  if (ttfbVariance && ttfbVariance.samples >= 2) {
    const varianceIcon = ttfbVariance.isUnstable ? "\u{1F7E0}" : "\u{1F7E2}";
    const varianceLabel = ttfbVariance.isUnstable ? "\u0E44\u0E21\u0E48\u0E40\u0E2A\u0E16\u0E35\u0E22\u0E23 (\u0E04\u0E27\u0E23\u0E15\u0E23\u0E27\u0E08 Cache Rules)" : "\u0E40\u0E2A\u0E16\u0E35\u0E22\u0E23";
    msg += `
${varianceIcon} <b>TTFB Stability (${ttfbVariance.samples} checks):</b>
`;
    msg += `\u2022 Variance: ${ttfbVariance.variance}ms | Min: ${ttfbVariance.minTtfb}ms | Max: ${ttfbVariance.maxTtfb}ms
`;
    msg += `\u2022 \u0E2A\u0E16\u0E32\u0E19\u0E30: ${varianceLabel}
`;
  }
  if (sentinelV6) {
    const diskIcon = sentinelV6.diskStatus === "critical" ? "\u{1F534}" : sentinelV6.diskStatus === "warning" ? "\u{1F7E1}" : "\u{1F7E2}";
    const diskDisplay = sentinelV6.diskSystemManaged ? "System Managed (Green)" : sentinelV6.diskFreeGb >= 0 ? `${sentinelV6.diskFreeGb.toFixed(1)} GB free` : "\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E2D\u0E48\u0E32\u0E19\u0E44\u0E14\u0E49";
    const modeIcon = sentinelV6.operatingMode.toLowerCase().includes("night") ? "\u{1F319}" : "\u2600\uFE0F";
    msg += `
\u{1F6E1}\uFE0F <b>WP Sentinel V6.0:</b>
`;
    msg += `\u2022 ${modeIcon} Operating Mode: <b>${sentinelV6.operatingMode}</b>
`;
    msg += `\u2022 ${diskIcon} Storage Health: ${diskDisplay}
`;
    if (sentinelV6.diskStatus === "critical") msg += `\u2022 \u26A0\uFE0F \u0E1E\u0E37\u0E49\u0E19\u0E17\u0E35\u0E48\u0E40\u0E2B\u0E25\u0E37\u0E2D\u0E19\u0E49\u0E2D\u0E22\u0E01\u0E27\u0E48\u0E32 1.5 GB \u2014 \u0E04\u0E27\u0E23\u0E25\u0E49\u0E32\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E17\u0E31\u0E19\u0E17\u0E35
`;
  }
  if (actions.length > 0) {
    msg += `
\u{1F916} <b>Action Log (\u0E25\u0E48\u0E32\u0E2A\u0E38\u0E14 ${actions.length} \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23):</b>
`;
    actions.slice(0, 5).forEach((a) => {
      const time = new Date(a.createdAt).toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" });
      msg += `\u2022 [${time}] ${a.actionType}: ${a.description.slice(0, 60)}
`;
    });
  } else {
    msg += `
\u{1F916} <b>Action Log:</b> \u0E44\u0E21\u0E48\u0E21\u0E35\u0E01\u0E32\u0E23\u0E14\u0E33\u0E40\u0E19\u0E34\u0E19\u0E01\u0E32\u0E23\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34\u0E43\u0E19\u0E0A\u0E48\u0E27\u0E07\u0E19\u0E35\u0E49
`;
  }
  msg += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
`;
  msg += `\u{1F517} <a href="${process.env.DASHBOARD_URL || "https://ncr-watchdog-dashboard.pages.dev/"}">\u0E14\u0E39 Dashboard</a>`;
  await sendTelegramMessage(msg);
  await upsertSchedulerState("executive-brief", { lastRunAt: /* @__PURE__ */ new Date(), lastStatus: "ok" });
}
async function handleDailyMorning(req, res) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });
    await runMonitorCycle();
    const data = await buildReportData();
    const topBrokenLinks = (await getTopBrokenLinks(3)).map((r) => ({ url: r.url, hits: r.hits }));
    const latestDiag = (await getRecentCacheDiagnostics(1))[0];
    const cacheHealthSummary = latestDiag ? `${latestDiag.cfCacheStatus}${latestDiag.wpCookiesDetected ? ` (WP Cookie: ${latestDiag.wpCookiesDetected})` : ""}` : void 0;
    const msg = buildDailyReport("morning", { ...data, topBrokenLinks, cacheHealthSummary });
    const result = await sendTelegramMessage(msg);
    try {
      const topPosts = await getTopPosts(1, 10);
      const topPostsMsg = buildTopPostsReport("daily", topPosts);
      await sendTelegramMessage(topPostsMsg);
    } catch (e) {
      console.warn("[heartbeat:daily-morning] top-posts failed:", e);
    }
    await upsertSchedulerState("daily-morning", {
      lastRunAt: /* @__PURE__ */ new Date(),
      lastStatus: result.success ? "ok" : "error"
    });
    try {
      await runExecutiveBriefLogic();
    } catch (e) {
      console.warn("[heartbeat:daily-morning] executive-brief failed:", e);
    }
    res.json({ ok: true, messageId: result.messageId });
  } catch (err) {
    console.error("[heartbeat:daily-morning]", err);
    res.status(500).json({ error: err.message });
  }
}
async function handleDailyEvening(req, res) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });
    await runMonitorCycle();
    const data = await buildReportData();
    const msg = buildDailyReport("evening", data);
    const result = await sendTelegramMessage(msg);
    await upsertSchedulerState("daily-evening", {
      lastRunAt: /* @__PURE__ */ new Date(),
      lastStatus: result.success ? "ok" : "error"
    });
    res.json({ ok: true, messageId: result.messageId });
  } catch (err) {
    console.error("[heartbeat:daily-evening]", err);
    res.status(500).json({ error: err.message });
  }
}
async function handleWeeklyReport(req, res) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });
    await runMonitorCycle();
    const data = await buildExtendedReportData();
    const msg = buildWeeklyReport(data);
    const result = await sendTelegramMessage(msg);
    try {
      const topPosts = await getTopPosts(7, 10);
      const topPostsMsg = buildTopPostsReport("weekly", topPosts);
      await sendTelegramMessage(topPostsMsg);
    } catch (e) {
      console.warn("[heartbeat:weekly-report] top-posts failed:", e);
    }
    await upsertSchedulerState("weekly-sunday", {
      lastRunAt: /* @__PURE__ */ new Date(),
      lastStatus: result.success ? "ok" : "error"
    });
    res.json({ ok: true, messageId: result.messageId });
  } catch (err) {
    console.error("[heartbeat:weekly-report]", err);
    res.status(500).json({ error: err.message });
  }
}
async function handleMonthlyReport(req, res) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });
    await runMonitorCycle();
    const data = await buildExtendedReportData(30);
    const month = (/* @__PURE__ */ new Date()).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "Asia/Bangkok" });
    const msg = buildMonthlyReport({ ...data, month });
    const result = await sendTelegramMessage(msg);
    try {
      const topPosts = await getTopPosts(30, 10);
      const topPostsMsg = buildTopPostsReport("monthly", topPosts);
      await sendTelegramMessage(topPostsMsg);
    } catch (e) {
      console.warn("[heartbeat:monthly-report] top-posts failed:", e);
    }
    await upsertSchedulerState("monthly-first", {
      lastRunAt: /* @__PURE__ */ new Date(),
      lastStatus: result.success ? "ok" : "error"
    });
    res.json({ ok: true, messageId: result.messageId });
  } catch (err) {
    console.error("[heartbeat:monthly-report]", err);
    res.status(500).json({ error: err.message });
  }
}
async function handleMorningBrief(req, res) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });
    const { fetchThaiNews: fetchThaiNews2, fetchGlobalNews: fetchGlobalNews2, generateEnglishSentences: generateEnglishSentences2, buildMorningBriefMessage: buildMorningBriefMessage2 } = await Promise.resolve().then(() => (init_morningBrief(), morningBrief_exports));
    const { getPersonalAgenda: getPersonalAgenda2 } = await Promise.resolve().then(() => (init_db(), db_exports));
    const bangkokDate = (/* @__PURE__ */ new Date()).toLocaleDateString("th-TH", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Asia/Bangkok"
    });
    const isoDate = (/* @__PURE__ */ new Date()).toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
    const [thaiNews, globalNews, englishSentences, agendaRow] = await Promise.allSettled([
      fetchThaiNews2(),
      fetchGlobalNews2(),
      generateEnglishSentences2(),
      getPersonalAgenda2(isoDate)
    ]);
    const msg = buildMorningBriefMessage2({
      thaiNews: thaiNews.status === "fulfilled" ? thaiNews.value : [],
      globalNews: globalNews.status === "fulfilled" ? globalNews.value : [],
      agendaContent: agendaRow.status === "fulfilled" ? agendaRow.value?.content ?? "" : "",
      englishSentences: englishSentences.status === "fulfilled" ? englishSentences.value : "",
      dateLabel: bangkokDate
    });
    const result = await sendTelegramMessage(msg);
    await upsertSchedulerState("morning-brief", {
      lastRunAt: /* @__PURE__ */ new Date(),
      lastStatus: result.success ? "ok" : "error"
    });
    res.json({ ok: true, sent: result.success });
  } catch (err) {
    console.error("[heartbeat:morning-brief]", err);
    res.status(500).json({ error: err.message });
  }
}
async function handleExecutiveBrief(req, res) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });
    await runExecutiveBriefLogic();
    res.json({ ok: true });
  } catch (err) {
    console.error("[heartbeat:executive-brief]", err);
    res.status(500).json({ error: err.message });
  }
}
async function handleKeepalive(req, res) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });
    const siteResult = await checkSite();
    const isDown = !siteResult.isUp || siteResult.httpCode >= 500;
    const isHighLatency = siteResult.ttfbMs > 3e3;
    const isHealthy = !isDown && !isHighLatency;
    const { getTtfbVariance: getTtfbVariance2 } = await Promise.resolve().then(() => (init_db(), db_exports));
    const variance = await getTtfbVariance2(20);
    await upsertSchedulerState("keepalive", {
      lastRunAt: /* @__PURE__ */ new Date(),
      lastStatus: isDown ? "down" : isHighLatency ? "high_latency" : variance.isUnstable ? "unstable" : "ok"
    });
    if (isDown || isHighLatency) {
      const inCooldown = await isInCooldown("keepalive-alert");
      if (!inCooldown) {
        const alertType = isDown ? "\u{1F534}" : "\u{1F7E1}";
        const alertLabel = isDown ? "Site DOWN" : "\u0E04\u0E27\u0E32\u0E21\u0E0A\u0E49\u0E32 (High Latency)";
        const msg = `${alertType} <b>[NCR Zero Ghosting] \u0E15\u0E23\u0E27\u0E08\u0E1E\u0E1A ${alertLabel}!</b>
HTTP: ${siteResult.httpCode} | TTFB: <b>${siteResult.ttfbMs}ms</b>${isHighLatency ? " (\u0E40\u0E01\u0E34\u0E19 3,000ms)" : ""}
\u{1F550} ${(/* @__PURE__ */ new Date()).toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok" })}
\u{1F517} <a href="${process.env.DASHBOARD_URL || "https://ncr-watchdog-dashboard.pages.dev/"}">\u0E14\u0E39 Dashboard</a>`;
        await sendTelegramMessage(msg);
        await setCooldown("keepalive-alert", isDown ? 120 : 240);
      }
    }
    if (variance.isUnstable && !isDown && !isHighLatency) {
      const inVarianceCooldown = await isInCooldown("keepalive-variance-alert");
      if (!inVarianceCooldown) {
        const msg = `\u{1F7E0} <b>[NCR V5.1] TTFB \u0E44\u0E21\u0E48\u0E40\u0E2A\u0E16\u0E35\u0E22\u0E23!</b>
\u0E04\u0E27\u0E32\u0E21\u0E41\u0E15\u0E01\u0E15\u0E48\u0E32\u0E07: <b>${variance.variance}ms</b> (\u0E40\u0E01\u0E34\u0E19 50ms)
Min: ${variance.minTtfb}ms | Max: ${variance.maxTtfb}ms | Avg: ${variance.avgTtfb}ms
\u{1F4CA} \u0E08\u0E32\u0E01 ${variance.samples} \u0E01\u0E32\u0E23\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E25\u0E48\u0E32\u0E2A\u0E38\u0E14
\u26A0\uFE0F \u0E2D\u0E32\u0E08\u0E40\u0E01\u0E34\u0E14\u0E08\u0E32\u0E01 Cache MISS \u0E2B\u0E23\u0E37\u0E2D Origin Server \u0E42\u0E2B\u0E25\u0E14\u0E2A\u0E39\u0E07
\u{1F517} <a href="${process.env.DASHBOARD_URL || "https://ncr-watchdog-dashboard.pages.dev/"}">\u0E14\u0E39 Dashboard</a>`;
        await sendTelegramMessage(msg);
        await setCooldown("keepalive-variance-alert", 360);
      }
    }
    const { measureWpDbLatency: measureWpDbLatency2 } = await Promise.resolve().then(() => (init_wordpress(), wordpress_exports));
    const { buildWpDbLatencyAlert: buildWpDbLatencyAlert2 } = await Promise.resolve().then(() => (init_telegram(), telegram_exports));
    const { saveWpDbLatency: saveWpDbLatency2 } = await Promise.resolve().then(() => (init_db(), db_exports));
    const wpDb = await measureWpDbLatency2();
    await saveWpDbLatency2(wpDb.latencyMs, wpDb.status, wpDb.httpCode);
    if (wpDb.isSlow) {
      const cooldownKey = wpDb.isCritical ? "keepalive-wpdb-critical" : "keepalive-wpdb-slow";
      const cooldownMinutes = wpDb.isCritical ? 60 : 120;
      const inWpDbCooldown = await isInCooldown(cooldownKey);
      if (!inWpDbCooldown) {
        const highLoadMsg = `\u{1F534} <b>High Load Detected</b> \u2014 WP DB Latency: <b>${wpDb.latencyMs}ms</b>
\u{1F4CA} Status: ${wpDb.isCritical ? "CRITICAL (>1000ms)" : "SLOW (>500ms)"}
\u{1F4A1} \u0E41\u0E19\u0E30\u0E19\u0E33: Purge CF Cache \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E25\u0E14 Origin Load
\u{1F517} <a href="${process.env.DASHBOARD_URL || "https://ncr-watchdog-dashboard.pages.dev/"}">Dashboard \u2192 Purge Cache</a>`;
        await sendTelegramMessage(highLoadMsg);
        await setCooldown(cooldownKey, cooldownMinutes);
      }
    }
    res.json({
      ok: true,
      healthy: isHealthy,
      isDown,
      isHighLatency,
      httpCode: siteResult.httpCode,
      ttfbMs: siteResult.ttfbMs,
      variance: variance.variance,
      isUnstable: variance.isUnstable,
      wpDbLatencyMs: wpDb.latencyMs,
      wpDbStatus: wpDb.status
    });
  } catch (err) {
    console.error("[heartbeat:keepalive]", err);
    res.status(500).json({ error: err.message });
  }
}
async function handleWeeklyQualityAudit(req, res) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });
    const { runQualityAudit: runQualityAudit2, buildQualityAuditReport: buildQualityAuditReport2 } = await Promise.resolve().then(() => (init_qualityAudit(), qualityAudit_exports));
    const { upsertQualityAuditResult: upsertQualityAuditResult2 } = await Promise.resolve().then(() => (init_db(), db_exports));
    const issues = await runQualityAudit2();
    for (const issue of issues) {
      await upsertQualityAuditResult2(issue);
    }
    const dashboardUrl = process.env.DASHBOARD_URL || "https://ncr-watchdog-dashboard.pages.dev/";
    const msg = buildQualityAuditReport2(issues, dashboardUrl);
    const result = await sendTelegramMessage(msg);
    await upsertSchedulerState("weekly-quality-audit", {
      lastRunAt: /* @__PURE__ */ new Date(),
      lastStatus: result.success ? "ok" : "error"
    });
    res.json({ ok: true, issuesFound: issues.length, sent: result.success });
  } catch (err) {
    console.error("[heartbeat:weekly-quality-audit]", err);
    res.status(500).json({ error: err.message });
  }
}
async function handleFBCommentModeration(req, res) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });
    if (FACEBOOK_PAUSED) {
      await upsertSchedulerState("fb-comment-moderation", { lastRunAt: /* @__PURE__ */ new Date(), lastStatus: "paused_v5" });
      return res.json({ ok: true, skipped: true, reason: "V5.0 Site Sentinel Mode \u2014 Facebook paused" });
    }
    const { runCommentModeration: runCommentModeration2, buildModerationReport: buildModerationReport2 } = await Promise.resolve().then(() => (init_facebook(), facebook_exports));
    const result = await runCommentModeration2(5);
    if (result.hidden > 0 || result.risky > 0) {
      const msg = buildModerationReport2(result);
      await sendTelegramMessage(msg);
    }
    await upsertSchedulerState("fb-comment-moderation", {
      lastRunAt: /* @__PURE__ */ new Date(),
      lastStatus: "ok"
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[heartbeat:fb-comment-moderation]", err);
    res.status(500).json({ error: err.message });
  }
}
async function handleFBViralScout(req, res) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });
    if (FACEBOOK_PAUSED) {
      await upsertSchedulerState("fb-viral-scout", { lastRunAt: /* @__PURE__ */ new Date(), lastStatus: "paused_v5" });
      return res.json({ ok: true, skipped: true, reason: "V5.0 Site Sentinel Mode \u2014 Facebook paused" });
    }
    const { runViralScout: runViralScout2, buildViralAlert: buildViralAlert2 } = await Promise.resolve().then(() => (init_facebook(), facebook_exports));
    const viralPosts = await runViralScout2(5, 10);
    if (viralPosts.length > 0) {
      const msg = buildViralAlert2(viralPosts);
      await sendTelegramMessage(msg);
    }
    await upsertSchedulerState("fb-viral-scout", {
      lastRunAt: /* @__PURE__ */ new Date(),
      lastStatus: "ok"
    });
    res.json({ ok: true, viralCount: viralPosts.length });
  } catch (err) {
    console.error("[heartbeat:fb-viral-scout]", err);
    res.status(500).json({ error: err.message });
  }
}
async function handleFBAdGovernance(req, res) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });
    if (FACEBOOK_PAUSED) {
      await upsertSchedulerState("fb-ad-governance", { lastRunAt: /* @__PURE__ */ new Date(), lastStatus: "paused_v5" });
      return res.json({ ok: true, skipped: true, reason: "V5.0 Site Sentinel Mode \u2014 Facebook paused" });
    }
    const { fetchAdReport: fetchAdReport2, buildAdGovernanceReport: buildAdGovernanceReport2 } = await Promise.resolve().then(() => (init_facebook(), facebook_exports));
    const report = await fetchAdReport2(5);
    const msg = buildAdGovernanceReport2(report);
    await sendTelegramMessage(msg);
    await upsertSchedulerState("fb-ad-governance", {
      lastRunAt: /* @__PURE__ */ new Date(),
      lastStatus: "ok"
    });
    res.json({ ok: true, totalSpend: report.totalSpend, campaigns: report.campaigns.length });
  } catch (err) {
    console.error("[heartbeat:fb-ad-governance]", err);
    res.status(500).json({ error: err.message });
  }
}
async function handleFBEthicalResponder(req, res) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });
    if (FACEBOOK_PAUSED) {
      await upsertSchedulerState("fb-ethical-responder", { lastRunAt: /* @__PURE__ */ new Date(), lastStatus: "paused_v5" });
      return res.json({ ok: true, skipped: true, reason: "V5.0 Site Sentinel Mode \u2014 Facebook paused" });
    }
    const {
      runEthicalResponder: runEthicalResponder2,
      buildEthicalResponderReport: buildEthicalResponderReport2,
      buildSensitiveFlagAlert: buildSensitiveFlagAlert2
    } = await Promise.resolve().then(() => (init_facebook(), facebook_exports));
    const result = await runEthicalResponder2(5, async (commentId, message) => {
      const alertMsg = buildSensitiveFlagAlert2(commentId, message);
      await sendTelegramMessage(alertMsg);
    });
    if (result.checked > 0 && result.liked + result.replied + result.hidden + result.flagged > 0) {
      const msg = buildEthicalResponderReport2(result);
      await sendTelegramMessage(msg);
    }
    await upsertSchedulerState("fb-ethical-responder", {
      lastRunAt: /* @__PURE__ */ new Date(),
      lastStatus: "ok"
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[heartbeat:fb-ethical-responder]", err);
    res.status(500).json({ error: err.message });
  }
}
async function handleViralPostGenerator(req, res) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });
    if (FACEBOOK_PAUSED) {
      await upsertSchedulerState("viral-post-generator", { lastRunAt: /* @__PURE__ */ new Date(), lastStatus: "paused_v5" });
      return res.json({ ok: true, skipped: true, reason: "V5.0 Site Sentinel Mode \u2014 Facebook paused" });
    }
    const { generateViralCaption: generateViralCaption2 } = await Promise.resolve().then(() => (init_gemini(), gemini_exports));
    const wpUrl = "https://nakornchiangrainews.com/wp-json/wp/v2/posts?per_page=1&_fields=id,title,excerpt,link";
    const r = await fetch(wpUrl, { signal: AbortSignal.timeout(8e3) });
    if (!r.ok) throw new Error(`WP API error: HTTP ${r.status}`);
    const posts = await r.json();
    if (!posts.length) {
      await upsertSchedulerState("viral-post-generator", { lastRunAt: /* @__PURE__ */ new Date(), lastStatus: "no_posts" });
      return res.json({ ok: true, skipped: true, reason: "no_posts" });
    }
    const post = posts[0];
    const title = post.title?.rendered ?? "";
    const excerpt = (post.excerpt?.rendered ?? "").replace(/<[^>]+>/g, "");
    const url = post.link ?? "";
    const result = await generateViralCaption2(title, excerpt, url);
    const msg = `\u270D\uFE0F <b>[NCR Viral Post Generator]</b>

${result.caption}`;
    await sendTelegramMessage(msg);
    await upsertSchedulerState("viral-post-generator", { lastRunAt: /* @__PURE__ */ new Date(), lastStatus: "ok" });
    res.json({ ok: true, postTitle: title });
  } catch (err) {
    console.error("[heartbeat:viral-post-generator]", err);
    res.status(500).json({ error: err.message });
  }
}
async function handlePublicMoodScanner(req, res) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });
    if (FACEBOOK_PAUSED) {
      await upsertSchedulerState("public-mood-scanner", { lastRunAt: /* @__PURE__ */ new Date(), lastStatus: "paused_v5" });
      return res.json({ ok: true, skipped: true, reason: "V5.0 Site Sentinel Mode \u2014 Facebook paused" });
    }
    const { analyzePublicMood: analyzePublicMood2, buildMoodScanReport: buildMoodScanReport2 } = await Promise.resolve().then(() => (init_gemini(), gemini_exports));
    const { getRecentPageComments: getRecentPageComments2 } = await Promise.resolve().then(() => (init_facebook(), facebook_exports));
    const comments = await getRecentPageComments2(100);
    const result = await analyzePublicMood2(comments);
    const msg = buildMoodScanReport2(result, comments.length);
    await sendTelegramMessage(msg);
    await upsertSchedulerState("public-mood-scanner", { lastRunAt: /* @__PURE__ */ new Date(), lastStatus: "ok" });
    res.json({ ok: true, commentCount: comments.length, sentiment: result.overallSentiment });
  } catch (err) {
    console.error("[heartbeat:public-mood-scanner]", err);
    res.status(500).json({ error: err.message });
  }
}
async function handle404SpikeDetection(req, res) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });
    const { get404SpikeData: get404SpikeData2 } = await Promise.resolve().then(() => (init_cloudflare(), cloudflare_exports));
    const { build404SpikeAlert: build404SpikeAlert2 } = await Promise.resolve().then(() => (init_telegram(), telegram_exports));
    const spike = await get404SpikeData2();
    if (spike.isSpike) {
      const inCooldown = await isInCooldown("404_spike");
      if (!inCooldown) {
        const msg = build404SpikeAlert2(spike.rate404, spike.count404, spike.totalRequests, spike.top404Urls);
        await sendTelegramMessage(msg);
        await setCooldown("404_spike", 60);
        if (spike.top404Urls.length > 0) {
          await upsertBrokenLinks(spike.top404Urls);
        }
      }
    }
    await upsertSchedulerState("404-spike-detection", {
      lastRunAt: /* @__PURE__ */ new Date(),
      lastStatus: spike.isSpike ? "spike_detected" : "ok"
    });
    res.json({
      ok: true,
      isSpike: spike.isSpike,
      rate404: spike.rate404,
      count404: spike.count404,
      totalRequests: spike.totalRequests
    });
  } catch (err) {
    console.error("[heartbeat:404-spike-detection]", err);
    res.status(500).json({ error: err.message });
  }
}
async function handleCacheEfficiencyAudit(req, res) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });
    const { getCacheEfficiencyData: getCacheEfficiencyData2 } = await Promise.resolve().then(() => (init_cloudflare(), cloudflare_exports));
    const { buildCacheEfficiencyReport: buildCacheEfficiencyReport2 } = await Promise.resolve().then(() => (init_telegram(), telegram_exports));
    const data = await getCacheEfficiencyData2();
    const msg = buildCacheEfficiencyReport2(data);
    await sendTelegramMessage(msg);
    await upsertSchedulerState("cache-efficiency-audit", {
      lastRunAt: /* @__PURE__ */ new Date(),
      lastStatus: data.meetsTarget ? "ok" : "below_target"
    });
    res.json({
      ok: true,
      cacheHitRate: data.cacheHitRate,
      adjustedCacheHitRate: data.adjustedCacheHitRate,
      meetsTarget: data.meetsTarget,
      fbclidRequests: data.fbclidRequests
    });
  } catch (err) {
    console.error("[heartbeat:cache-efficiency-audit]", err);
    res.status(500).json({ error: err.message });
  }
}
async function handleFBTrafficValidation(req, res) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });
    const { getFBTrafficValidation: getFBTrafficValidation2 } = await Promise.resolve().then(() => (init_cloudflare(), cloudflare_exports));
    const { buildFBTrafficReport: buildFBTrafficReport2 } = await Promise.resolve().then(() => (init_telegram(), telegram_exports));
    const data = await getFBTrafficValidation2();
    const msg = buildFBTrafficReport2(data);
    await sendTelegramMessage(msg);
    await upsertSchedulerState("fb-traffic-validation", {
      lastRunAt: /* @__PURE__ */ new Date(),
      lastStatus: data.hasIssue ? "issue_detected" : "ok"
    });
    res.json({
      ok: true,
      fbclidTotal: data.fbclidTotal,
      successRate: data.successRate,
      hasIssue: data.hasIssue
    });
  } catch (err) {
    console.error("[heartbeat:fb-traffic-validation]", err);
    res.status(500).json({ error: err.message });
  }
}
async function handleCacheWarmup(req, res) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });
    const wpRes = await fetch("https://nakornchiangrainews.com/wp-json/wp/v2/posts?per_page=1&_fields=id,link,date_gmt");
    if (!wpRes.ok) {
      return res.json({ ok: false, reason: `WP API error: ${wpRes.status}` });
    }
    const posts = await wpRes.json();
    if (!posts.length) return res.json({ ok: false, reason: "no posts found" });
    const latest = posts[0];
    const publishedAt = /* @__PURE__ */ new Date(latest.date_gmt + "Z");
    const ageMinutes = (Date.now() - publishedAt.getTime()) / 6e4;
    if (ageMinutes > 35) {
      await upsertSchedulerState("cache-warmup", {
        lastRunAt: /* @__PURE__ */ new Date(),
        lastStatus: "skipped"
      });
      return res.json({ ok: true, skipped: true, reason: `Post age ${ageMinutes.toFixed(0)}min > 35min`, url: latest.link });
    }
    const { getSchedulerStates: getSchedulerStates2 } = await Promise.resolve().then(() => (init_db(), db_exports));
    const states = await getSchedulerStates2();
    const warmupState = states.find((s) => s.jobName === "cache-warmup");
    const lastWarmedId = warmupState?.lastStatus?.startsWith("warmed:") ? warmupState.lastStatus.replace("warmed:", "") : null;
    if (lastWarmedId === String(latest.id)) {
      return res.json({ ok: true, skipped: true, reason: `Post ${latest.id} already warmed`, url: latest.link });
    }
    const startTime = Date.now();
    const prefetchRes = await fetch(latest.link, {
      headers: { "User-Agent": "NCR-Watchdog-CacheWarmup/5.1" }
    });
    const ttfbMs = Date.now() - startTime;
    await upsertSchedulerState("cache-warmup", {
      lastRunAt: /* @__PURE__ */ new Date(),
      lastStatus: prefetchRes.ok ? `warmed:${latest.id}` : `error:${latest.id}`
    });
    if (prefetchRes.ok) {
      const msg = `\u{1F525} <b>[NCR Cache Warm-Up]</b> \u0E40\u0E15\u0E34\u0E21\u0E41\u0E04\u0E0A\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08!
\u{1F4F0} ${latest.link}
\u26A1 TTFB: ${ttfbMs}ms | HTTP: ${prefetchRes.status}
\u{1F550} \u0E42\u0E1E\u0E2A\u0E15\u0E4C\u0E40\u0E21\u0E37\u0E48\u0E2D ${ageMinutes.toFixed(0)} \u0E19\u0E32\u0E17\u0E35\u0E17\u0E35\u0E48\u0E41\u0E25\u0E49\u0E27`;
      await sendTelegramMessage(msg);
    }
    res.json({ ok: prefetchRes.ok, url: latest.link, ttfbMs, httpCode: prefetchRes.status, ageMinutes });
  } catch (err) {
    console.error("[heartbeat:cache-warmup]", err);
    res.status(500).json({ error: err.message });
  }
}
async function handlePageSpeedPayloadAlert(req, res) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });
    const { checkPageSpeedPayload: checkPageSpeedPayload2 } = await Promise.resolve().then(() => (init_wordpress(), wordpress_exports));
    const { buildPageSpeedPayloadAlert: buildPageSpeedPayloadAlert2 } = await Promise.resolve().then(() => (init_telegram(), telegram_exports));
    const result = await checkPageSpeedPayload2();
    if (result.error) {
      console.warn("[pagespeed-payload] fetch error:", result.error);
      await upsertSchedulerState("pagespeed-payload", {
        lastRunAt: /* @__PURE__ */ new Date(),
        lastStatus: `error: ${result.error}`
      });
      return res.json({ ok: false, error: result.error });
    }
    if (result.isOversized) {
      const inCooldown = await isInCooldown("pagespeed-payload-alert");
      if (!inCooldown) {
        await sendTelegramMessage(buildPageSpeedPayloadAlert2(result.pageSizeMb));
        await setCooldown("pagespeed-payload-alert", 1440);
      }
    }
    await upsertSchedulerState("pagespeed-payload", {
      lastRunAt: /* @__PURE__ */ new Date(),
      lastStatus: result.isOversized ? `oversized:${result.pageSizeMb.toFixed(2)}MB` : `ok:${result.pageSizeMb.toFixed(2)}MB`
    });
    res.json({
      ok: true,
      pageSizeMb: result.pageSizeMb,
      isOversized: result.isOversized,
      alertFired: result.isOversized
    });
  } catch (err) {
    console.error("[heartbeat:pagespeed-payload]", err);
    res.status(500).json({ error: err.message });
  }
}

// server/webhookHandlers.ts
init_env();
init_telegram();
var WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? ENV.cookieSecret ?? "";
async function handleWpPublish(req, res) {
  try {
    const { secret, url } = req.body;
    if (!WEBHOOK_SECRET || secret !== WEBHOOK_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "Missing url" });
    }
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({ error: "Invalid url" });
    }
    const allowedHosts = ["nakornchiangrainews.com", "www.nakornchiangrainews.com"];
    if (!allowedHosts.includes(parsedUrl.hostname)) {
      return res.status(400).json({ error: "URL not allowed" });
    }
    let warmed = false;
    try {
      const warmRes = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": "NCRWatchdog/1.0 CacheWarmer (+https://nakornchiangrainews.com)",
          "Cache-Control": "no-cache"
          // bypass any stale cache on first hit
        },
        signal: AbortSignal.timeout(15e3)
        // 15s timeout
      });
      warmed = warmRes.ok;
      console.log(`[protocol3-cache-warm] GET ${url} \u2192 ${warmRes.status}`);
    } catch (fetchErr) {
      console.warn("[protocol3-cache-warm] fetch failed:", fetchErr);
    }
    const msg = buildCacheWarmedAlert(url);
    await sendTelegramMessage(msg);
    res.json({ ok: true, url, warmed });
  } catch (err) {
    console.error("[webhook:wp-publish]", err);
    res.status(500).json({ error: err.message });
  }
}

// server/_core/index.ts
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}
async function findAvailablePort(startPort = 3e3) {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}
async function startServer() {
  const app = express2();
  const server = createServer(app);
  const configuredAllowedOrigins = (process.env.ALLOWED_ORIGINS ?? process.env.FRONTEND_URL ?? "").split(",").map((origin) => origin.trim().replace(/\/$/, "")).filter(Boolean);
  const allowedOrigins = /* @__PURE__ */ new Set([
    "https://ncr-watchdog-dashboard.pages.dev",
    "https://29bfa18a.ncr-dashboard.pages.dev",
    "https://ncr-dashboard.pages.dev",
    ...configuredAllowedOrigins
  ]);
  app.use((req, res, next) => {
    const origin = req.headers.origin?.replace(/\/$/, "");
    const isAllowedOrigin = !origin || allowedOrigins.has(origin) || /^https:\/\/[a-z0-9-]+\.ncr-watchdog-dashboard\.pages\.dev$/i.test(origin) || /^https:\/\/[a-z0-9-]+\.ncr-dashboard\.pages\.dev$/i.test(origin);
    if (origin && isAllowedOrigin) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Vary", "Origin");
    }
    res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, trpc-accept");
    res.header("Access-Control-Max-Age", "86400");
    if (req.method === "OPTIONS") {
      res.sendStatus(isAllowedOrigin ? 204 : 403);
      return;
    }
    next();
  });
  app.use(express2.json({ limit: "50mb" }));
  app.use(express2.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.post("/api/webhook/wp-publish", handleWpPublish);
  app.post("/api/scheduled/cf-snapshot", handleCFSnapshot);
  app.post("/api/scheduled/morning-brief", handleMorningBrief);
  app.post("/api/scheduled/monitor-check", handleMonitorCheck);
  app.post("/api/scheduled/daily-morning", handleDailyMorning);
  app.post("/api/scheduled/daily-evening", handleDailyEvening);
  app.post("/api/scheduled/weekly-report", handleWeeklyReport);
  app.post("/api/scheduled/monthly-report", handleMonthlyReport);
  app.post("/api/scheduled/executive-brief", handleExecutiveBrief);
  app.post("/api/scheduled/keepalive", handleKeepalive);
  app.post("/api/scheduled/weekly-quality-audit", handleWeeklyQualityAudit);
  app.post("/api/scheduled/fb-comment-moderation", handleFBCommentModeration);
  app.post("/api/scheduled/fb-viral-scout", handleFBViralScout);
  app.post("/api/scheduled/fb-ad-governance", handleFBAdGovernance);
  app.post("/api/scheduled/fb-ethical-responder", handleFBEthicalResponder);
  app.post("/api/scheduled/viral-post-generator", handleViralPostGenerator);
  app.post("/api/scheduled/public-mood-scanner", handlePublicMoodScanner);
  app.post("/api/scheduled/404-spike-detection", handle404SpikeDetection);
  app.post("/api/scheduled/cache-efficiency-audit", handleCacheEfficiencyAudit);
  app.post("/api/scheduled/fb-traffic-validation", handleFBTrafficValidation);
  app.post("/api/scheduled/cache-warmup", handleCacheWarmup);
  app.post("/api/scheduled/pagespeed-payload", handlePageSpeedPayloadAlert);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
startServer().catch(console.error);
