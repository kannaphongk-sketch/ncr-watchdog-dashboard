import { eq, desc, asc, sql, gt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, monitorChecks, alertLog, schedulerState, alertCooldown, brokenLinks, cacheDiagnostics, bannedIPs, InsertMonitorCheck, InsertAlertLog, actionLog, qualityAuditResults, replyTemplates, toxicKeywords, wpDbLatencyLog } from "../drizzle/schema";
import type { ActionLog, QualityAuditResult, ReplyTemplate, ToxicKeyword } from "../drizzle/schema";
import { ENV } from './_core/env';
import {
  getLocalActiveBrokenLinksCount,
  getLocalAvgTtfb,
  getLocalCriticalBrokenLinks,
  getLocalLatestCacheDiagnostic,
  getLocalRecentAlerts,
  getLocalRecentCacheDiagnostics,
  getLocalRecentChecks,
  getLocalTopBrokenLinks,
  getLocalUptimePercent,
  markLocalBrokenLinkFixed,
  resolveLocalAlertPurge,
  saveLocalAlert,
  saveLocalCacheDiagnostic,
  saveLocalMonitorCheck,
  upsertLocalBrokenLinks,
} from "./localWatchdogStore";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
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

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ─── Monitor Checks ─────────────────────────────────────────────────────────

export async function saveMonitorCheck(check: InsertMonitorCheck): Promise<void> {
  await saveLocalMonitorCheck(check);
  const db = await getDb();
  if (!db) return;
  await db.insert(monitorChecks).values(check);
  // Keep only last 100 records
  await db.execute(sql`
    DELETE FROM monitor_checks WHERE id NOT IN (
      SELECT id FROM (
        SELECT id FROM monitor_checks ORDER BY createdAt DESC LIMIT 100
      ) AS t
    )
  `);
}

export async function getRecentChecks(limit = 100) {
  const db = await getDb();
  if (!db) return getLocalRecentChecks(limit);
  const checks = await db.select().from(monitorChecks).orderBy(desc(monitorChecks.createdAt)).limit(limit);
  return checks.length > 0 ? checks : getLocalRecentChecks(limit);
}

export async function getUptimePercent(): Promise<number> {
  const db = await getDb();
  if (!db) return getLocalUptimePercent();
  const checks = await db.select().from(monitorChecks).orderBy(desc(monitorChecks.createdAt)).limit(100);
  if (checks.length === 0) return getLocalUptimePercent();
  const upCount = checks.filter((c) => c.isUp).length;
  return (upCount / checks.length) * 100;
}

export async function getAvgTtfb(): Promise<number> {
  const db = await getDb();
  if (!db) return getLocalAvgTtfb();
  const checks = await db.select().from(monitorChecks).orderBy(desc(monitorChecks.createdAt)).limit(20);
  if (checks.length === 0) return getLocalAvgTtfb();
  return Math.round(checks.reduce((sum, c) => sum + c.ttfbMs, 0) / checks.length);
}

// ─── Alert Log ───────────────────────────────────────────────────────────────

export async function saveAlert(alert: InsertAlertLog): Promise<void> {
  await saveLocalAlert(alert);
  const db = await getDb();
  if (!db) return;
  await db.insert(alertLog).values(alert);
}

export async function getRecentAlerts(limit = 20) {
  const db = await getDb();
  if (!db) return getLocalRecentAlerts(limit);
  const alerts = await db.select().from(alertLog).orderBy(desc(alertLog.createdAt)).limit(limit);
  return alerts.length > 0 ? alerts : getLocalRecentAlerts(limit);
}

/**
 * Mark an alert's pendingPurge as resolved (called after manual cache purge approval).
 */
export async function resolveAlertPurge(id: number): Promise<void> {
  await resolveLocalAlertPurge(id);
  const db = await getDb();
  if (!db) return;
  await db.update(alertLog)
    .set({ pendingPurge: false, autoFixApplied: true, resolved: true })
    .where(eq(alertLog.id, id));
}

// ─── Alert Cooldown ──────────────────────────────────────────────────────────

export async function isInCooldown(type: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select().from(alertCooldown).where(eq(alertCooldown.alertType, type)).limit(1);
  if (rows.length === 0) return false;
  const row = rows[0];
  const cooldownMs = row.cooldownMinutes * 60 * 1000;
  return Date.now() - row.lastAlertAt.getTime() < cooldownMs;
}

export async function setCooldown(type: string, minutes = 30): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(alertCooldown)
    .values({ alertType: type, lastAlertAt: new Date(), cooldownMinutes: minutes })
    .onDuplicateKeyUpdate({ set: { lastAlertAt: new Date(), cooldownMinutes: minutes } });
}

// ─── Scheduler State ─────────────────────────────────────────────────────────

export async function getSchedulerStates() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(schedulerState).orderBy(asc(schedulerState.jobName));
}

export async function upsertSchedulerState(
  jobName: string,
  patch: { lastRunAt?: Date; nextRunAt?: Date; lastStatus?: string; scheduleCronTaskUid?: string }
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(schedulerState)
    .values({ jobName, ...patch })
    .onDuplicateKeyUpdate({ set: patch });
}

// ─── Broken Links ─────────────────────────────────────────────────────────────

/** Critical pages that should never return 404. */
export const CRITICAL_URLS = [
  "/",
  "/category/news/",
  "/category/lifestyle/",
  "/category/sport/",
  "/category/entertainment/",
  "/category/local/",
  "/category/politics/",
];

/**
 * Upsert a batch of 404 URL hits from Cloudflare analytics.
 * Uses INSERT … ON DUPLICATE KEY UPDATE to accumulate hit counts.
 */
export async function upsertBrokenLinks(
  entries: Array<{ url: string; hits: number }>
): Promise<void> {
  await upsertLocalBrokenLinks(entries, (url) =>
    CRITICAL_URLS.some((p) => url === p || url.startsWith(p + "?"))
  );
  const db = await getDb();
  if (!db || entries.length === 0) return;
  const now = new Date();
  for (const entry of entries) {
    const critical = CRITICAL_URLS.some(
      (p) => entry.url === p || entry.url.startsWith(p + "?")
    );
    await db
      .insert(brokenLinks)
      .values({
        url: entry.url,
        hits: entry.hits,
        isCritical: critical,
        lastSeen: now,
        firstSeen: now,
      })
      .onDuplicateKeyUpdate({
        set: {
          hits: sql`hits + ${entry.hits}`,
          isCritical: critical,
          lastSeen: now,
          // Auto-reopen: if this URL was previously marked as fixed but is
          // generating new 404 hits, set isFixed back to false so it
          // re-surfaces in the active Broken Links Log.
          isFixed: false,
        },
      });
  }
}

/** Return the top broken links ordered by hit count descending (excludes fixed rows). */
export async function getTopBrokenLinks(limit = 20) {
  const db = await getDb();
  if (!db) return getLocalTopBrokenLinks(limit);
  const links = await db
    .select()
    .from(brokenLinks)
    .where(eq(brokenLinks.isFixed, false))
    .orderBy(desc(brokenLinks.hits))
    .limit(limit);
  return links.length > 0 ? links : getLocalTopBrokenLinks(limit);
}

/** Mark a broken link as fixed (archived from the active list). */
export async function markBrokenLinkFixed(id: number): Promise<void> {
  await markLocalBrokenLinkFixed(id);
  const db = await getDb();
  if (!db) return;
  await db.update(brokenLinks).set({ isFixed: true }).where(eq(brokenLinks.id, id));
}

/** Return the count of active (not fixed) broken links. */
export async function getActiveBrokenLinksCount(): Promise<number> {
  const db = await getDb();
  if (!db) return getLocalActiveBrokenLinksCount();
  const rows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(brokenLinks)
    .where(eq(brokenLinks.isFixed, false));
  const count = rows[0]?.count ?? 0;
  return count > 0 ? count : getLocalActiveBrokenLinksCount();
}

/** Return only critical broken links (isCritical = true). */
export async function getCriticalBrokenLinks() {
  const db = await getDb();
  if (!db) return getLocalCriticalBrokenLinks();
  const links = await db
    .select()
    .from(brokenLinks)
    .where(eq(brokenLinks.isCritical, true))
    .orderBy(desc(brokenLinks.hits));
  return links.length > 0 ? links : getLocalCriticalBrokenLinks();
}

// ─── Cache Diagnostics ────────────────────────────────────────────────────────

export interface CacheDiagnosticInput {
  cfCacheStatus: string;
  cacheControl: string;
  vary: string;
  wpCookiesDetected: string;
  potentialCause: string;
}

/** Persist a new cache diagnostic record. Keeps only the latest 50. */
export async function saveCacheDiagnostic(data: CacheDiagnosticInput): Promise<void> {
  await saveLocalCacheDiagnostic(data);
  const db = await getDb();
  if (!db) return;
  await db.insert(cacheDiagnostics).values({ ...data, checkedAt: new Date() });
  // Keep only last 50 records
  await db.execute(sql`
    DELETE FROM cache_diagnostics WHERE id NOT IN (
      SELECT id FROM (
        SELECT id FROM cache_diagnostics ORDER BY checked_at DESC LIMIT 50
      ) AS t
    )
  `);
}

/** Return the N most recent cache diagnostic records (newest first). */
export async function getRecentCacheDiagnostics(n = 20) {
  const db = await getDb();
  if (!db) return getLocalRecentCacheDiagnostics(n);
  const diagnostics = await db
    .select()
    .from(cacheDiagnostics)
    .orderBy(desc(cacheDiagnostics.checkedAt))
    .limit(n);
  return diagnostics.length > 0 ? diagnostics : getLocalRecentCacheDiagnostics(n);
}

/** Return the most recent cache diagnostic record. */
export async function getLatestCacheDiagnostic() {
  const db = await getDb();
  if (!db) return getLocalLatestCacheDiagnostic();
  const rows = await db
    .select()
    .from(cacheDiagnostics)
    .orderBy(desc(cacheDiagnostics.checkedAt))
    .limit(1);
  return rows[0] ?? await getLocalLatestCacheDiagnostic();
}

// ─── Protocol 1: Banned IPs ───────────────────────────────────────────────────

/** Upsert a banned IP record. If IP already exists, update count and message. */
export async function upsertBannedIP(
  ip: string,
  count404: number,
  wafBlocked: boolean,
  blockMessage: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(bannedIPs)
    .values({ ip, count404, wafBlocked, blockMessage, bannedAt: new Date() })
    .onDuplicateKeyUpdate({
      set: {
        count404: sql`count_404 + ${count404}`,
        wafBlocked,
        blockMessage,
        bannedAt: new Date(),
      },
    });
}

/** Return all banned IPs ordered by most recently banned. */
export async function getBannedIPs(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(bannedIPs).orderBy(desc(bannedIPs.bannedAt)).limit(limit);
}

/** Check if an IP is already in the banned list. */
export async function isBannedIP(ip: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select({ id: bannedIPs.id }).from(bannedIPs).where(eq(bannedIPs.ip, ip)).limit(1);
  return rows.length > 0;
}

// ─── CF Analytics Cache helpers ───────────────────────────────────────────────

import { cfAnalyticsCache } from "../drizzle/schema";

export interface CFAnalyticsCacheInput {
  totalRequests: number;
  cachedRequests: number;
  bandwidth: number;
  threats: number;
  visits: number;
  pageViews: number;
  cacheHitRate: number;
  blockRate: number;
  count404: number;
  topPostsJson: string;
  countryJson?: string;
  windowDays: number;
}

/** Insert a new CF analytics snapshot row. */
export async function saveCFAnalyticsSnapshot(data: CFAnalyticsCacheInput): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(cfAnalyticsCache).values({
    ...data,
    snapshotAt: new Date(),
  });
}

/** Get the most recent CF analytics snapshot for a given window (days). */
export async function getLatestCFAnalyticsSnapshot(windowDays: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(cfAnalyticsCache)
    .where(eq(cfAnalyticsCache.windowDays, windowDays))
    .orderBy(desc(cfAnalyticsCache.snapshotAt))
    .limit(1);
  return rows[0] ?? null;
}

// ─── Personal Agenda helpers ───────────────────────────────────────────────────

import { personalAgenda } from "../drizzle/schema";

/** Upsert today's personal agenda content. */
export async function upsertPersonalAgenda(date: string, content: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(personalAgenda)
    .values({ date, content })
    .onDuplicateKeyUpdate({ set: { content, updatedAt: new Date() } });
}

/** Get personal agenda for a specific date (YYYY-MM-DD). Returns null if not set. */
export async function getPersonalAgenda(date: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(personalAgenda)
    .where(eq(personalAgenda.date, date))
    .limit(1);
  return rows[0] ?? null;
}

/** Get the last N agenda entries. */
export async function getRecentAgendas(limit = 7) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(personalAgenda)
    .orderBy(desc(personalAgenda.date))
    .limit(limit);
}

// ============================================================
// V3.0: Action Log helpers
// ============================================================
export async function logAction(actionType: string, description: string, metadata?: Record<string, unknown>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(actionLog).values({
    actionType,
    description,
    metadata: metadata ? JSON.stringify(metadata) : null,
  });
}

export async function getRecentActionLog(limit = 20): Promise<ActionLog[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(actionLog).orderBy(desc(actionLog.createdAt)).limit(limit);
}

// ============================================================
// V3.0: Quality Audit helpers
// ============================================================
export async function upsertQualityAuditResult(item: { auditType: string; url: string; issue: string; severity?: string }): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(qualityAuditResults).values({
    auditType: item.auditType,
    url: item.url,
    issue: item.issue,
    severity: item.severity ?? "warning",
  }).onDuplicateKeyUpdate({
    set: { issue: item.issue, severity: item.severity ?? "warning", updatedAt: new Date(), isFixed: false },
  });
}

export async function getOpenQualityAuditResults(auditType?: string): Promise<QualityAuditResult[]> {
  const db = await getDb();
  if (!db) return [];
  const q = db.select().from(qualityAuditResults).where(eq(qualityAuditResults.isFixed, false));
  return q.orderBy(desc(qualityAuditResults.createdAt)).limit(50);
}

export async function markQualityAuditFixed(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(qualityAuditResults).set({ isFixed: true, updatedAt: new Date() }).where(eq(qualityAuditResults.id, id));
}

// ============================================================
// V3.4: Reply Templates helpers
// ============================================================
export async function getActiveReplyTemplates(): Promise<ReplyTemplate[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(replyTemplates).where(eq(replyTemplates.isActive, true)).orderBy(asc(replyTemplates.id));
}

export async function getAllReplyTemplates(): Promise<ReplyTemplate[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(replyTemplates).orderBy(asc(replyTemplates.id));
}

export async function createReplyTemplate(template: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(replyTemplates).values({ template, isActive: true });
}

export async function updateReplyTemplate(id: number, patch: { template?: string; isActive?: boolean }): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(replyTemplates).set({ ...patch, updatedAt: new Date() }).where(eq(replyTemplates.id, id));
}

export async function deleteReplyTemplate(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(replyTemplates).where(eq(replyTemplates.id, id));
}

// ============================================================
// V3.4: Toxic Keywords helpers
// ============================================================
export async function getActiveToxicKeywords(): Promise<ToxicKeyword[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(toxicKeywords).where(eq(toxicKeywords.isActive, true)).orderBy(asc(toxicKeywords.keyword));
}

export async function getAllToxicKeywords(): Promise<ToxicKeyword[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(toxicKeywords).orderBy(asc(toxicKeywords.keyword));
}

export async function createToxicKeyword(keyword: string, category = "spam"): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(toxicKeywords).values({ keyword, category, isActive: true });
}

export async function updateToxicKeyword(id: number, patch: { keyword?: string; category?: string; isActive?: boolean }): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(toxicKeywords).set(patch).where(eq(toxicKeywords.id, id));
}

export async function deleteToxicKeyword(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(toxicKeywords).where(eq(toxicKeywords.id, id));
}

// Compute site health score 0-100 based on uptime, TTFB, block rate, broken links
export async function computeSiteHealthScore(): Promise<{ score: number; grade: string; factors: Record<string, number> }> {
  const uptime = await getUptimePercent();
  const avgTtfb = await getAvgTtfb();
  const brokenCount = await getActiveBrokenLinksCount();
  const cached = await getLatestCFAnalyticsSnapshot(1);
  const blockRate = cached?.blockRate ?? 0;

  // Scoring: uptime 40pts, TTFB 30pts, block rate 20pts, broken links 10pts
  const uptimeScore = Math.round((uptime / 100) * 40);
  const ttfbScore = avgTtfb <= 500 ? 30 : avgTtfb <= 1000 ? 20 : avgTtfb <= 2000 ? 10 : 0;
  const blockScore = blockRate <= 5 ? 20 : blockRate <= 15 ? 15 : blockRate <= 25 ? 10 : 5;
  const brokenScore = brokenCount === 0 ? 10 : brokenCount <= 3 ? 7 : brokenCount <= 10 ? 4 : 0;
  // V7.0 Ghost Protocol: +5 bonus when WP DB avg latency is Excellent (< 100ms)
  const latestWpLatency = await getWpDbLatencyHistory(1);
  const wpDbExcellentBonus = latestWpLatency !== null && latestWpLatency.avgLatencyMs >= 0 && latestWpLatency.avgLatencyMs < 100 ? 5 : 0;
  const rawScore = uptimeScore + ttfbScore + blockScore + brokenScore + wpDbExcellentBonus;
  const score = Math.min(100, rawScore);
  const grade = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 45 ? "D" : "F";
  return { score, grade, factors: { uptimeScore, ttfbScore, blockScore, brokenScore, wpDbExcellentBonus } };
}

// ─── V5.1: TTFB Variance Monitor ─────────────────────────────────────────────
/**
 * Compute TTFB variance (max - min) across the last N checks.
 * Returns { variance, maxTtfb, minTtfb, avgTtfb, samples, isUnstable }
 * A variance > 50ms indicates unstable response times.
 */
export async function getTtfbVariance(limit = 20): Promise<{
  variance: number;
  maxTtfb: number;
  minTtfb: number;
  avgTtfb: number;
  samples: number;
  isUnstable: boolean;
}> {
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

// ─── V5.2: WordPress DB Latency History ──────────────────────────────────────

/**
 * Persist a WP DB latency reading to the log table.
 */
export async function saveWpDbLatency(latencyMs: number, status: string, httpCode: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(wpDbLatencyLog).values({ latencyMs, status, httpCode });
  // Prune old records — keep only last 200 rows
  await db.execute(
    sql`DELETE FROM wp_db_latency_log WHERE id NOT IN (SELECT id FROM (SELECT id FROM wp_db_latency_log ORDER BY created_at DESC LIMIT 200) t)`
  );
}

/**
 * Compute the 24h average WP DB latency from stored readings.
 * Returns null if no readings exist.
 */
export async function getWpDbLatencyHistory(hours = 24): Promise<{
  avgLatencyMs: number;
  samples: number;
  slowCount: number;
  criticalCount: number;
} | null> {
  const db = await getDb();
  if (!db) return null;
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const rows = await db
    .select()
    .from(wpDbLatencyLog)
    .where(gt(wpDbLatencyLog.createdAt, since))
    .orderBy(desc(wpDbLatencyLog.createdAt));
  if (!rows.length) return null;
  const avgLatencyMs = Math.round(rows.reduce((s, r) => s + r.latencyMs, 0) / rows.length);
  const slowCount = rows.filter((r) => r.status === "slow").length;
  const criticalCount = rows.filter((r) => r.status === "critical").length;
  return { avgLatencyMs, samples: rows.length, slowCount, criticalCount };
}

/**
 * V12.2: Return individual latency readings for sparkline chart (last N hours)
 * Returns array of { ts: number (epoch ms), latencyMs: number } sorted oldest-first
 */
export async function getWpDbLatencyTimeline(hours = 24): Promise<Array<{ ts: number; latencyMs: number; status: string }>> {
  const db = await getDb();
  if (!db) return [];
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const rows = await db
    .select()
    .from(wpDbLatencyLog)
    .where(gt(wpDbLatencyLog.createdAt, since))
    .orderBy(wpDbLatencyLog.createdAt); // oldest first for chart
  return rows.map((r) => ({ ts: new Date(r.createdAt).getTime(), latencyMs: r.latencyMs, status: r.status }));
}
export async function getLatencyTimeline(hours = 24) {
  try {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    return await db
      .select({
        ts: monitorChecks.createdAt,
        latencyMs: monitorChecks.ttfbMs,
        status: monitorChecks.cacheStatus,
      })
      .from(monitorChecks)
      .where(gte(monitorChecks.createdAt, since))
      .orderBy(asc(monitorChecks.createdAt))
      .limit(100);
  } catch {
    return [];
  }
}
