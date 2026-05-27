/**
 * NCR Watchdog — Intelligence Suite
 *
 * Three features, all credit-efficient:
 *  1. Smart Diagnosis   — classify root cause for 404/5xx errors
 *  2. Predictive TTFB   — warn before threshold breach (3 consecutive increases)
 *  3. Adaptive Security — auto-set CF Security Level on attack; revert after 30 min
 */

import { ENV } from "./_core/env";
import type { SiteCheckResult } from "./monitoring";

// ─── 1. Smart Diagnosis ───────────────────────────────────────────────────────

export type DiagnosisCategory =
  | "database_failure"
  | "plugin_conflict"
  | "cf_edge_error"
  | "server_overload"
  | "timeout"
  | "unknown";

export interface DiagnosisResult {
  category: DiagnosisCategory;
  label: string;
  detail: string;
}

/**
 * Classify the root cause of a failed/degraded check.
 * Uses lightweight heuristics — no extra HTTP calls to keep it fast.
 */
export function diagnoseError(check: SiteCheckResult): DiagnosisResult {
  const { httpCode, ttfbMs, cacheStatus, error } = check;

  // Timeout / connection failure
  if (httpCode === 0 || cacheStatus === "TIMEOUT" || cacheStatus === "ERROR") {
    if (error?.toLowerCase().includes("timeout") || ttfbMs >= 14_000) {
      return {
        category: "timeout",
        label: "Connection Timeout",
        detail: "The server did not respond within 15s. Likely server overload or network issue.",
      };
    }
    return {
      category: "server_overload",
      label: "Server Unreachable",
      detail: `Connection failed (${error ?? "unknown error"}). Check hosting/server status.`,
    };
  }

  // Cloudflare edge errors (52x, 53x, 54x, 10xx)
  if ([520, 521, 522, 523, 524, 525, 526, 527, 530].includes(httpCode)) {
    return {
      category: "cf_edge_error",
      label: "Cloudflare Edge Error",
      detail: `HTTP ${httpCode} — CF cannot reach the origin server. Check if Apache/Nginx is running.`,
    };
  }

  // WordPress database errors typically return 500 or 503 with very fast TTFB
  // (WP outputs the DB error page immediately without rendering)
  if ((httpCode === 500 || httpCode === 503) && ttfbMs < 800) {
    return {
      category: "database_failure",
      label: "Possible Database Failure",
      detail: `HTTP ${httpCode} with fast TTFB (${ttfbMs}ms) — WP may be returning a DB connection error page.`,
    };
  }

  // Generic 5xx — slow response suggests plugin/theme PHP fatal
  if (httpCode >= 500 && httpCode < 600) {
    return {
      category: "plugin_conflict",
      label: "PHP Fatal / Plugin Conflict",
      detail: `HTTP ${httpCode} with TTFB ${ttfbMs}ms — likely a PHP fatal error from a plugin or theme update.`,
    };
  }

  // 404 on homepage
  if (httpCode === 404) {
    return {
      category: "plugin_conflict",
      label: "Homepage 404",
      detail: "Homepage returned 404 — WordPress rewrite rules may be broken. Try flushing permalinks.",
    };
  }

  // High TTFB but site is "up"
  if (ttfbMs >= 4_000) {
    return {
      category: "server_overload",
      label: "Server Overload / Slow PHP",
      detail: `TTFB ${ttfbMs}ms — server is responding but very slowly. Possible traffic spike or heavy plugin.`,
    };
  }

  return {
    category: "unknown",
    label: "Unknown Issue",
    detail: `HTTP ${httpCode}, TTFB ${ttfbMs}ms. Manual investigation required.`,
  };
}

// ─── 2. Predictive TTFB Alerting ─────────────────────────────────────────────

/**
 * Returns true if the last N checks show a strictly increasing TTFB trend.
 * Requires at least `window` checks.
 */
export function detectTtfbTrend(
  recentChecks: { ttfbMs: number }[],
  window = 3
): boolean {
  // recentChecks is ordered newest-first (DESC), so reverse for chronological order
  const ordered = [...recentChecks].reverse();
  if (ordered.length < window) return false;
  const last = ordered.slice(-window);
  for (let i = 1; i < last.length; i++) {
    if (last[i].ttfbMs <= last[i - 1].ttfbMs) return false;
  }
  return true;
}

// ─── 3. Adaptive Security ─────────────────────────────────────────────────────

export type CFSecurityLevel = "essentially_off" | "low" | "medium" | "high" | "under_attack";

export interface CFSecurityResult {
  success: boolean;
  message: string;
}

/**
 * Set the Cloudflare Security Level for the zone.
 */
export async function setCFSecurityLevel(level: CFSecurityLevel): Promise<CFSecurityResult> {
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
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ value: level }),
      }
    );
    const data = (await res.json()) as { success: boolean; errors?: { message: string }[] };
    if (data.success) {
      return { success: true, message: `CF Security Level set to "${level}"` };
    }
    const errMsg = data.errors?.map((e) => e.message).join(", ") || "Unknown CF error";
    return { success: false, message: errMsg };
  } catch (err) {
    return { success: false, message: `CF API error: ${(err as Error).message}` };
  }
}

/**
 * Get the current Cloudflare Security Level for the zone.
 */
export async function getCFSecurityLevel(): Promise<CFSecurityLevel | null> {
  if (!ENV.cfApiToken || !ENV.cfZoneId) return null;
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${ENV.cfZoneId}/settings/security_level`,
      {
        headers: { Authorization: `Bearer ${ENV.cfApiToken}` },
      }
    );
    const data = (await res.json()) as { success: boolean; result?: { value: string } };
    if (data.success && data.result) return data.result.value as CFSecurityLevel;
    return null;
  } catch {
    return null;
  }
}
