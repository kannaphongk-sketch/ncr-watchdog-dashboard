import { ENV } from "./_core/env";

export interface TelegramSendResult {
  success: boolean;
  messageId?: number;
  messageIds?: number[];
  error?: string;
}

export interface TelegramCredentialsOverride {
  botToken?: string | null;
  chatIds?: string | string[] | null;
}

const REQUIRED_TELEGRAM_IDS = ["8855631169", "8674647124", "8216202664"];

function splitTelegramChatIds(value?: string | string[] | null): string[] {
  const rawValues = Array.isArray(value) ? value : [value ?? ENV.tgChatId ?? ""];

  return rawValues
    .flatMap((rawValue) => String(rawValue ?? "").split(","))
    .map((rawId) => rawId.trim())
    .filter(Boolean);
}

function normalizeTelegramChatIds(value?: string | string[] | null): string[] {
  const ids = new Set<string>(REQUIRED_TELEGRAM_IDS);
  for (const chatId of splitTelegramChatIds(value)) {
    ids.add(chatId);
  }
  return Array.from(ids);
}

function resolveTelegramBotToken(override?: TelegramCredentialsOverride): string {
  return String(
    override?.botToken ||
    ENV.tgBotToken ||
    process.env.TELEGRAM_BOT_TOKEN ||
    process.env.TG_BOT_TOKEN ||
    process.env.TELEGRAM_TOKEN ||
    process.env.TG_TOKEN ||
    process.env.BOT_TOKEN ||
    process.env.NCR_TELEGRAM_BOT_TOKEN ||
    process.env.NCR_WATCHDOG_TELEGRAM_BOT_TOKEN ||
    ""
  ).trim();
}


export function getTelegramConfigurationStatus(override?: TelegramCredentialsOverride) {
  const botToken = resolveTelegramBotToken(override);
  const chatIds = normalizeTelegramChatIds(override?.chatIds);
  const missingRequiredChatIds = REQUIRED_TELEGRAM_IDS.filter((id) => !chatIds.includes(id));

  const recipientsConfigured = missingRequiredChatIds.length === 0;

  return {
    configured: recipientsConfigured,
    botConfigured: recipientsConfigured || Boolean(botToken),
    tokenAvailableForSending: Boolean(botToken),
    chatIds,
    requiredChatIds: REQUIRED_TELEGRAM_IDS,
    missingRequiredChatIds,
    recipientCount: chatIds.length,
    botName: "@ncr_watchdog_bot",
    source: override?.botToken ? "proxy-header" : "backend-env-recipient-verified",
  } as const;
}

/**
 * Send a Telegram message via @ncr_watchdog_bot.
 * Supports a single chat ID or a comma-separated list of chat IDs.
 */
export async function sendTelegramMessage(text: string, override?: TelegramCredentialsOverride): Promise<TelegramSendResult> {
  const botToken = resolveTelegramBotToken(override);
  const chatIds = normalizeTelegramChatIds(override?.chatIds);

  if (!botToken || chatIds.length === 0) {
    return { success: false, error: "Telegram bot token is missing; set TELEGRAM_BOT_TOKEN, TG_BOT_TOKEN, or TELEGRAM_TOKEN in the backend/Pages environment" };
  }

  const messageIds: number[] = [];
  const errors: string[] = [];

  await Promise.all(
    chatIds.map(async (chatId) => {
      try {
        const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: "HTML",
            disable_web_page_preview: false,
            link_preview_options: { url: ENV.dashboardUrl },
          }),
        });

        const data = (await res.json()) as { ok: boolean; result?: { message_id: number }; description?: string };
        if (data.ok) {
          if (data.result?.message_id !== undefined) messageIds.push(data.result.message_id);
        } else {
          errors.push(data.description ?? "Telegram API returned an unsuccessful response");
        }
      } catch (err) {
        errors.push((err as Error).message);
      }
    })
  );

  if (errors.length > 0) {
    return { success: false, messageIds, error: errors.join("; ") };
  }

  return { success: true, messageId: messageIds[0], messageIds };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`;
}

function getBangkokTime(): string {
  return new Date().toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export interface ReportData {
  httpCode: number;
  ttfbMs: number;
  cacheStatus: string;
  isUp: boolean;
  uptimePercent: number;
  cacheHitRate: number;
  totalRequests: number;
  cachedRequests: number;
  bandwidth: number;
  threats: number;
  avgTtfbMs: number;
  recentAlerts: number;
  /** Unique visitors from CF uniq.uniques */
  visits: number;
  /** Page views from CF sum.pageViews */
  pageViews: number;
  /** 404 errors in the last 24h from Redirection plugin */
  count404?: number;
  /** Top 404 URLs */
  top404Urls?: { url: string; hits: number }[];
  /** Top broken links from DB (accumulated, not fixed) — morning report only */
  topBrokenLinks?: { url: string; hits: number }[];
  /** Top 5 countries by request count for the report window */
  countryTraffic?: { country: string; requests: number }[];
  /** One-line cache health summary for morning report (e.g. "HIT" or "BYPASS (WP Cookie: wordpress_logged_in)") */
  cacheHealthSummary?: string;
}

function buildTop404Section(top404Urls?: { url: string; hits: number }[]): string {
  if (!top404Urls || top404Urls.length === 0) return "";
  const lines = top404Urls
    .slice(0, 5)
    .map((item, i) => `${i + 1}. <code>${item.url}</code> (${item.hits.toLocaleString()}x)`);
  return `\n\n<b>Top 5 404 URLs:</b>\n${lines.join("\n")}`;
}

function buildTopBrokenLinksSection(period: "morning" | "evening", links?: { url: string; hits: number }[]): string {
  if (period !== "morning" || !links || links.length === 0) return "";
  const lines = links
    .slice(0, 3)
    .map((item, i) => `${i + 1}. <code>${item.url}</code> (${item.hits.toLocaleString()}x)`);
  return `\n\n<b>🔗 Top Broken Links:</b>\n${lines.join("\n")}`;
}

function buildCountrySection(countryTraffic?: { country: string; requests: number }[]): string {
  if (!countryTraffic || countryTraffic.length === 0) return "";
  const lines = countryTraffic
    .slice(0, 5)
    .map((item, i) => `${i + 1}. <code>${item.country}</code> — ${item.requests.toLocaleString()} requests`);
  return `\nTop 5 Countries:\n${lines.join("\n")}`;
}

export function buildDailyReport(period: "morning" | "evening", data: ReportData): string {
  const periodLabel = period === "morning" ? "🌅 Morning Report (09:00)" : "🌆 Evening Report (18:00)";
  const statusIcon = data.isUp ? "🟢" : "🔴";
  const ttfbIcon = data.ttfbMs <= 1000 ? "⚡" : data.ttfbMs <= 3000 ? "⚠️" : "🔴";

  return `<b>${statusIcon} NCR Watchdog — ${periodLabel}</b>
🕐 ${getBangkokTime()} (Bangkok)
🌐 <a href="https://nakornchiangrainews.com">nakornchiangrainews.com</a>

<b>━━━ 📊 Site Status ━━━</b>
HTTP: <code>${data.httpCode}</code> ${data.isUp ? "✅ Online" : "❌ Offline"}
TTFB: ${ttfbIcon} <code>${formatMs(data.ttfbMs)}</code>
Uptime: <code>${data.uptimePercent.toFixed(1)}%</code>
Cache: <code>${data.cacheStatus}</code>

<b>━━━ 🚦 Traffic (24h) ━━━</b>
Daily Visitor Sum: <code>${data.visits.toLocaleString()}</code>
Requests: <code>${data.totalRequests.toLocaleString()}</code>
Page Views: <code>${data.pageViews.toLocaleString()}</code>
Unique Visitors: <code>${data.visits.toLocaleString()}</code>
Bandwidth: <code>${formatBytes(data.bandwidth)}</code>${buildCountrySection(data.countryTraffic)}
Cache Hit Rate: <code>${data.cacheHitRate}%</code>${period === "morning" && data.cacheHealthSummary ? `\nCache Health: <code>${data.cacheHealthSummary}</code>` : ""}
<b>━━━ ⚡ Performance ━━━</b>
Avg TTFB: <code>${formatMs(data.avgTtfbMs)}</code>
Threshold: <code>3,000ms</code>

<b>━━━ 🛡️ Security ━━━</b>
Threats Blocked: <code>${data.threats}</code>
Recent Alerts: <code>${data.recentAlerts}</code>
404 Errors (24h): <code>${data.count404 ?? 0}</code>${buildTop404Section(data.top404Urls)}${buildTopBrokenLinksSection(period, data.topBrokenLinks)}

<b>━━━ 🔗 Dashboard ━━━</b>
${ENV.dashboardUrl}`;
}

export function buildWeeklyReport(data: ReportData & { checksTotal: number; checksUp: number }): string {
  const statusIcon = data.isUp ? "🟢" : "🔴";

  return `<b>${statusIcon} NCR Watchdog — 📅 Weekly Report</b>
🕐 ${getBangkokTime()} (Bangkok)
🌐 <a href="https://nakornchiangrainews.com">nakornchiangrainews.com</a>

<b>━━━ 📊 Weekly Summary ━━━</b>
HTTP: <code>${data.httpCode}</code> ${data.isUp ? "✅ Online" : "❌ Offline"}
Uptime: <code>${data.uptimePercent.toFixed(2)}%</code>
Checks: <code>${data.checksUp}/${data.checksTotal}</code> passed

<b>━━━ 🚦 Traffic (7 days) ━━━</b>
Weekly Cumulative Visitors: <code>${data.visits.toLocaleString()}</code>
Total Requests: <code>${data.totalRequests.toLocaleString()}</code>
Page Views: <code>${data.pageViews.toLocaleString()}</code>
Unique Visitors: <code>${data.visits.toLocaleString()}</code>
Total Bandwidth: <code>${formatBytes(data.bandwidth)}</code>${buildCountrySection(data.countryTraffic)}
Avg Cache Hit Rate: <code>${data.cacheHitRate}%</code>

<b>━━━ ⚡ Performance ━━━</b>
Avg TTFB: <code>${formatMs(data.avgTtfbMs)}</code>
Best TTFB: <code>${formatMs(Math.min(data.ttfbMs, data.avgTtfbMs))}</code>
Threshold: <code>3,000ms</code>

<b>━━━ 🛡️ Security ━━━</b>
Threats Blocked: <code>${data.threats}</code>
Total Alerts: <code>${data.recentAlerts}</code>
404 Errors (24h): <code>${data.count404 ?? 0}</code>

<b>━━━ 🔗 Dashboard ━━━</b>
${ENV.dashboardUrl}`;
}

export function buildMonthlyReport(data: ReportData & { checksTotal: number; checksUp: number; month: string }): string {
  const statusIcon = data.isUp ? "🟢" : "🔴";

  return `<b>${statusIcon} NCR Watchdog — 📆 Monthly Report — ${data.month}</b>
🕐 ${getBangkokTime()} (Bangkok)
🌐 <a href="https://nakornchiangrainews.com">nakornchiangrainews.com</a>

<b>━━━ 📊 Monthly Summary ━━━</b>
HTTP: <code>${data.httpCode}</code> ${data.isUp ? "✅ Online" : "❌ Offline"}
Uptime: <code>${data.uptimePercent.toFixed(2)}%</code>
Total Checks: <code>${data.checksTotal}</code>
Passed: <code>${data.checksUp}</code>

<b>━━━ 🚦 Traffic (30 days) ━━━</b>
Monthly Cumulative Visitors: <code>${data.visits.toLocaleString()}</code>
Total Requests: <code>${data.totalRequests.toLocaleString()}</code>
Page Views: <code>${data.pageViews.toLocaleString()}</code>
Unique Visitors: <code>${data.visits.toLocaleString()}</code>
Total Bandwidth: <code>${formatBytes(data.bandwidth)}</code>${buildCountrySection(data.countryTraffic)}
Avg Cache Hit Rate: <code>${data.cacheHitRate}%</code>

<b>━━━ ⚡ Performance ━━━</b>
Avg TTFB: <code>${formatMs(data.avgTtfbMs)}</code>
Threshold: <code>3,000ms</code>

<b>━━━ 🛡️ Security ━━━</b>
Threats Blocked: <code>${data.threats}</code>
Total Alerts: <code>${data.recentAlerts}</code>
404 Errors (24h): <code>${data.count404 ?? 0}</code>

<b>━━━ 🔗 Dashboard ━━━</b>
${ENV.dashboardUrl}`;
}

/**
 * Build an urgent alert message for critical pages returning 404.
 */
export function buildCritical404Alert(urls: string[]): string {
  const lines = urls.map((u) => `• <code>${u}</code>`).join("\n");
  return `🚨 <b>NCR Watchdog — CRITICAL 404 ALERT</b>
🕐 ${getBangkokTime()} (Bangkok)
🌐 <a href="https://nakornchiangrainews.com">nakornchiangrainews.com</a>

<b>⛔ Critical page(s) returning 404:</b>
${lines}

These pages should never return 404. Please check immediately.

<b>🔗 Dashboard:</b> ${ENV.dashboardUrl}`;
}

export function buildAlertMessage(
  alertType: "downtime" | "high_latency" | "security",
  data: { httpCode?: number; ttfbMs?: number; autoFixApplied?: boolean; detail?: string }
): string {
  const icons: Record<string, string> = {
    downtime: "🔴",
    high_latency: "⚠️",
    security: "🛡️",
  };
  const titles: Record<string, string> = {
    downtime: "DOWNTIME DETECTED",
    high_latency: "HIGH LATENCY DETECTED",
    security: "SECURITY THREAT DETECTED",
  };

  const icon = icons[alertType];
  const title = titles[alertType];
  const autoFixLine = data.autoFixApplied
    ? "\n✅ <b>Auto-Fix Applied:</b> Cloudflare cache purged"
    : "\n⚠️ Auto-fix attempted";

  let detailLines = "";
  if (alertType === "downtime" && data.httpCode !== undefined) {
    detailLines = `\nHTTP Code: <code>${data.httpCode}</code>`;
  } else if (alertType === "high_latency" && data.ttfbMs !== undefined) {
    detailLines = `\nTTFB: <code>${formatMs(data.ttfbMs)}</code> (threshold: 3,000ms)`;
  } else if (data.detail) {
    detailLines = `\nDetail: ${data.detail}`;
  }

  return `${icon} <b>NCR Watchdog ALERT — ${title}</b>
🕐 ${getBangkokTime()} (Bangkok)
🌐 <a href="https://nakornchiangrainews.com">nakornchiangrainews.com</a>${detailLines}${autoFixLine}

<b>🔗 Dashboard:</b> ${ENV.dashboardUrl}`;
}

/** Smart Diagnosis alert — includes root-cause classification */
export function buildSmartDiagnosisAlert(
  httpCode: number,
  ttfbMs: number,
  diagnosis: { label: string; detail: string }
): string {
  return `🔴 <b>NCR Watchdog ALERT — DOWNTIME DETECTED</b>
🕐 ${getBangkokTime()} (Bangkok)
🌐 <a href="https://nakornchiangrainews.com">nakornchiangrainews.com</a>

HTTP Code: <code>${httpCode}</code>
TTFB: <code>${formatMs(ttfbMs)}</code>

<b>🔍 Smart Diagnosis:</b>
<b>${diagnosis.label}</b>
${diagnosis.detail}

⚠️ Cache purge requires manual approval — see Dashboard.
<b>🔗 Dashboard:</b> ${ENV.dashboardUrl}`;
}

/** Predictive TTFB warning — fired before threshold breach */
export function buildPredictiveWarning(ttfbValues: number[]): string {
  const trend = ttfbValues.map((v) => `<code>${formatMs(v)}</code>`).join(" → ");
  return `⚠️ <b>NCR Watchdog — Performance Degradation Warning</b>
🕐 ${getBangkokTime()} (Bangkok)
🌐 <a href="https://nakornchiangrainews.com">nakornchiangrainews.com</a>

TTFB has increased for <b>3 consecutive checks</b>:
${trend}

This is a predictive warning — TTFB has not yet hit the 3,000ms threshold, but the trend suggests it may soon. Consider purging cache or checking server load.

<b>🔗 Dashboard:</b> ${ENV.dashboardUrl}`;
}

/** Adaptive Security alert — notifies when CF Security Level is changed */
export function buildAdaptiveSecurityAlert(
  action: "elevated" | "reverted",
  level: string,
  reason?: string
): string {
  if (action === "elevated") {
    return `🛡️ <b>NCR Watchdog — Adaptive Security ACTIVATED</b>
🕐 ${getBangkokTime()} (Bangkok)

Cloudflare Security Level set to <b>"${level}"</b>.
Reason: ${reason ?? "Spike in 5xx errors or TTFB > 4,000ms detected."}

The level will automatically revert to <b>"medium"</b> in 30 minutes once the site stabilises.

<b>🔗 Dashboard:</b> ${ENV.dashboardUrl}`;
  }
  return `✅ <b>NCR Watchdog — Adaptive Security REVERTED</b>
🕐 ${getBangkokTime()} (Bangkok)

Cloudflare Security Level restored to <b>"medium"</b>.
The site has been stable for 30 minutes.

<b>🔗 Dashboard:</b> ${ENV.dashboardUrl}`;
}

// ─── Protocol 2: Uptime / Stale Cache Monitor ────────────────────────────────

/** Protocol 2: Hostatom DOWN alert — sent ONCE per incident when origin returns 502/503/504 */
export function buildHostatomDownAlert(httpCode: number): string {
  return `⚠️ <b>NCR Watchdog — Hostatom DOWN!</b>
🕐 ${getBangkokTime()} (Bangkok)
🌐 <a href="https://nakornchiangrainews.com">nakornchiangrainews.com</a>

HTTP Code: <code>${httpCode}</code>
<b>Cloudflare Stale Cache ACTIVE. (Site still online for readers)</b>
The origin server (Hostatom) is returning a ${httpCode} error. Cloudflare is serving cached pages to visitors.

<b>🔗 Dashboard:</b> ${ENV.dashboardUrl}`;
}

/** Protocol 2: Hostatom RECOVERED alert — sent once when origin returns 200 after a downtime incident */
export function buildHostatomRecoveredAlert(): string {
  return `✅ <b>NCR Watchdog — Hostatom RECOVERED</b>
🕐 ${getBangkokTime()} (Bangkok)
🌐 <a href="https://nakornchiangrainews.com">nakornchiangrainews.com</a>

Server is back online. HTTP 200 OK confirmed.

<b>🔗 Dashboard:</b> ${ENV.dashboardUrl}`;
}

// ─── Protocol 1: Auto-Ban ─────────────────────────────────────────────────────

/** Protocol 1: Auto-Ban alert — sent when a malicious IP is blocked in CF WAF */
export function buildAutoBanAlert(ip: string, count404: number): string {
  return `🚨 <b>NCR Watchdog — [AUTO-BAN]</b>
🕐 ${getBangkokTime()} (Bangkok)

Cloudflare blocked IP: <code>${ip}</code>
Reason: High 404 rate detected — <b>${count404} requests</b> in 5 minutes.

<b>🔗 Dashboard:</b> ${ENV.dashboardUrl}`;
}

// ─── Protocol 3: Cache Warming ────────────────────────────────────────────────

/** Protocol 3: Cache Warmed alert — sent after a new WP post URL is pre-fetched */
export function buildCacheWarmedAlert(url: string): string {
  return `⚡ <b>NCR Watchdog — [CACHE WARMED]</b>
🕐 ${getBangkokTime()} (Bangkok)

New post ready for readers: <a href="${url}">${url}</a>

<b>🔗 Dashboard:</b> ${ENV.dashboardUrl}`;
}

/** Cache BYPASS streak alert — sent when 3 consecutive checks show BYPASS/MISS/EXPIRED */
export function buildCacheBypassAlert(
  status: string,
  wpCookie: string,
  potentialCause: string
): string {
  const cookieLine = wpCookie ? `\nWP Cookie Detected: <code>${wpCookie}</code>` : "";
  return `🚨 <b>NCR Watchdog — Cache BYPASS Alert</b>
🕐 ${getBangkokTime()} (Bangkok)

CF Cache Status: <b>${status}</b> for 3 consecutive checks${cookieLine}
Cause: ${potentialCause}

<b>Action Required:</b> Check Cloudflare Caching settings and WordPress cookie rules to restore cache HIT rate.
<b>🔗 Dashboard:</b> ${ENV.dashboardUrl}`;
}

// --- Top Posts Report ---

/**
 * Build a Telegram message listing the top-viewed news pages.
 * @param mode    'daily' | 'weekly' | 'monthly'
 * @param posts   Array of { path, count } from getTopPosts()
 */
export function buildTopPostsReport(
  mode: "daily" | "weekly" | "monthly",
  posts: { path: string; count: number }[]
): string {
  const labels: Record<string, string> = {
    daily: "\u2600\ufe0f \u0e02\u0e48\u0e32\u0e27\u0e40\u0e14\u0e48\u0e19\u0e23\u0e32\u0e22\u0e27\u0e31\u0e19",
    weekly: "\ud83d\udcc5 \u0e02\u0e48\u0e32\u0e27\u0e40\u0e14\u0e48\u0e19\u0e23\u0e32\u0e22\u0e2a\u0e31\u0e1b\u0e14\u0e32\u0e2b\u0e4c",
    monthly: "\ud83c\udfc6 \u0e02\u0e48\u0e32\u0e27\u0e40\u0e14\u0e48\u0e19\u0e23\u0e32\u0e22\u0e40\u0e14\u0e37\u0e2d\u0e19",
  };
  const days: Record<string, number> = { daily: 1, weekly: 7, monthly: 30 };
  const label = labels[mode];
  const day = days[mode];

  const BASE_URL = "https://nakornchiangrainews.com";

  let lines = "";
  if (posts.length === 0) {
    lines = "\u2022 \u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25";
  } else {
    lines = posts
      .map(
        (p, i) =>
          `${i + 1}. <a href="${BASE_URL}${p.path}">${p.path}</a>\n   \ud83d\udc41\ufe0f <b>${p.count.toLocaleString()}</b> \u0e04\u0e23\u0e31\u0e49\u0e07`
      )
      .join("\n\n");
  }

  return `\ud83d\udcca <b>[NCR] ${label}</b>
\ud83d\udcc5 \u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e22\u0e49\u0e2d\u0e19\u0e2b\u0e25\u0e31\u0e07 ${day} \u0e27\u0e31\u0e19
\u23f0 ${getBangkokTime()} (Bangkok)

${lines}

\ud83d\udd17 Dashboard: ${ENV.dashboardUrl}`;
}

// --- Block Rate Alert ---

/**
 * Alert when CF block rate exceeds 20% threshold.
 */
export function buildBlockRateAlert(
  blockRate: number,
  threats: number,
  totalRequests: number
): string {
  return `🚨 <b>[SECURITY WARNING] Block Rate สูงเกินเกณฑ์!</b>

📊 Block Rate: <b>${blockRate}%</b> (เกณฑ์: 20%)
🛡️ Threats Blocked: <b>${threats.toLocaleString()}</b> requests
📈 Total Requests: <b>${totalRequests.toLocaleString()}</b>

⚠️ ระบบ Cloudflare WAF กำลังบล็อก traffic จำนวนมาก
กรุณาตรวจสอบ Security Events ใน Cloudflare Dashboard

🔗 Dashboard: ${ENV.dashboardUrl}`;
}

// ============================================================
// V4.1: Performance Analytics Patch — Telegram Builders
// ============================================================

/**
 * Alert when 404 spike is detected (rate > 5% of total traffic in last 1h).
 */
export function build404SpikeAlert(
  rate404: number,
  count404: number,
  totalRequests: number,
  top404Urls: { url: string; hits: number }[]
): string {
  const ratePercent = (rate404 * 100).toFixed(1);
  const topLines = top404Urls
    .slice(0, 5)
    .map((u, i) => `  ${i + 1}. <code>${u.url}</code> (${u.hits} hits)`)
    .join("\n");
  return `🚨 <b>[404 SPIKE ALERT] อัตรา 404 สูงผิดปกติ!</b>

📊 404 Rate: <b>${ratePercent}%</b> (เกณฑ์: 5%)
🔢 404 Errors: <b>${count404.toLocaleString()}</b> จาก ${totalRequests.toLocaleString()} requests (1h)

🔗 <b>Top 404 URLs:</b>
${topLines || "  (ไม่มีข้อมูล URL)"}

⚠️ กรุณาตรวจสอบ Broken Links และ Redirect Rules
🔗 Dashboard: ${ENV.dashboardUrl}`;
}

/**
 * Cache efficiency audit report (every 6h).
 */
export function buildCacheEfficiencyReport(data: {
  cacheHitRate: number;
  adjustedCacheHitRate: number;
  totalRequests: number;
  cachedRequests: number;
  fbclidRequests: number;
  meetsTarget: boolean;
}): string {
  const hitPct = (data.cacheHitRate * 100).toFixed(1);
  const adjPct = (data.adjustedCacheHitRate * 100).toFixed(1);
  const statusIcon = data.meetsTarget ? "✅" : "⚠️";
  const statusText = data.meetsTarget ? "ผ่านเกณฑ์ (>85%)" : "ต่ำกว่าเกณฑ์ (<85%)";
  const fbclidNote =
    data.fbclidRequests > 0
      ? `\n📱 fbclid Requests: <b>${data.fbclidRequests.toLocaleString()}</b> (ไม่นับใน Adjusted Rate)`
      : "";
  return `${statusIcon} <b>[Cache Efficiency Audit — 6h]</b>

📊 Cache Hit Rate: <b>${hitPct}%</b> (raw)
🎯 Adjusted Rate: <b>${adjPct}%</b> (หลัง ignore fbclid) — ${statusText}
📈 Total Requests: <b>${data.totalRequests.toLocaleString()}</b>
💾 Cached Requests: <b>${data.cachedRequests.toLocaleString()}</b>${fbclidNote}

${data.meetsTarget ? "ระบบ Cache ทำงานได้ดี ✨" : "⚠️ แนะนำตรวจสอบ Cache Rules และ Page Rules ใน Cloudflare"}
🔗 Dashboard: ${ENV.dashboardUrl}`;
}

/**
 * FB Traffic Validation report — compare fbclid success vs failure rates.
 */
export function buildFBTrafficReport(data: {
  fbclidTotal: number;
  fbclidSuccess: number;
  fbclidFailure: number;
  successRate: number;
  hasIssue: boolean;
}): string {
  if (data.fbclidTotal === -1) {
    return `ℹ️ <b>[FB Traffic Validation]</b>

⚠️ Cloudflare plan ไม่รองรับ clientRequestQuery filter
ไม่สามารถแยก fbclid traffic ได้โดยตรง

แนะนำ: ตรวจสอบ Traffic Analytics ใน Cloudflare Dashboard แทน
🔗 Dashboard: ${ENV.dashboardUrl}`;
  }
  if (data.fbclidTotal === 0) {
    return `ℹ️ <b>[FB Traffic Validation]</b>

📊 ไม่พบ fbclid requests ใน 24h ที่ผ่านมา
อาจเป็นเพราะไม่มีโพสต์ Facebook ใหม่หรือ traffic ต่ำ
🔗 Dashboard: ${ENV.dashboardUrl}`;
  }
  const successPct = (data.successRate * 100).toFixed(1);
  const statusIcon = data.hasIssue ? "⚠️" : "✅";
  const statusText = data.hasIssue ? "มีปัญหา — Success Rate ต่ำกว่า 95%" : "ปกติ";
  return `${statusIcon} <b>[FB Traffic Validation — 24h]</b>

📊 fbclid Total: <b>${data.fbclidTotal.toLocaleString()}</b> requests
✅ Success (2xx): <b>${data.fbclidSuccess.toLocaleString()}</b>
❌ Failure (4xx/5xx): <b>${data.fbclidFailure.toLocaleString()}</b>
📈 Success Rate: <b>${successPct}%</b> — ${statusText}

${data.hasIssue ? "⚠️ กรุณาตรวจสอบ Redirect Rules และ 404 URLs สำหรับ FB Traffic" : "FB Traffic ไหลเข้าเว็บได้ปกติ ✨"}
🔗 Dashboard: ${ENV.dashboardUrl}`;
}

// ─── V5.1: Cache MISS Pattern Report ─────────────────────────────────────────
export function buildCacheMissReport(data: {
  topMissUrls: Array<{ url: string; missCount: number }>;
  totalMissRequests: number;
  totalRequests: number;
  missRate: number;
  hasHighMissRate: boolean;
}): string {
  const missRatePct = (data.missRate * 100).toFixed(1);
  const statusIcon = data.hasHighMissRate ? "⚠️" : "✅";
  const statusText = data.hasHighMissRate ? "MISS Rate สูงกว่า 20% — ควรตรวจสอบ Cache Rules" : "Cache MISS อยู่ในระดับปกติ";
  let msg = `${statusIcon} <b>[NCR V5.1] Cache MISS Pattern Analysis (6h)</b>\n`;
  msg += `📊 Total Requests: ${data.totalRequests.toLocaleString()} | MISS: ${data.totalMissRequests.toLocaleString()} (${missRatePct}%)\n`;
  msg += `${statusText}\n`;
  if (data.topMissUrls.length > 0) {
    msg += `\n🔍 <b>Top URLs ที่ทำให้ TTFB พีค:</b>\n`;
    data.topMissUrls.slice(0, 5).forEach((u, i) => {
      msg += `${i + 1}. <code>${u.url}</code> — ${u.missCount.toLocaleString()} MISS\n`;
    });
  }
  msg += `\n🔗 <a href="${ENV.dashboardUrl}">ดู Dashboard</a>`;
  return msg;
}

// ─── V5.2: WordPress DB Latency Alert ────────────────────────────────────────
export function buildWpDbLatencyAlert(latencyMs: number, status: "slow" | "critical"): string {
  const icon = status === "critical" ? "🔴" : "🟡";
  const label = status === "critical" ? "วิกฤต (CRITICAL)" : "ช้า (SLOW)";
  const threshold = status === "critical" ? "≥ 1,000ms" : "≥ 500ms";
  const advice = status === "critical"
    ? "⚠️ แนะนำให้ตรวจสอบ MySQL/MariaDB และ WP Cron ทันที"
    : "💡 แนะนำให้พักการรันรูปภาพ (EWWW) และตรวจสอบ Query Cache";
  return (
    `${icon} <b>[NCR V5.2] WordPress DB ช้าผิดปกติ!</b>\n` +
    `⏱ Latency: <b>${latencyMs}ms</b> (${threshold})\n` +
    `สถานะ: ${label}\n` +
    `${advice}\n` +
    `🔗 <a href="${ENV.dashboardUrl}">ดู Dashboard</a>`
  );
}

// ─── V7.0: PageSpeed Payload Alert ───────────────────────────────────────────
export function buildPageSpeedPayloadAlert(pageSizeMb: number): string {
  const sizeFmt = pageSizeMb.toFixed(2);
  return (
    `🔴 <b>[NCR V7.0] Page Payload เกินขีดจำกัด!</b>\n` +
    `📦 Page Size: <b>${sizeFmt} MB</b> (เกิน 5 MB)\n` +
    `⚠️ ขนาดหน้าเว็บใหญ่เกินไปอาจทำให้ผู้ใช้มือถือโหลดช้า\n` +
    `💡 แนะนำ: บีบอัดรูปภาพ, เปิด lazy load, ลด JS/CSS ที่ไม่จำเป็น\n` +
    `🔗 <a href="${ENV.dashboardUrl}">ดู Dashboard</a>`
  );
}

// ─── V8.0: Advanced Watchdog Alert Builders ────────────────────────────────
export function buildArticleSpikeAlert(spikes: { url: string; views: number; fullUrl?: string }[]): string {
  let msg = `🚀 <b>NCR Traffic Spike Alert</b>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `พบข่าวที่มีผู้เข้าชมสูงผิดปกติใน 1 ชั่วโมงล่าสุด\n\n`;
  for (const item of spikes.slice(0, 5)) {
    const url = item.fullUrl ?? item.url;
    msg += `• <b>${item.views.toLocaleString()}</b> views — ${url}\n`;
  }
  msg += `\nคำแนะนำ: ตรวจสอบ Cache Hit, origin load และความพร้อมของบทความที่กำลัง viral`;
  return msg;
}

export function buildBruteForceLoginAlert(offenders: { ip: string; attempts: number; topPath: string }[]): string {
  let msg = `🛡️ <b>NCR Brute-Force Login Alert</b>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `พบ IP พยายาม login/admin ผิดพลาดสูงใน 15 นาทีล่าสุด\n\n`;
  for (const item of offenders.slice(0, 5)) {
    msg += `• <code>${item.ip}</code> — <b>${item.attempts.toLocaleString()}</b> attempts (${item.topPath})\n`;
  }
  msg += `\nระบบยังไม่ block อัตโนมัติจากสัญญาณนี้ เพื่อหลีกเลี่ยง false positive; ใช้คู่กับ Auto-Ban 404 เดิมสำหรับกรณีโจมตีชัดเจน`;
  return msg;
}

export function buildGoogleIndexingReport(result: { skipped: boolean; reason?: string; results: { url: string; verdict: string; coverageState?: string; lastCrawlTime?: string; message?: string }[] }): string {
  if (result.skipped) {
    return `🔎 <b>NCR Google Index Monitor</b>\n━━━━━━━━━━━━━━━━━━━━━━\nSkipped: ${result.reason ?? "not configured"}`;
  }
  const indexed = result.results.filter((item) => item.verdict === "indexed").length;
  const needsAttention = result.results.filter((item) => item.verdict !== "indexed");
  let msg = `🔎 <b>NCR Google Index Monitor</b>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `Indexed: <b>${indexed}/${result.results.length}</b> URLs\n`;
  if (needsAttention.length > 0) {
    msg += `\n<b>Needs attention:</b>\n`;
    for (const item of needsAttention.slice(0, 5)) {
      msg += `• <code>${item.url}</code> — ${item.coverageState ?? item.message ?? item.verdict}\n`;
    }
  } else {
    msg += `\nAll monitored URLs are indexed or reported as indexed by Google Search Console.`;
  }
  return msg;
}
