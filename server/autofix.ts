import { checkSite, SiteCheckResult } from "./monitoring";
import {
  sendTelegramMessage,
  buildAlertMessage,
  buildSmartDiagnosisAlert,
  buildPredictiveWarning,
  buildAdaptiveSecurityAlert,
  buildBlockRateAlert,
} from "./telegram";
import {
  saveMonitorCheck,
  saveAlert,
  isInCooldown,
  setCooldown,
  getUptimePercent,
  getAvgTtfb,
  getRecentChecks,
  getLatestCFAnalyticsSnapshot,
} from "./db";
import { ENV } from "./_core/env";
import {
  diagnoseError,
  detectTtfbTrend,
  setCFSecurityLevel,
  getCFSecurityLevel,
} from "./intelligence";

export interface AutoFixResult {
  check: SiteCheckResult;
  alertsFired: string[];
  autoFixApplied: boolean;
  uptimePercent: number;
  avgTtfbMs: number;
}

/**
 * Run a site check, detect issues, and send Telegram alerts.
 * Auto-purge is DISABLED — cache purge requires manual approval via the dashboard.
 * Called by the heartbeat handler every 5 minutes.
 *
 * Intelligence Suite:
 *  - Smart Diagnosis: root-cause classification for 404/5xx
 *  - Predictive TTFB: warn on 3 consecutive increases before threshold
 *  - Adaptive Security: auto-elevate CF Security Level on attack; revert after 30 min
 */
export async function runMonitorCycle(): Promise<AutoFixResult> {
  const check = await checkSite();

  // Save the check result to DB
  await saveMonitorCheck({
    httpCode: check.httpCode,
    ttfbMs: check.ttfbMs,
    cacheStatus: check.cacheStatus,
    cfRay: check.cfRay,
    isUp: check.isUp,
  });

  const alertsFired: string[] = [];

  // ─── Downtime / Error Alert (with Smart Diagnosis) ───────────────────────
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
        ttfbMs: check.ttfbMs,
      });
      alertsFired.push("downtime");
    }
  }

  // ─── High Latency Alert (with Smart Diagnosis) ───────────────────────────
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
        ttfbMs: check.ttfbMs,
      });
      alertsFired.push("high_latency");
    }
  }

  // ─── Predictive TTFB Warning ──────────────────────────────────────────────
  // Fires when TTFB is increasing over 3 consecutive checks but hasn't hit threshold yet
  if (check.isUp && check.ttfbMs < ENV.ttfbThresholdMs) {
    const recentChecks = await getRecentChecks(5); // newest-first
    if (detectTtfbTrend(recentChecks, 3)) {
      const inCooldown = await isInCooldown("predictive_ttfb");
      if (!inCooldown) {
        // Build trend array in chronological order (oldest → newest)
        const trendValues = [...recentChecks].reverse().slice(-3).map((c) => c.ttfbMs);
        const msg = buildPredictiveWarning(trendValues);
        await sendTelegramMessage(msg);
        await setCooldown("predictive_ttfb", 60); // 60-min cooldown to avoid spam
        await saveAlert({
          alertType: "high_latency",
          message: `Predictive warning: TTFB trending upward (${trendValues.join("ms → ")}ms). Not yet at threshold.`,
          autoFixApplied: false,
          pendingPurge: false,
          httpCode: check.httpCode,
          ttfbMs: check.ttfbMs,
        });
        alertsFired.push("predictive_ttfb");
      }
    }
  }

  // ─── Adaptive Security ────────────────────────────────────────────────────
  const isAttack = !check.isUp && check.httpCode >= 500;
  const isSevereLatency = check.isUp && check.ttfbMs > 4_000;

  if (isAttack || isSevereLatency) {
    const inCooldown = await isInCooldown("adaptive_security");
    if (!inCooldown) {
      // Choose level: under_attack for 5xx, high for severe latency
      const level = isAttack ? "under_attack" : "high";
      const reason = isAttack
        ? `HTTP ${check.httpCode} — server returning 5xx errors`
        : `TTFB ${check.ttfbMs}ms — severe performance degradation`;

      const result = await setCFSecurityLevel(level);
      if (result.success) {
        const msg = buildAdaptiveSecurityAlert("elevated", level, reason);
        await sendTelegramMessage(msg);
        // Cooldown = 30 min; heartbeat will check and revert after this window
        await setCooldown("adaptive_security", 30);
        await saveAlert({
          alertType: "security",
          message: `Adaptive Security: CF Security Level set to "${level}". Reason: ${reason}`,
          autoFixApplied: true,
          pendingPurge: false,
          httpCode: check.httpCode,
          ttfbMs: check.ttfbMs,
        });
        alertsFired.push("adaptive_security_elevated");
      }
    }
  } else {
    // Site is healthy — check if we need to revert the security level
    await maybeRevertSecurityLevel(alertsFired);
  }

  // ─── Block Rate Alert (> 20%) ──────────────────────────────────────────────
  // Reads from the latest CF analytics snapshot (saved at 04:00 AM)
  try {
    const snapshot = await getLatestCFAnalyticsSnapshot(1);
    if (snapshot && snapshot.blockRate >= 20) {
      const inCooldown = await isInCooldown("block_rate_high");
      if (!inCooldown) {
        const msg = buildBlockRateAlert(snapshot.blockRate, snapshot.threats, snapshot.totalRequests);
        await sendTelegramMessage(msg);
        await setCooldown("block_rate_high", 120); // 2-hour cooldown
        await saveAlert({
          alertType: "security",
          message: `Block Rate ${snapshot.blockRate}% exceeds 20% threshold. Threats: ${snapshot.threats}/${snapshot.totalRequests} requests.`,
          autoFixApplied: false,
          pendingPurge: false,
          httpCode: check.httpCode,
          ttfbMs: check.ttfbMs,
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

/**
 * If the site is now healthy and the adaptive_security cooldown has expired,
 * revert CF Security Level back to "medium".
 */
async function maybeRevertSecurityLevel(alertsFired: string[]): Promise<void> {
  // If still in cooldown, the elevated level is intentionally active — do nothing
  const stillElevated = await isInCooldown("adaptive_security");
  if (stillElevated) return;

  // Check if CF is currently elevated (not medium/low)
  const currentLevel = await getCFSecurityLevel();
  if (!currentLevel || currentLevel === "medium" || currentLevel === "low" || currentLevel === "essentially_off") {
    return; // Already at normal level
  }

  // Revert to medium
  const result = await setCFSecurityLevel("medium");
  if (result.success) {
    const msg = buildAdaptiveSecurityAlert("reverted", "medium");
    await sendTelegramMessage(msg);
    await saveAlert({
      alertType: "security",
      message: `Adaptive Security: CF Security Level reverted to "medium" — site stable for 30 minutes.`,
      autoFixApplied: true,
      pendingPurge: false,
      httpCode: 200,
      ttfbMs: 0,
    });
    alertsFired.push("adaptive_security_reverted");
  }
}
