import { analyzeCacheDiagnostic } from "../../server/cacheDiagnostic";
import { saveAlert, saveCacheDiagnostic, saveMonitorCheck } from "../../server/db";
import { sendTelegramMessage } from "../../server/telegram";

const TARGET_URL = process.env.CTO_MONITOR_TARGET_URL ?? "https://nakornchiangrainews.com";
const LATENCY_THRESHOLD_MS = Number(process.env.CTO_MONITOR_LATENCY_THRESHOLD_MS ?? "2000");
const REQUEST_TIMEOUT_MS = Number(process.env.CTO_MONITOR_TIMEOUT_MS ?? "10000");

const htmlEscape = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const formatBangkokTime = (date = new Date()) =>
  date.toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

const buildMonitorAlert = (params: {
  reason: "downtime" | "high_latency" | "timeout" | "network_error";
  statusCode?: number;
  latencyMs: number;
  error?: string;
  nextRun?: string;
}) => {
  const reasonLabel: Record<typeof params.reason, string> = {
    downtime: "DOWNTIME DETECTED",
    high_latency: "HIGH LATENCY DETECTED",
    timeout: "MONITOR TIMEOUT",
    network_error: "NETWORK ERROR",
  };

  const statusLine = params.statusCode === undefined ? "Unavailable" : String(params.statusCode);
  const errorLine = params.error ? `\nError: <code>${htmlEscape(params.error)}</code>` : "";
  const nextRunLine = params.nextRun ? `\nNext scheduled check: <code>${htmlEscape(params.nextRun)}</code>` : "";

  return `🔴 <b>NCR Watchdog — ${reasonLabel[params.reason]}</b>
🕐 ${formatBangkokTime()} (Bangkok)
🌐 <a href="${htmlEscape(TARGET_URL)}">${htmlEscape(TARGET_URL)}</a>

HTTP Status: <code>${htmlEscape(statusLine)}</code>
Response Time / TTFB: <code>${Math.round(params.latencyMs)}ms</code>
Threshold: <code>${LATENCY_THRESHOLD_MS}ms</code>${errorLine}${nextRunLine}

<b>Action Required:</b> Please inspect Cloudflare, Hostatom origin health, and recent WordPress activity.
<b>🔗 Dashboard:</b> ${htmlEscape(process.env.DASHBOARD_URL ?? "https://gorgeous-treacle-ebe178.netlify.app")}`;
};

const parseNextRun = async (req: Request) => {
  try {
    const event = (await req.json()) as { next_run?: string };
    return event.next_run;
  } catch {
    return undefined;
  }
};

export default async (req: Request) => {
  const nextRun = await parseNextRun(req);
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(TARGET_URL, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7",
      },
    });

    const latencyMs = Date.now() - startedAt;
    const cacheStatus = response.headers.get("cf-cache-status") ?? "UNKNOWN";
    const cfRay = response.headers.get("cf-ray") ?? "";
    const cacheControl = response.headers.get("cache-control") ?? "";
    const vary = response.headers.get("vary") ?? "";
    const setCookieHeader = response.headers.get("set-cookie") ?? "";

    await saveMonitorCheck({
      httpCode: response.status,
      ttfbMs: Math.round(latencyMs),
      cacheStatus,
      cfRay,
      isUp: response.status === 200 || response.status === 403,
      createdAt: new Date(),
    });
    await saveCacheDiagnostic(analyzeCacheDiagnostic(cacheStatus, cacheControl, vary, setCookieHeader));

    const isHomepageOnline = response.status === 200 || response.status === 403;

    if (response.status === 403 || response.status === 520) {
      await saveAlert({
        alertType: response.status === 403 ? "security" : "downtime",
        message: response.status === 403 ? "Cloudflare 403 challenge/guard response recorded by CTO monitor" : "Cloudflare 520 origin error recorded by CTO monitor",
        autoFixApplied: false,
        httpCode: response.status,
        ttfbMs: Math.round(latencyMs),
        resolved: false,
        pendingPurge: false,
        createdAt: new Date(),
      });
    }

    if (!isHomepageOnline) {
      const alert = buildMonitorAlert({
        reason: "downtime",
        statusCode: response.status,
        latencyMs,
        nextRun,
      });
      if (response.status !== 520) {
        await saveAlert({
          alertType: "downtime",
          message: `CTO monitor downtime detected with HTTP ${response.status}`,
          autoFixApplied: false,
          httpCode: response.status,
          ttfbMs: Math.round(latencyMs),
          resolved: false,
          pendingPurge: true,
          createdAt: new Date(),
        });
      }
      const result = await sendTelegramMessage(alert);
      console.log("CTO monitor alert result", { success: result.success, reason: "downtime", status: response.status, latencyMs });
    } else if (latencyMs > LATENCY_THRESHOLD_MS) {
      const alert = buildMonitorAlert({
        reason: "high_latency",
        statusCode: response.status,
        latencyMs,
        nextRun,
      });
      await saveAlert({
        alertType: "high_latency",
        message: `CTO monitor high latency detected at ${Math.round(latencyMs)}ms`,
        autoFixApplied: false,
        httpCode: response.status,
        ttfbMs: Math.round(latencyMs),
        resolved: false,
        pendingPurge: true,
        createdAt: new Date(),
      });
      const result = await sendTelegramMessage(alert);
      console.log("CTO monitor alert result", { success: result.success, reason: "high_latency", status: response.status, latencyMs });
    } else {
      console.log("CTO monitor healthy", {
        status: response.status,
        latencyMs,
        thresholdMs: LATENCY_THRESHOLD_MS,
        method: "HEAD",
        cloudflareChallengeAccepted: response.status === 403,
      });
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const reason = error instanceof Error && error.name === "AbortError" ? "timeout" : "network_error";
    await saveMonitorCheck({
      httpCode: 0,
      ttfbMs: Math.round(latencyMs),
      cacheStatus: "ERROR",
      cfRay: "",
      isUp: false,
      createdAt: new Date(),
    });
    await saveAlert({
      alertType: "downtime",
      message: `CTO monitor ${reason.replace("_", " ")}: ${errorMessage}`,
      autoFixApplied: false,
      httpCode: 0,
      ttfbMs: Math.round(latencyMs),
      resolved: false,
      pendingPurge: true,
      createdAt: new Date(),
    });
    await saveCacheDiagnostic({
      cfCacheStatus: "ERROR",
      cacheControl: "",
      vary: "",
      wpCookiesDetected: "",
      potentialCause: errorMessage,
    });
    const alert = buildMonitorAlert({ reason, latencyMs, error: errorMessage, nextRun });
    const result = await sendTelegramMessage(alert);
    console.log("CTO monitor alert result", { success: result.success, reason, latencyMs, error: errorMessage });

    return new Response(null, { status: 204 });
  } finally {
    clearTimeout(timeout);
  }
};
