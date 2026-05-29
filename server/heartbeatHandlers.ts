import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { FACEBOOK_PAUSED } from "../shared/const";
import { runMonitorCycle } from "./autofix";
import { sendTelegramMessage, buildDailyReport, buildWeeklyReport, buildMonthlyReport, buildCritical404Alert, buildHostatomDownAlert, buildHostatomRecoveredAlert, buildAutoBanAlert, buildTopPostsReport, buildArticleSpikeAlert, buildBruteForceLoginAlert } from "./telegram";
import { getRecentChecks, getUptimePercent, getAvgTtfb, getRecentAlerts, upsertSchedulerState, upsertBrokenLinks, getCriticalBrokenLinks, CRITICAL_URLS, isInCooldown, setCooldown, getTopBrokenLinks, saveCacheDiagnostic, getRecentCacheDiagnostics, upsertBannedIP, isBannedIP, saveCFAnalyticsSnapshot, getLatestCFAnalyticsSnapshot } from "./db";
import { analyzeCacheDiagnostic } from "./cacheDiagnostic";
import { getCFAnalytics, getTop404IPsLast5Min, blockIPInCFWAF, getTopPosts, getTrendingTrafficSpikes, getBruteForceLoginAttempts } from "./cloudflare";
import { checkSite } from "./monitoring";

/**
 * Build report data — reads CF metrics from the DB cache (saved at 04:00 AM).
 * Falls back to live CF API only if no cache row exists yet.
 */
async function buildReportData(windowDays = 1) {
  const checks = await getRecentChecks(1);
  const latestCheck = checks[0];
  const uptimePercent = await getUptimePercent();
  const avgTtfbMs = await getAvgTtfb();
  const alerts = await getRecentAlerts(10);

  // Prefer DB cache; fall back to live CF API
  const cached = await getLatestCFAnalyticsSnapshot(windowDays);
  let cfData;
  if (cached) {
    const countryTraffic = cached.countryJson
      ? (JSON.parse(cached.countryJson) as { country: string; requests: number }[])
      : [];
    cfData = {
      cacheHitRate: cached.cacheHitRate,
      totalRequests: cached.totalRequests,
      cachedRequests: cached.cachedRequests,
      bandwidth: cached.bandwidth,
      threats: cached.threats,
      visits: cached.visits,
      pageViews: cached.pageViews,
      count404: cached.count404,
      top404Urls: [] as { url: string; hits: number }[],
      countryTraffic,
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
    countryTraffic: cfData.countryTraffic,
  };
}

async function buildExtendedReportData(windowDays = 7) {
  const allChecks = await getRecentChecks(100);
  const checksTotal = allChecks.length;
  const checksUp = allChecks.filter((c) => c.isUp).length;
  const base = await buildReportData(windowDays);
  return { ...base, checksTotal, checksUp };
}

/**
 * Heartbeat: CF Analytics snapshot at 04:00 BKK (21:00 UTC prev day)
 * Fetches CF data for 1-day, 7-day, and 30-day windows and stores in DB.
 * All subsequent reports read from this cache instead of calling CF API.
 */
export async function handleCFSnapshot(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });

    const windows = [1, 7, 30];
    const results: Record<number, string> = {};

    for (const days of windows) {
      try {
        // Fetch CF analytics for this window
        const cfData = await getCFAnalytics(days);
        // Fetch top posts for this window
        const topPosts = await getTopPosts(days, 10);
        const blockRate =
          cfData.totalRequests > 0
            ? Math.round((cfData.threats / cfData.totalRequests) * 100)
            : 0;

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
          windowDays: days,
        });
        results[days] = "ok";
      } catch (e) {
        console.warn(`[cf-snapshot] window=${days}d failed:`, e);
        results[days] = "error";
      }
    }

    await upsertSchedulerState("cf-snapshot", {
      lastRunAt: new Date(),
      lastStatus: Object.values(results).every((r) => r === "ok") ? "ok" : "partial",
    });

    res.json({ ok: true, windows: results });
  } catch (err) {
    console.error("[heartbeat:cf-snapshot]", err);
    res.status(500).json({ error: (err as Error).message });
  }
}

/**
 * Heartbeat: run every 5 minutes — monitoring check + auto-fix
 */
export async function handleMonitorCheck(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });

    const result = await runMonitorCycle();

    // Persist cache diagnostic from the latest check result (non-blocking)
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

    // Fetch CF analytics and persist top-10 404 URLs to broken_links table
    const cfData = await getCFAnalytics();
    if (cfData.top404Urls.length > 0) {
      await upsertBrokenLinks(cfData.top404Urls);

      // Fire critical alert if any critical page appears in the 404 list
      // Uses a 60-minute cooldown to avoid spamming alerts on every 5-min cycle
      const criticalHits = cfData.top404Urls.filter((entry) =>
        CRITICAL_URLS.some((p) => entry.url === p || entry.url.startsWith(p + "?"))
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

    // ─── Protocol 1: Auto-Ban (Rate Limit Defense) ──────────────────────────────
    // Detect IPs with >100 404 errors in 5 minutes → activate Under Attack mode + ban
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

    // ─── V8.0: Advanced Cloudflare Traffic Spike + Brute Force Alerts ─────────────
    try {
      const spikeResult = await getTrendingTrafficSpikes(500);
      if (spikeResult.spikes.length > 0 && !(await isInCooldown("article_spike_1h"))) {
        await sendTelegramMessage(buildArticleSpikeAlert(spikeResult.spikes));
        await setCooldown("article_spike_1h", 60);
      }
    } catch (e) {
      console.warn("[advanced-article-spike]", e);
    }

    try {
      const bruteForce = await getBruteForceLoginAttempts(20);
      if (bruteForce.offenders.length > 0 && !(await isInCooldown("bruteforce_login_15m"))) {
        await sendTelegramMessage(buildBruteForceLoginAlert(bruteForce.offenders));
        await setCooldown("bruteforce_login_15m", 30);
      }
    } catch (e) {
      console.warn("[advanced-bruteforce-login]", e);
    }

    // ─── Protocol 2: Uptime / Stale Cache Monitor ────────────────────────────────
    // Detect 502/503/504 → send ONE alert per incident (cooldown key: hostatom_down)
    // Detect recovery (200 after downtime) → send RECOVERED alert
    try {
      const httpCode = result.check.httpCode;
      const isHostatomDown = [502, 503, 504].includes(httpCode);
      const wasDown = await isInCooldown("hostatom_down");

      if (isHostatomDown && !wasDown) {
        // New downtime incident — send alert and set cooldown
        await sendTelegramMessage(buildHostatomDownAlert(httpCode));
        await setCooldown("hostatom_down", 60); // 60-min cooldown = one alert per incident
      } else if (!isHostatomDown && wasDown) {
        // Recovery detected — origin is back up after a downtime incident
        await sendTelegramMessage(buildHostatomRecoveredAlert());
        // Clear the cooldown so the next downtime triggers a fresh alert
        await setCooldown("hostatom_down", 0);
      }
    } catch (e) {
      console.warn("[protocol2-uptime]", e);
    }

    // BYPASS streak detection: if last 3 checks are all BYPASS/MISS/EXPIRED, send alert
    try {
      const recentDiags = await getRecentCacheDiagnostics(3);
      const BYPASS_STATUSES = ["BYPASS", "MISS", "EXPIRED"];
      if (
        recentDiags.length === 3 &&
        recentDiags.every((d) => BYPASS_STATUSES.includes(d.cfCacheStatus)) &&
        !(await isInCooldown("cache_bypass_streak"))
      ) {
        const latest = recentDiags[0];
        const { buildCacheBypassAlert } = await import("./telegram");
        await sendTelegramMessage(buildCacheBypassAlert(
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
      lastRunAt: new Date(),
      lastStatus: result.check.isUp ? "ok" : "alert",
    });

    res.json({ ok: true, httpCode: result.check.httpCode, ttfbMs: result.check.ttfbMs, alerts: result.alertsFired });
  } catch (err) {
    console.error("[heartbeat:monitor-check]", err);
    res.status(500).json({ error: (err as Error).message });
  }
}

/**
 * V12.1: Shared executive brief logic — callable from any handler
 */
async function runExecutiveBriefLogic(): Promise<void> {
  const { computeSiteHealthScore, getRecentActionLog, getUptimePercent, getAvgTtfb, getActiveBrokenLinksCount, getTtfbVariance, getWpDbLatencyHistory } = await import("./db");
  const { getCacheEfficiencyData } = await import("./cloudflare");
  const { measureWpDbLatency, classifyWpDbLatency, fetchWpSentinelV6 } = await import("./wordpress");

  const [healthResult, actionLogEntries, cachedResult, cacheEffResult, uptimeResult, avgTtfbResult, brokenCountResult, varianceResult, wpDbResult, wpDbHistoryResult, sentinelV6Result] = await Promise.allSettled([
    computeSiteHealthScore(),
    getRecentActionLog(10),
    getLatestCFAnalyticsSnapshot(1),
    getCacheEfficiencyData(),
    getUptimePercent(),
    getAvgTtfb(),
    getActiveBrokenLinksCount(),
    getTtfbVariance(20),
    measureWpDbLatency(),
    getWpDbLatencyHistory(24),
    fetchWpSentinelV6(),
  ]);

  const health = healthResult.status === "fulfilled" ? healthResult.value : { score: 0, grade: "?", factors: {} as Record<string, number> };
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

  const gradeEmoji = health.grade === "A" ? "🟢" : health.grade === "B" ? "🟡" : health.grade === "C" ? "🟠" : "🔴";

  let pageSpeedSizeMb: number | null = null;
  try {
    const { checkPageSpeedPayload } = await import("./wordpress");
    const ps = await checkPageSpeedPayload();
    if (!ps.error) pageSpeedSizeMb = ps.pageSizeMb;
  } catch { /* non-blocking */ }

  const autoFixCount = actions.filter(a => a.actionType?.toLowerCase().includes("fix") || a.actionType?.toLowerCase().includes("purge") || a.actionType?.toLowerCase().includes("block")).length;

  const uptimeDisplay = uptimePct !== null ? `${uptimePct.toFixed(1)}%` : "N/A";
  const ttfbDisplay = avgTtfbMs !== null ? `${avgTtfbMs}ms` : "N/A";
  const brokenDisplay = brokenCount !== null ? `${brokenCount} ลิงก์` : "N/A";
  const blockDisplay = cf ? `${cf.blockRate}%` : "N/A";
  const overallStatus = health.score >= 80 ? "Healthy 🟢" : health.score >= 60 ? "Warning 🟡" : "Critical 🔴";
  const psDisplay = pageSpeedSizeMb !== null ? `${pageSpeedSizeMb.toFixed(2)} MB${pageSpeedSizeMb > 5 ? " ⚠️ >5MB" : " ✅"}` : "N/A";
  const wpDbAvgDisplay = wpDbHistory ? `${wpDbHistory.avgLatencyMs}ms` : (wpDb ? `${wpDb.latencyMs}ms` : "N/A");
  const bangkokDateShort = new Date().toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Bangkok" });

  let msg = `📊 <b>NCR Morning Brief | ${bangkokDateShort}</b>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `• <b>Overall Health:</b> ${overallStatus} (${health.score}/100)\n`;
  msg += `• <b>PageSpeed (Mobile):</b> ${psDisplay} (Goal: 90+)\n`;
  msg += `• <b>System Pulse (Avg):</b> ${wpDbAvgDisplay} (Goal: <0.1s)\n`;
  msg += `• <b>Auto-Fixes:</b> ${autoFixCount} cleanups in 24h\n`;
  msg += `• <b>Uptime:</b> ${uptimeDisplay}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `\n${gradeEmoji} <b>Health Score: ${health.score}/100 (Grade ${health.grade})</b>\n`;
  msg += `• ⚡ Avg TTFB: ${ttfbDisplay} (${health.factors.ttfbScore ?? 0}/30 pts)\n`;
  msg += `• 🛡️ Security Block Rate: ${blockDisplay} (${health.factors.blockScore ?? 0}/20 pts)\n`;
  msg += `• 🔗 Broken Links: ${brokenDisplay} (${health.factors.brokenScore ?? 0}/10 pts)\n`;

  if (cf) {
    msg += `\n📊 <b>Resource Efficiency (24h):</b>\n`;
    msg += `• Requests: ${cf.totalRequests.toLocaleString()} | Cache Hit: ${cf.cacheHitRate}%\n`;
    msg += `• Visitors: ${cf.visits.toLocaleString()} | Page Views: ${cf.pageViews.toLocaleString()}\n`;
    msg += `• Threats Blocked: ${cf.threats.toLocaleString()} (${cf.blockRate}%)\n`;
  }

  if (cacheEff) {
    const adjPct = (cacheEff.adjustedCacheHitRate * 100).toFixed(1);
    const rawPct = cf ? `${cf.cacheHitRate}%` : "N/A";
    const targetIcon = cacheEff.meetsTarget ? "✅" : "⚠️";
    const trend = cf ? (() => {
      const diff = (cacheEff.adjustedCacheHitRate * 100) - cf.cacheHitRate;
      if (Math.abs(diff) < 1) return "➡️ เสถียร";
      return diff > 0 ? `⬆️ +${diff.toFixed(1)}% vs 24h` : `⬇️ ${diff.toFixed(1)}% vs 24h`;
    })() : "";
    msg += `\n${targetIcon} <b>Cache Efficiency:</b>\n`;
    msg += `• 24h Hit Rate: ${rawPct} | 6h Adjusted: ${adjPct}% ${trend}\n`;
    msg += `• สถานะ: ${cacheEff.meetsTarget ? "ผ่านเกณฑ์ (>80%)" : "⚠️ ต่ำกว่าเกณฑ์ 80%"}\n`;
    if (cacheEff.fbclidRequests > 0) msg += `• fbclid MISS Requests: ${cacheEff.fbclidRequests.toLocaleString()}\n`;
  }

  if (wpDb) {
    const { icon: dbIcon, label: dbLabel } = classifyWpDbLatency(wpDb.latencyMs);
    msg += `\n${dbIcon} <b>WordPress DB Latency:</b>\n`;
    msg += `• เวลาตอบสนองตอนนี้: <b>${wpDb.latencyMs}ms</b> — ${dbLabel}\n`;
    if (wpDbHistory) msg += `• 24h Avg: <b>${wpDbHistory.avgLatencyMs}ms</b> (${wpDbHistory.samples} samples, slow: ${wpDbHistory.slowCount}, critical: ${wpDbHistory.criticalCount})\n`;
    if (wpDb.isSlow) {
      const advice = wpDb.isCritical ? "⚠️ ควรตรวจสอบ MySQL/MariaDB และ WP Cron ทันที" : "💡 แนะนำให้พักการรันรูปภาพ (EWWW) ชั่วคราว";
      msg += `• ${advice}\n`;
    }
  }

  if (ttfbVariance && ttfbVariance.samples >= 2) {
    const varianceIcon = ttfbVariance.isUnstable ? "🟠" : "🟢";
    const varianceLabel = ttfbVariance.isUnstable ? "ไม่เสถียร (ควรตรวจ Cache Rules)" : "เสถียร";
    msg += `\n${varianceIcon} <b>TTFB Stability (${ttfbVariance.samples} checks):</b>\n`;
    msg += `• Variance: ${ttfbVariance.variance}ms | Min: ${ttfbVariance.minTtfb}ms | Max: ${ttfbVariance.maxTtfb}ms\n`;
    msg += `• สถานะ: ${varianceLabel}\n`;
  }

  if (sentinelV6) {
    const diskIcon = sentinelV6.diskStatus === "critical" ? "🔴" : sentinelV6.diskStatus === "warning" ? "🟡" : "🟢";
    const diskDisplay = sentinelV6.diskSystemManaged ? "System Managed (Green)" : sentinelV6.diskFreeGb >= 0 ? `${sentinelV6.diskFreeGb.toFixed(1)} GB free` : "ไม่สามารถอ่านได้";
    const modeIcon = sentinelV6.operatingMode.toLowerCase().includes("night") ? "🌙" : "☀️";
    msg += `\n🛡️ <b>WP Sentinel V6.0:</b>\n`;
    msg += `• ${modeIcon} Operating Mode: <b>${sentinelV6.operatingMode}</b>\n`;
    msg += `• ${diskIcon} Storage Health: ${diskDisplay}\n`;
    if (sentinelV6.diskStatus === "critical") msg += `• ⚠️ พื้นที่เหลือน้อยกว่า 1.5 GB — ควรล้างข้อมูลทันที\n`;
  }

  if (actions.length > 0) {
    msg += `\n🤖 <b>Action Log (ล่าสุด ${actions.length} รายการ):</b>\n`;
    actions.slice(0, 5).forEach((a) => {
      const time = new Date(a.createdAt).toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" });
      msg += `• [${time}] ${a.actionType}: ${a.description.slice(0, 60)}\n`;
    });
  } else {
    msg += `\n🤖 <b>Action Log:</b> ไม่มีการดำเนินการอัตโนมัติในช่วงนี้\n`;
  }

  msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🔗 <a href="${process.env.DASHBOARD_URL || "https://ncr-watchdog-dashboard.pages.dev/"}">ดู Dashboard</a>`;

  await sendTelegramMessage(msg);
  await upsertSchedulerState("executive-brief", { lastRunAt: new Date(), lastStatus: "ok" });
}

/**
 * Heartbeat: daily morning report at 09:00 BKK
 */
export async function handleDailyMorning(req: Request, res: Response) { try {
      const { getHourlyTraffic } = await import("./cloudflare");
      const { buildHourlyChartUrl, buildHourlyTrafficCaption, sendTelegramPhoto } = await import("./telegram");
 
      const hourlyPoints = await getHourlyTraffic();
      if (hourlyPoints.length > 0) {
        const chartUrl = buildHourlyChartUrl(hourlyPoints);
        const caption = buildHourlyTrafficCaption(hourlyPoints);
        await sendTelegramPhoto(chartUrl, caption);
      }
    } catch (e) {
      console.warn("[heartbeat:daily-morning] hourly-chart failed:", e);
    }
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });

    // Run a fresh check first
    await runMonitorCycle();
    const data = await buildReportData();
    // Fetch top 3 broken links from DB for the morning report
    const topBrokenLinks = (await getTopBrokenLinks(3)).map((r) => ({ url: r.url, hits: r.hits }));
    // Fetch latest cache diagnostic for the cache health summary line
    const latestDiag = (await getRecentCacheDiagnostics(1))[0];
    const cacheHealthSummary = latestDiag
      ? `${latestDiag.cfCacheStatus}${latestDiag.wpCookiesDetected ? ` (WP Cookie: ${latestDiag.wpCookiesDetected})` : ""}`
      : undefined;
        const msg = buildDailyReport("morning", { ...data, topBrokenLinks, cacheHealthSummary });
    const result = await sendTelegramMessage(msg);
    // Send Top Posts report as a separate message (daily)
    try {
      const topPosts = await getTopPosts(1, 10);
      const topPostsMsg = buildTopPostsReport("daily", topPosts, cfData.countryTraffic);
      await sendTelegramMessage(topPostsMsg);
    } catch (e) {
      console.warn("[heartbeat:daily-morning] top-posts failed:", e);
    }
    await upsertSchedulerState("daily-morning", {
      lastRunAt: new Date(),
      lastStatus: result.success ? "ok" : "error",
    });
    // V12.1: also fire the V12.1 Morning Brief (Executive Brief) in the same run
    try {
      await runExecutiveBriefLogic();
    } catch (e) {
      console.warn("[heartbeat:daily-morning] executive-brief failed:", e);
    }
    res.json({ ok: true, messageId: result.messageId });
  } catch (err) {
    console.error("[heartbeat:daily-morning]", err);
    res.status(500).json({ error: (err as Error).message });
  }
}

/**
 * Heartbeat: daily evening report at 18:00 BKK
 */
export async function handleDailyEvening(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });

    await runMonitorCycle();
    const data = await buildReportData();
    const msg = buildDailyReport("evening", data);
    const result = await sendTelegramMessage(msg);

    await upsertSchedulerState("daily-evening", {
      lastRunAt: new Date(),
      lastStatus: result.success ? "ok" : "error",
    });

    res.json({ ok: true, messageId: result.messageId });
  } catch (err) {
    console.error("[heartbeat:daily-evening]", err);
    res.status(500).json({ error: (err as Error).message });
  }
}

/**
 * Heartbeat: weekly report every Sunday at 09:00 BKK
 */
export async function handleWeeklyReport(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });

    await runMonitorCycle();
    const data = await buildExtendedReportData();
        const msg = buildWeeklyReport(data);
    const result = await sendTelegramMessage(msg);
    // Send Top Posts report as a separate message (weekly)
    try {
      const topPosts = await getTopPosts(7, 10);
      const topPostsMsg = buildTopPostsReport("weekly", topPosts);
      await sendTelegramMessage(topPostsMsg);
    } catch (e) {
      console.warn("[heartbeat:weekly-report] top-posts failed:", e);
    }
    await upsertSchedulerState("weekly-sunday", {
      lastRunAt: new Date(),
      lastStatus: result.success ? "ok" : "error",
    });

    res.json({ ok: true, messageId: result.messageId });
  } catch (err) {
    console.error("[heartbeat:weekly-report]", err);
    res.status(500).json({ error: (err as Error).message });
  }
}

/**
 * Heartbeat: monthly report on the 1st of each month at 09:00 BKK
 */
export async function handleMonthlyReport(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });

    await runMonitorCycle();
    const data = await buildExtendedReportData(30);
    const month = new Date().toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "Asia/Bangkok" });
        const msg = buildMonthlyReport({ ...data, month });
    const result = await sendTelegramMessage(msg);
    // Send Top Posts report as a separate message (monthly)
    try {
      const topPosts = await getTopPosts(30, 10);
      const topPostsMsg = buildTopPostsReport("monthly", topPosts);
      await sendTelegramMessage(topPostsMsg);
    } catch (e) {
      console.warn("[heartbeat:monthly-report] top-posts failed:", e);
    }
    await upsertSchedulerState("monthly-first", {
      lastRunAt: new Date(),
      lastStatus: result.success ? "ok" : "error",
    });

    res.json({ ok: true, messageId: result.messageId });
  } catch (err) {
    console.error("[heartbeat:monthly-report]", err);
    res.status(500).json({ error: (err as Error).message });
  }
}

/**
 * Heartbeat: Morning Brief at 07:30 BKK (00:30 UTC)
 * Merges TH RSS news + Global RSS news + Personal Agenda + LLM English 3 sentences
 * into a single Telegram message.
 */
export async function handleMorningBrief(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });

    const { fetchThaiNews, fetchGlobalNews, generateEnglishSentences, buildMorningBriefMessage } = await import("./morningBrief");
    const { getPersonalAgenda } = await import("./db");

    const bangkokDate = new Date().toLocaleDateString("th-TH", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Asia/Bangkok",
    });
    const isoDate = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" }); // YYYY-MM-DD

    // Fetch all 4 components in parallel
    const [thaiNews, globalNews, englishSentences, agendaRow] = await Promise.allSettled([
      fetchThaiNews(),
      fetchGlobalNews(),
      generateEnglishSentences(),
      getPersonalAgenda(isoDate),
    ]);

    const msg = buildMorningBriefMessage({
      thaiNews: thaiNews.status === "fulfilled" ? thaiNews.value : [],
      globalNews: globalNews.status === "fulfilled" ? globalNews.value : [],
      agendaContent: agendaRow.status === "fulfilled" ? (agendaRow.value?.content ?? "") : "",
      englishSentences: englishSentences.status === "fulfilled" ? englishSentences.value : "",
      dateLabel: bangkokDate,
    });

    const result = await sendTelegramMessage(msg);

    await upsertSchedulerState("morning-brief", {
      lastRunAt: new Date(),
      lastStatus: result.success ? "ok" : "error",
    });

    res.json({ ok: true, sent: result.success });
  } catch (err) {
    console.error("[heartbeat:morning-brief]", err);
    res.status(500).json({ error: (err as Error).message });
  }
}

// ============================================================
// V3.0: Executive Daily Brief (07:30 BKK)
// Sends a management summary: Health Score + Action Log + Resource Efficiency
// ============================================================
export async function handleExecutiveBrief(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });
    await runExecutiveBriefLogic();
    res.json({ ok: true });
  } catch (err) {
    console.error("[heartbeat:executive-brief]", err);
    res.status(500).json({ error: (err as Error).message });
  }
}


// ============================================================
// V3.0: Stability Keepalive (every 6 hours)
// Silent status ping — alerts only if site is down
// ============================================================
export async function handleKeepalive(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });

        const siteResult = await checkSite();
    const isDown = !siteResult.isUp || siteResult.httpCode >= 500;
    const isHighLatency = siteResult.ttfbMs > 3000;
    const isHealthy = !isDown && !isHighLatency;

    // V5.1: TTFB Variance Monitor
    const { getTtfbVariance } = await import("./db");
    const variance = await getTtfbVariance(20);

    await upsertSchedulerState("keepalive", {
      lastRunAt: new Date(),
      lastStatus: isDown ? "down" : isHighLatency ? "high_latency" : variance.isUnstable ? "unstable" : "ok",
    });
    // V5.0 Zero Ghosting Protocol: alert on DOWN or HIGH LATENCY (> 3000ms)
    if (isDown || isHighLatency) {
      const inCooldown = await isInCooldown("keepalive-alert");
      if (!inCooldown) {
        const alertType = isDown ? "🔴" : "🟡";
        const alertLabel = isDown ? "Site DOWN" : "ความช้า (High Latency)";
        const msg =
          `${alertType} <b>[NCR Zero Ghosting] ตรวจพบ ${alertLabel}!</b>\n` +
          `HTTP: ${siteResult.httpCode} | TTFB: <b>${siteResult.ttfbMs}ms</b>${isHighLatency ? " (เกิน 3,000ms)" : ""}\n` +
          `🕐 ${new Date().toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok" })}\n` +
          `🔗 <a href="${process.env.DASHBOARD_URL || "https://ncr-watchdog-dashboard.pages.dev/"}">ดู Dashboard</a>`;
        await sendTelegramMessage(msg);
        // 4h cooldown for latency alerts, 2h for downtime (more urgent)
        await setCooldown("keepalive-alert", isDown ? 120 : 240);
      }
    }
    // V5.1: Alert on TTFB variance > 50ms (unstable response times)
    if (variance.isUnstable && !isDown && !isHighLatency) {
      const inVarianceCooldown = await isInCooldown("keepalive-variance-alert");
      if (!inVarianceCooldown) {
        const msg =
          `🟠 <b>[NCR V5.1] TTFB ไม่เสถียร!</b>\n` +
          `ความแตกต่าง: <b>${variance.variance}ms</b> (เกิน 50ms)\n` +
          `Min: ${variance.minTtfb}ms | Max: ${variance.maxTtfb}ms | Avg: ${variance.avgTtfb}ms\n` +
          `📊 จาก ${variance.samples} การตรวจสอบล่าสุด\n` +
          `⚠️ อาจเกิดจาก Cache MISS หรือ Origin Server โหลดสูง\n` +
          `🔗 <a href="${process.env.DASHBOARD_URL || "https://ncr-watchdog-dashboard.pages.dev/"}">ดู Dashboard</a>`;
        await sendTelegramMessage(msg);
        await setCooldown("keepalive-variance-alert", 360); // 6h cooldown for variance alerts
      }
    }
    // V5.2: WordPress DB Latency Monitor
    const { measureWpDbLatency } = await import("./wordpress");
    const { buildWpDbLatencyAlert } = await import("./telegram");
    const { saveWpDbLatency } = await import("./db");
    const wpDb = await measureWpDbLatency();
    // Persist reading for 24h trend
    await saveWpDbLatency(wpDb.latencyMs, wpDb.status, wpDb.httpCode);
    if (wpDb.isSlow) {
      const cooldownKey = wpDb.isCritical ? "keepalive-wpdb-critical" : "keepalive-wpdb-slow";
      const cooldownMinutes = wpDb.isCritical ? 60 : 120; // critical: 1h, slow: 2h
      const inWpDbCooldown = await isInCooldown(cooldownKey);
      if (!inWpDbCooldown) {
        // V12: High Load Detected label + cache flush recommendation
        const highLoadMsg =
          `🔴 <b>High Load Detected</b> — WP DB Latency: <b>${wpDb.latencyMs}ms</b>\n` +
          `📊 Status: ${wpDb.isCritical ? "CRITICAL (>1000ms)" : "SLOW (>500ms)"}\n` +
          `💡 แนะนำ: Purge CF Cache เพื่อลด Origin Load\n` +
          `🔗 <a href="${process.env.DASHBOARD_URL || "https://ncr-watchdog-dashboard.pages.dev/"}">Dashboard → Purge Cache</a>`;
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
      wpDbStatus: wpDb.status,
    });
  } catch (err) {
    console.error("[heartbeat:keepalive]", err);
    res.status(500).json({ error: (err as Error).message });
  }
}

// ============================================================
// V3.0: Weekly Quality Audit
// Broken links + SEO + oversized image scan → DB + Telegram
// ============================================================
export async function handleWeeklyQualityAudit(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });

    const { runQualityAudit, buildQualityAuditReport } = await import("./qualityAudit");
    const { upsertQualityAuditResult } = await import("./db");

    const issues = await runQualityAudit();
    for (const issue of issues) {
      await upsertQualityAuditResult(issue);
    }

    const dashboardUrl = process.env.DASHBOARD_URL || "https://ncr-watchdog-dashboard.pages.dev/";
    const msg = buildQualityAuditReport(issues, dashboardUrl);
    const result = await sendTelegramMessage(msg);

    await upsertSchedulerState("weekly-quality-audit", {
      lastRunAt: new Date(),
      lastStatus: result.success ? "ok" : "error",
    });

    res.json({ ok: true, issuesFound: issues.length, sent: result.success });
  } catch (err) {
    console.error("[heartbeat:weekly-quality-audit]", err);
    res.status(500).json({ error: (err as Error).message });
  }
}

// ============================================================
// V3.1: Facebook Comment Moderation
// Runs every 30 minutes — hides spam, flags risky comments
// ============================================================
export async function handleFBCommentModeration(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });
    if (FACEBOOK_PAUSED) {
      await upsertSchedulerState("fb-comment-moderation", { lastRunAt: new Date(), lastStatus: "paused_v5" });
      return res.json({ ok: true, skipped: true, reason: "V5.0 Site Sentinel Mode — Facebook paused" });
    }
    const { runCommentModeration, buildModerationReport } = await import("./facebook");
    const result = await runCommentModeration(5);
    // Only send Telegram if something was found
    if (result.hidden > 0 || result.risky > 0) {
      const msg = buildModerationReport(result);
      await sendTelegramMessage(msg);
    }
    await upsertSchedulerState("fb-comment-moderation", {
      lastRunAt: new Date(),
      lastStatus: "ok",
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[heartbeat:fb-comment-moderation]", err);
    res.status(500).json({ error: (err as Error).message });
  }
}

// ============================================================
// V3.2: Facebook Viral Scout
// Runs every 30 minutes — alerts when engagement > 5% of reach
// ============================================================
export async function handleFBViralScout(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });
    if (FACEBOOK_PAUSED) {
      await upsertSchedulerState("fb-viral-scout", { lastRunAt: new Date(), lastStatus: "paused_v5" });
      return res.json({ ok: true, skipped: true, reason: "V5.0 Site Sentinel Mode — Facebook paused" });
    }
    const { runViralScout, buildViralAlert } = await import("./facebook");
    const viralPosts = await runViralScout(5, 10);
    if (viralPosts.length > 0) {
      const msg = buildViralAlert(viralPosts);
      await sendTelegramMessage(msg);
    }
    await upsertSchedulerState("fb-viral-scout", {
      lastRunAt: new Date(),
      lastStatus: "ok",
    });
    res.json({ ok: true, viralCount: viralPosts.length });
  } catch (err) {
    console.error("[heartbeat:fb-viral-scout]", err);
    res.status(500).json({ error: (err as Error).message });
  }
}

// ============================================================
// V3.2: Facebook Ad Governance
// Runs daily at 20:00 BKK — spend vs results + CPC alert
// ============================================================
export async function handleFBAdGovernance(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });
    if (FACEBOOK_PAUSED) {
      await upsertSchedulerState("fb-ad-governance", { lastRunAt: new Date(), lastStatus: "paused_v5" });
      return res.json({ ok: true, skipped: true, reason: "V5.0 Site Sentinel Mode — Facebook paused" });
    }
    const { fetchAdReport, buildAdGovernanceReport } = await import("./facebook");
    const report = await fetchAdReport(5); // CPC threshold ฿5
    const msg = buildAdGovernanceReport(report);
    await sendTelegramMessage(msg);
    await upsertSchedulerState("fb-ad-governance", {
      lastRunAt: new Date(),
      lastStatus: "ok",
    });
    res.json({ ok: true, totalSpend: report.totalSpend, campaigns: report.campaigns.length });
  } catch (err) {
    console.error("[heartbeat:fb-ad-governance]", err);
    res.status(500).json({ error: (err as Error).message });
  }
}

// ============================================================
// V3.3: Ethical Responder
// Runs every 1 hour — auto-like, reply, flag sensitive comments
// ============================================================
export async function handleFBEthicalResponder(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });
    if (FACEBOOK_PAUSED) {
      await upsertSchedulerState("fb-ethical-responder", { lastRunAt: new Date(), lastStatus: "paused_v5" });
      return res.json({ ok: true, skipped: true, reason: "V5.0 Site Sentinel Mode — Facebook paused" });
    }
    const {
      runEthicalResponder,
      buildEthicalResponderReport,
      buildSensitiveFlagAlert,
    } = await import("./facebook");

    const result = await runEthicalResponder(5, async (commentId, message) => {
      // Send sensitive flag alert to Telegram for human review
      const alertMsg = buildSensitiveFlagAlert(commentId, message);
      await sendTelegramMessage(alertMsg);
    });

    // Send summary report only if there was any activity
    if (result.checked > 0 && (result.liked + result.replied + result.hidden + result.flagged) > 0) {
      const msg = buildEthicalResponderReport(result);
      await sendTelegramMessage(msg);
    }

    await upsertSchedulerState("fb-ethical-responder", {
      lastRunAt: new Date(),
      lastStatus: "ok",
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[heartbeat:fb-ethical-responder]", err);
    res.status(500).json({ error: (err as Error).message });
  }
}

// ============================================================
// V4.0: Viral Post Generator
// Analyze latest WP post -> Gemini AIDA caption -> Telegram
// ============================================================
export async function handleViralPostGenerator(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });
    if (FACEBOOK_PAUSED) {
      await upsertSchedulerState("viral-post-generator", { lastRunAt: new Date(), lastStatus: "paused_v5" });
      return res.json({ ok: true, skipped: true, reason: "V5.0 Site Sentinel Mode — Facebook paused" });
    }
    const { generateViralCaption } = await import("./gemini");

    // Fetch latest WP post
    const wpUrl = "https://nakornchiangrainews.com/wp-json/wp/v2/posts?per_page=1&_fields=id,title,excerpt,link";
    const r = await fetch(wpUrl, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`WP API error: HTTP ${r.status}`);
    const posts = (await r.json()) as any[];
    if (!posts.length) {
      await upsertSchedulerState("viral-post-generator", { lastRunAt: new Date(), lastStatus: "no_posts" });
      return res.json({ ok: true, skipped: true, reason: "no_posts" });
    }
    const post = posts[0];
    const title = post.title?.rendered ?? "";
    const excerpt = (post.excerpt?.rendered ?? "").replace(/<[^>]+>/g, "");
    const url = post.link ?? "";

    const result = await generateViralCaption(title, excerpt, url);
    const msg = `✍️ <b>[NCR Viral Post Generator]</b>\n\n${result.caption}`;
    await sendTelegramMessage(msg);

    await upsertSchedulerState("viral-post-generator", { lastRunAt: new Date(), lastStatus: "ok" });
    res.json({ ok: true, postTitle: title });
  } catch (err) {
    console.error("[heartbeat:viral-post-generator]", err);
    res.status(500).json({ error: (err as Error).message });
  }
}

// ============================================================
// V4.0: Public Mood Scanner (Weekly)
// Analyze FB comments sentiment -> Telegram summary
// ============================================================
export async function handlePublicMoodScanner(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });
    if (FACEBOOK_PAUSED) {
      await upsertSchedulerState("public-mood-scanner", { lastRunAt: new Date(), lastStatus: "paused_v5" });
      return res.json({ ok: true, skipped: true, reason: "V5.0 Site Sentinel Mode — Facebook paused" });
    }
    const { analyzePublicMood, buildMoodScanReport } = await import("./gemini");
    const { getRecentPageComments } = await import("./facebook");

    // Fetch recent comments from FB Page (last 7 days)
    const comments = await getRecentPageComments(100);
    const result = await analyzePublicMood(comments);
    const msg = buildMoodScanReport(result, comments.length);
    await sendTelegramMessage(msg);

    await upsertSchedulerState("public-mood-scanner", { lastRunAt: new Date(), lastStatus: "ok" });
    res.json({ ok: true, commentCount: comments.length, sentiment: result.overallSentiment });
  } catch (err) {
    console.error("[heartbeat:public-mood-scanner]", err);
    res.status(500).json({ error: (err as Error).message });
  }
}

// ============================================================
// V4.1: 404 Spike Detection (Hourly)
// Query CF for 404 rate vs total traffic in last 1h
// Alert if rate > 5%
// ============================================================
export async function handle404SpikeDetection(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });

    const { get404SpikeData } = await import("./cloudflare");
    const { build404SpikeAlert } = await import("./telegram");

    const spike = await get404SpikeData();

    if (spike.isSpike) {
      const inCooldown = await isInCooldown("404_spike");
      if (!inCooldown) {
        const msg = build404SpikeAlert(spike.rate404, spike.count404, spike.totalRequests, spike.top404Urls);
        await sendTelegramMessage(msg);
        await setCooldown("404_spike", 60); // 60-min cooldown to avoid alert fatigue
        // Also upsert the spike URLs into broken_links for tracking
        if (spike.top404Urls.length > 0) {
          await upsertBrokenLinks(spike.top404Urls);
        }
      }
    }

    await upsertSchedulerState("404-spike-detection", {
      lastRunAt: new Date(),
      lastStatus: spike.isSpike ? "spike_detected" : "ok",
    });

    res.json({
      ok: true,
      isSpike: spike.isSpike,
      rate404: spike.rate404,
      count404: spike.count404,
      totalRequests: spike.totalRequests,
    });
  } catch (err) {
    console.error("[heartbeat:404-spike-detection]", err);
    res.status(500).json({ error: (err as Error).message });
  }
}

// ============================================================
// V4.1: Cache Efficiency Audit (Every 6h)
// Query CF cache hit ratio for last 6h, separate fbclid traffic
// Send Telegram report
// ============================================================
export async function handleCacheEfficiencyAudit(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });

    const { getCacheEfficiencyData } = await import("./cloudflare");
    const { buildCacheEfficiencyReport } = await import("./telegram");

    const data = await getCacheEfficiencyData();
    const msg = buildCacheEfficiencyReport(data);
    await sendTelegramMessage(msg);

    await upsertSchedulerState("cache-efficiency-audit", {
      lastRunAt: new Date(),
      lastStatus: data.meetsTarget ? "ok" : "below_target",
    });

    res.json({
      ok: true,
      cacheHitRate: data.cacheHitRate,
      adjustedCacheHitRate: data.adjustedCacheHitRate,
      meetsTarget: data.meetsTarget,
      fbclidRequests: data.fbclidRequests,
    });
  } catch (err) {
    console.error("[heartbeat:cache-efficiency-audit]", err);
    res.status(500).json({ error: (err as Error).message });
  }
}

// ============================================================
// V4.1: FB Traffic Validation (Daily)
// Verify fbclid requests success vs failure rates
// Alert if success rate < 95%
// ============================================================
export async function handleFBTrafficValidation(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });

    const { getFBTrafficValidation } = await import("./cloudflare");
    const { buildFBTrafficReport } = await import("./telegram");

    const data = await getFBTrafficValidation();

    // Always send the report (daily summary) — but only alert if there's an issue
    const msg = buildFBTrafficReport(data);
    await sendTelegramMessage(msg);

    await upsertSchedulerState("fb-traffic-validation", {
      lastRunAt: new Date(),
      lastStatus: data.hasIssue ? "issue_detected" : "ok",
    });

    res.json({
      ok: true,
      fbclidTotal: data.fbclidTotal,
      successRate: data.successRate,
      hasIssue: data.hasIssue,
    });
  } catch (err) {
    console.error("[heartbeat:fb-traffic-validation]", err);
    res.status(500).json({ error: (err as Error).message });
  }
}

// ============================================================
// V5.1: Cache Warm-Up Prefetch
// Triggered after a new WP post is published — fetches the
// article URL to prime the CF edge cache before readers arrive.
// Schedule: every 30min (checks if a new post was published
// in the last 30min; skips if no new post found)
// ============================================================
export async function handleCacheWarmup(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });

    // Fetch the latest WP post — use date_gmt (always UTC) to avoid timezone issues
    const wpRes = await fetch("https://nakornchiangrainews.com/wp-json/wp/v2/posts?per_page=1&_fields=id,link,date_gmt");
    if (!wpRes.ok) {
      return res.json({ ok: false, reason: `WP API error: ${wpRes.status}` });
    }
    const posts = (await wpRes.json()) as Array<{ id: number; link: string; date_gmt: string }>;
    if (!posts.length) return res.json({ ok: false, reason: "no posts found" });

    const latest = posts[0];
    // date_gmt is always UTC — no TZ suffix needed
    const publishedAt = new Date(latest.date_gmt + "Z");
    const ageMinutes = (Date.now() - publishedAt.getTime()) / 60000;

    // Only warm up if the post was published within the last 35 minutes
    if (ageMinutes > 35) {
      await upsertSchedulerState("cache-warmup", {
        lastRunAt: new Date(),
        lastStatus: "skipped",
      });
      return res.json({ ok: true, skipped: true, reason: `Post age ${ageMinutes.toFixed(0)}min > 35min`, url: latest.link });
    }

    // Deduplication: skip if this post ID was already warmed in a previous run
    const { getSchedulerStates } = await import("./db");
    const states = await getSchedulerStates();
    const warmupState = states.find((s) => s.jobName === "cache-warmup");
    const lastWarmedId = warmupState?.lastStatus?.startsWith("warmed:") ? warmupState.lastStatus.replace("warmed:", "") : null;
    if (lastWarmedId === String(latest.id)) {
      return res.json({ ok: true, skipped: true, reason: `Post ${latest.id} already warmed`, url: latest.link });
    }

    // Prefetch the article URL to warm the CF edge cache
    const startTime = Date.now();
    const prefetchRes = await fetch(latest.link, {
      headers: { "User-Agent": "NCR-Watchdog-CacheWarmup/5.1" },
    });
    const ttfbMs = Date.now() - startTime;

    // Store warmed post ID for deduplication on next run
    await upsertSchedulerState("cache-warmup", {
      lastRunAt: new Date(),
      lastStatus: prefetchRes.ok ? `warmed:${latest.id}` : `error:${latest.id}`,
    });

    // Notify Telegram on successful warm-up
    if (prefetchRes.ok) {
      const msg =
        `🔥 <b>[NCR Cache Warm-Up]</b> เติมแคชสำเร็จ!\n` +
        `📰 ${latest.link}\n` +
        `⚡ TTFB: ${ttfbMs}ms | HTTP: ${prefetchRes.status}\n` +
        `🕐 โพสต์เมื่อ ${ageMinutes.toFixed(0)} นาทีที่แล้ว`;
      await sendTelegramMessage(msg);
    }

    res.json({ ok: prefetchRes.ok, url: latest.link, ttfbMs, httpCode: prefetchRes.status, ageMinutes });
  } catch (err) {
    console.error("[heartbeat:cache-warmup]", err);
    res.status(500).json({ error: (err as Error).message });
  }
}

/**
 * Heartbeat: V7.0 PageSpeed Payload Monitor
 * Checks total page size via PageSpeed Insights API.
 * Alerts Telegram if page size exceeds 5MB (24h cooldown).
 */
export async function handlePageSpeedPayloadAlert(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });

    const { checkPageSpeedPayload } = await import("./wordpress");
    const { buildPageSpeedPayloadAlert } = await import("./telegram");

    const result = await checkPageSpeedPayload();

    if (result.error) {
      console.warn("[pagespeed-payload] fetch error:", result.error);
      await upsertSchedulerState("pagespeed-payload", {
        lastRunAt: new Date(),
        lastStatus: `error: ${result.error}`,
      });
      return res.json({ ok: false, error: result.error });
    }

    // Alert if page size > 5MB (24h cooldown to avoid spam)
    if (result.isOversized) {
      const inCooldown = await isInCooldown("pagespeed-payload-alert");
      if (!inCooldown) {
        await sendTelegramMessage(buildPageSpeedPayloadAlert(result.pageSizeMb));
        await setCooldown("pagespeed-payload-alert", 1440); // 24h = 1440 min
      }
    }

    await upsertSchedulerState("pagespeed-payload", {
      lastRunAt: new Date(),
      lastStatus: result.isOversized ? `oversized:${result.pageSizeMb.toFixed(2)}MB` : `ok:${result.pageSizeMb.toFixed(2)}MB`,
    });

    res.json({
      ok: true,
      pageSizeMb: result.pageSizeMb,
      isOversized: result.isOversized,
      alertFired: result.isOversized,
    });
  } catch (err) {
    console.error("[heartbeat:pagespeed-payload]", err);
    res.status(500).json({ error: (err as Error).message });
  }
}
