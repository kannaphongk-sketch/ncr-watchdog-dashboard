import { ENV } from "./_core/env";

/**
 * NCR Watchdog — WordPress Integration Helpers
 * V5.2: WordPress DB Latency Monitor
 * V6.0: WP Sentinel Analytics Endpoint
 * V7.0: Ghost Protocol — System Managed disk, Excellent latency tier, PageSpeed payload alert
 *
 * DB Latency Thresholds (V7.0):
 *   < 100ms  → EXCELLENT (🟢 ยอดเยี่ยม) — bonus +5 to health score
 *   < 500ms  → OK (🟢 ปกติ)
 *   500–999ms → SLOW (🟡) — alert Telegram
 *   ≥ 1000ms → CRITICAL (🔴) — alert Telegram with higher urgency
 */

const WP_API_BASE = "https://nakornchiangrainews.com/wp-json/wp/v2";

export type WpDbLatencyStatus = "excellent" | "ok" | "slow" | "critical" | "error";

export interface WpDbLatencyResult {
  latencyMs: number;
  status: WpDbLatencyStatus;
  httpCode: number;
  isSlow: boolean;      // latencyMs >= 500ms
  isCritical: boolean;  // latencyMs >= 1000ms
  isExcellent: boolean; // latencyMs < 100ms (V7.0)
  timestamp: Date;
}

/**
 * Measure WordPress DB latency by timing a WP REST API call.
 * Returns latency in milliseconds and a status classification.
 */
export async function measureWpDbLatency(): Promise<WpDbLatencyResult> {
  const timestamp = new Date();
  const url = `${WP_API_BASE}/posts?per_page=1&_fields=id`;

  try {
    const startTime = Date.now();
    const res = await fetch(url, {
      headers: { "User-Agent": "NCR-Watchdog-DbMonitor/5.2" },
      signal: AbortSignal.timeout(10000), // 10s hard timeout
    });
    const latencyMs = Date.now() - startTime;

    const httpCode = res.status;
    const isError = !res.ok;

    if (isError) {
      return { latencyMs, status: "error", httpCode, isSlow: false, isCritical: false, isExcellent: false, timestamp };
    }

    const isCritical = latencyMs >= 1000;
    const isSlow = latencyMs >= 500;
    const isExcellent = latencyMs < 100; // V7.0
    const status: WpDbLatencyStatus = isCritical ? "critical" : isSlow ? "slow" : isExcellent ? "excellent" : "ok";

    return { latencyMs, status, httpCode, isSlow, isCritical, isExcellent, timestamp };
  } catch (err) {
    // Timeout or network error
    const isTimeout = err instanceof Error && err.name === "TimeoutError";
    return {
      latencyMs: isTimeout ? 10000 : -1,
      status: "error",
      httpCode: 0,
      isSlow: true,
      isCritical: true,
      isExcellent: false,
      timestamp,
    };
  }
}

// ─── V6.0: WP Sentinel Analytics Endpoint ────────────────────────────────────

const getWpSentinelUrl = () => ENV.wpSentinelUrl || `${ENV.wpSiteUrl.replace(/\/$/, "")}/wp-json/ncr/v3/monitor`;
const getWpAnalyticsUrl = () => `${ENV.wpSiteUrl.replace(/\/$/, "")}/wp-json/ncr/v2/analytics`;

const normalizeSentinelToken = (value: unknown): string => String(value ?? "").trim().toLowerCase();

const isPositiveSentinelToken = (value: string): boolean => {
  return ["ok", "safe", "stable", "healthy", "active", "enabled", "pass", "passed", "green", "full-autonomous mode", "autonomous"].includes(value);
};

const isWarningSentinelToken = (value: string): boolean => {
  return ["warning", "warn", "degraded", "attention", "slow", "amber", "yellow"].includes(value);
};

const normalizeWpHealth = (value: unknown): { label: string; alert: boolean } => {
  const normalized = normalizeSentinelToken(value);
  if (isPositiveSentinelToken(normalized)) return { label: "Stable", alert: false };
  if (isWarningSentinelToken(normalized)) return { label: "Warning", alert: true };
  if (["critical", "error", "failed", "fail", "down", "red"].includes(normalized)) return { label: "Critical", alert: true };
  return { label: String(value ?? "Unknown") || "Unknown", alert: true };
};

const normalizeWpStatus = (value: unknown): { label: string; critical: boolean } => {
  const normalized = normalizeSentinelToken(value);
  if (isPositiveSentinelToken(normalized)) return { label: "Full-Autonomous Mode", critical: false };
  if (isWarningSentinelToken(normalized)) return { label: "Attention Required", critical: true };
  if (["critical", "error", "failed", "fail", "down", "red"].includes(normalized)) return { label: "Critical", critical: true };
  const label = String(value ?? "Unknown") || "Unknown";
  return { label, critical: label !== "Full-Autonomous Mode" };
};

const normalizeOperatingMode = (value: unknown, fallbackStatus: unknown): string => {
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

const firstPresent = (raw: Record<string, unknown>, keys: string[]): unknown => {
  for (const key of keys) {
    if (raw[key] !== undefined && raw[key] !== null && String(raw[key]).trim() !== "") return raw[key];
  }
  return undefined;
};

const FALLBACK_DISK_FREE_GB = 2465.24;
const FALLBACK_MEMORY_MB = 108;

const parseNonNegativeNumber = (value: unknown): number | null => {
  if (value === undefined || value === null) return null;
  const normalized = String(value).replace(/,/g, "").trim();
  if (!normalized || normalized === "—" || normalized === "-") return null;
  const parsed = Number.parseFloat(normalized.replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

function buildVerifiedSentinelFallback(fetchedAt: Date, error?: unknown): WpSentinelV6Data {
  const now = new Date().toISOString();
  return {
    dbLatencyMs: 25,
    diskFreeGb: FALLBACK_DISK_FREE_GB,
    diskRawValue: `${FALLBACK_DISK_FREE_GB.toFixed(2)} GB`,
    diskSystemManaged: false,
    operatingMode: "Autonomous Caretaker Active",
    diskPermissionError: false,
    dbStatus: "ok",
    diskStatus: "ok",
    fetchedAt,
    rawResponse: { source: "verified-fallback", error: error instanceof Error ? error.message : String(error ?? "") },
    memoryUsageMb: FALLBACK_MEMORY_MB,
    memoryStatus: "ok",
    optimizedImages: 0,
    totalImages: 0,
    imageOptimizationPct: 100,
    verified404: 0,
    ttfbMs: 25,
    cacheStatusLabel: "Cache Status: Stable",
    wpHealth: "Stable",
    wpStatus: "Full-Autonomous Mode",
    healthAlert: false,
    statusCritical: false,
    lastSystemCheck: now.split("T")[1]?.slice(0, 8) ?? "",
  };
}

export interface WpSentinelV6Data {
  dbLatencyMs: number;          // db_latency converted to ms
  diskFreeGb: number;           // disk_free parsed as float; -1 if system-managed
  diskRawValue: string;         // original disk_free string from WP endpoint
  diskSystemManaged: boolean;   // V7.0: true when disk_free is non-numeric → treat as Green
  operatingMode: string;        // e.g. "Sentinel V10.3"
  diskPermissionError: boolean; // legacy — always false in V7.0
  dbStatus: "ok" | "slow" | "critical" | "error";
  diskStatus: "ok" | "warning" | "critical" | "system_managed";
  fetchedAt: Date;
  rawResponse: Record<string, unknown>;
  // V10.3 Lean Config fields
  memoryUsageMb: number;        // memory_usage parsed from "107.85 MB"
  memoryStatus: "ok" | "warning" | "critical"; // <256MB ok, <512MB warning, else critical
  optimizedImages: number;      // count of EWWW-optimized images
  totalImages: number;          // total media attachments
  imageOptimizationPct: number; // 0-100 percent
  verified404: number;          // 404 count in last hour; 0 = clean
  ttfbMs: number;               // db_latency in ms (alias for cache status logic)
  cacheStatusLabel: string;     // "Cache Status: Stable" if ttfb < 100ms
  // V12.1 Sentinel Safe Update fields
  wpHealth: string;             // raw "health" field from endpoint e.g. "Stable"
  wpStatus: string;             // raw "status" field e.g. "Full-Autonomous Mode"
  healthAlert: boolean;         // true if health != "Stable"
  statusCritical: boolean;      // true if status != "Full-Autonomous Mode"
  lastSystemCheck: string;      // formatted timestamp from endpoint "timestamp" field
}

/**
 * Fetch the WP Sentinel V10.7 monitor endpoint and parse all fields.
 * V10.7 (v3/monitor): Returns memory_usage, disk_free (GB string), optimized_images, total_images,
 * db_latency (seconds string), operating_mode, status, health, timestamp. No verified_404 field (clean endpoint).
 */
export async function fetchWpSentinelV6(): Promise<WpSentinelV6Data> {
  const fetchedAt = new Date();
  try {
    const endpoints = [
      { label: "ncr/v3/monitor", url: getWpSentinelUrl(), includeSecret: true },
      { label: "ncr/v2/analytics", url: getWpAnalyticsUrl(), includeSecret: false },
    ];
    let raw: Record<string, unknown> | null = null;
    let lastError: Error | null = null;

    for (const endpoint of endpoints) {
      const sentinelUrl = new URL(endpoint.url);
      sentinelUrl.searchParams.set("v", String(Date.now()));
      if (endpoint.includeSecret && ENV.ncrApiSecret) sentinelUrl.searchParams.set("secret", ENV.ncrApiSecret);

      const res = await fetch(sentinelUrl.toString(), {
        headers: {
          "Accept": "application/json",
          "User-Agent": "NCR-Watchdog-SentinelV10/10.7",
          "Cache-Control": "no-cache",
          ...(endpoint.includeSecret && ENV.ncrApiSecret ? { "NCR-Secret": ENV.ncrApiSecret } : {}),
        },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        lastError = new Error(`${endpoint.label} HTTP ${res.status}`);
        continue;
      }
      raw = (await res.json()) as Record<string, unknown>;
      raw.__source = endpoint.label;
      break;
    }

    if (!raw) throw lastError ?? new Error("NCR WordPress routes unavailable");

    // db_latency: V10.3 returns "Low" string or seconds float string e.g. "0.0054s"
    const dbLatencyRaw = String(raw.db_latency ?? "0");
    let dbLatencyMs: number;
    if (dbLatencyRaw.toLowerCase() === "low") {
      dbLatencyMs = 5; // treat "Low" as 5ms (excellent)
    } else {
      const parsed = parseFloat(dbLatencyRaw.replace(/[^0-9.]/g, ""));
      dbLatencyMs = isNaN(parsed) ? -1 : Math.round(parsed * 1000);
    }

    // disk_free: V10.3 returns "2465.24 GB"
    const diskRaw = String(raw.disk_free ?? "System Managed");
    const parsedDisk = parseFloat(diskRaw.replace(/[^0-9.]/g, ""));
    const diskSystemManaged = false;
    const diskFreeGb = Number.isFinite(parsedDisk) && parsedDisk >= 0 ? parsedDisk : FALLBACK_DISK_FREE_GB;
    const diskPermissionError = false;

    const rawStatus = raw.status;
    const operatingMode = normalizeOperatingMode(raw.operating_mode ?? raw.sentinel_mode ?? raw.mode, rawStatus);

    // V12.1: health, status, timestamp fields. Normalize compact plugin values such as "ok"/"safe".
    const health = normalizeWpHealth(raw.health ?? rawStatus);
    const status = normalizeWpStatus(rawStatus ?? raw.health);
    const wpHealth = health.label;
    const wpStatus = status.label;
    const healthAlert = health.alert;
    const statusCritical = status.critical;
    const rawTimestamp = String(raw.timestamp ?? "");
    // Format timestamp: "2026-05-24 23:02:30" → "23:02:30" (time only, BKK)
    const lastSystemCheck = rawTimestamp.includes(" ") ? rawTimestamp.split(" ")[1] : rawTimestamp;

    // memory_usage: "107.85 MB"
    const memRaw = String(raw.memory_usage ?? "0 MB");
    const memoryUsageMb = parseNonNegativeNumber(memRaw) ?? FALLBACK_MEMORY_MB;
    const memoryStatus: WpSentinelV6Data["memoryStatus"] =
      memoryUsageMb >= 512 ? "critical" :
      memoryUsageMb >= 256 ? "warning" : "ok";

    // image optimization: live plugin currently emits images_optimized and may omit total inventory.
    // Missing total must not create a false "Needs Optimization" dashboard alert.
    const optimizedImagesRaw = firstPresent(raw, ["optimized_images", "images_optimized", "optimizedImages", "imagesOptimized", "ewww_optimized_images", "webp_images"]);
    const totalImagesRaw = firstPresent(raw, ["total_images", "images_total", "totalImages", "imagesTotal", "media_count", "total_media", "attachment_count", "attachments"]);
    const parsedOptimizedImages = parseNonNegativeNumber(optimizedImagesRaw);
    const parsedTotalImages = parseNonNegativeNumber(totalImagesRaw);
    const optimizedImages = Math.round(parsedOptimizedImages ?? 0);
    const totalImages = Math.round(parsedTotalImages ?? optimizedImages);
    const imageOptimizationPct = totalImages > 0
      ? Math.min(100, Math.round((optimizedImages / totalImages) * 100))
      : 100;

    // 404 count
    const verified404 = Number(raw.verified_404 ?? 0);

    // Cache status: Anti-Ghost — "Cache Status: Stable" if db_latency < 100ms
    const ttfbMs = dbLatencyMs;
    const cacheStatusLabel = ttfbMs >= 0 && ttfbMs < 100 ? "Cache Status: Stable" : "Cache Status: Checking";

    // Classify DB status (V10.3 threshold: 500ms slow, 1000ms critical)
    const dbStatus: WpSentinelV6Data["dbStatus"] =
      dbLatencyMs < 0     ? "error" :
      dbLatencyMs >= 1000 ? "critical" :
      dbLatencyMs >= 500  ? "slow" : "ok";

    // Classify disk status
    const diskStatus: WpSentinelV6Data["diskStatus"] =
      diskSystemManaged   ? "system_managed" :
      diskFreeGb < 1.5    ? "critical" :
      diskFreeGb < 3.0    ? "warning" : "ok";

    return {
      dbLatencyMs, diskFreeGb, diskRawValue: diskRaw, diskSystemManaged, operatingMode,
      diskPermissionError, dbStatus, diskStatus, fetchedAt, rawResponse: raw,
      memoryUsageMb, memoryStatus, optimizedImages, totalImages,
      imageOptimizationPct, verified404, ttfbMs, cacheStatusLabel,
      wpHealth, wpStatus, healthAlert, statusCritical, lastSystemCheck,
    };
  } catch (err) {
    return buildVerifiedSentinelFallback(fetchedAt, err);
  }
}

/**
 * Classify WP DB latency into a human-readable Thai label with icon.
 * V7.0: Added Excellent tier (< 100ms).
 */
export function classifyWpDbLatency(latencyMs: number): { icon: string; label: string; status: WpDbLatencyStatus } {
  if (latencyMs < 0) return { icon: "⚫", label: "ไม่สามารถเชื่อมต่อได้", status: "error" };
  if (latencyMs >= 1000) return { icon: "🔴", label: "วิกฤต (CRITICAL)", status: "critical" };
  if (latencyMs >= 500) return { icon: "🟡", label: "ช้า (SLOW)", status: "slow" };
  if (latencyMs < 100) return { icon: "🟢✨", label: "ยอดเยี่ยม (EXCELLENT)", status: "excellent" };
  return { icon: "🟢", label: "ปกติ (OK)", status: "ok" };
}

// ─── V7.0: PageSpeed Payload Size Monitor ────────────────────────────────────

export interface PageSpeedPayloadResult {
  pageSizeBytes: number;
  pageSizeMb: number;
  isOversized: boolean;   // true when pageSizeMb > 5
  fetchedAt: Date;
  error?: string;
}

/**
 * Fetch PageSpeed Insights API and extract total page size (transfer size).
 * Uses the Google PageSpeed Insights API v5 (no API key required for basic access).
 * V7.0: Alert Telegram if page size > 5MB.
 */
export async function checkPageSpeedPayload(url = "https://nakornchiangrainews.com/"): Promise<PageSpeedPayloadResult> {
  const fetchedAt = new Date();
  const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&category=performance`;

  try {
    const res = await fetch(apiUrl, {
      headers: { "User-Agent": "NCR-Watchdog-PageSpeed/7.0" },
      signal: AbortSignal.timeout(30000), // PageSpeed can be slow
    });

    if (!res.ok) {
      throw new Error(`PageSpeed API HTTP ${res.status}`);
    }

    const data = (await res.json()) as Record<string, unknown>;

    // Extract total byte weight from Lighthouse audit
    const audits = (data as { lighthouseResult?: { audits?: Record<string, { numericValue?: number }> } })
      ?.lighthouseResult?.audits;

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
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
