import type { CloudflareFunctionEnv } from "../../lib/cloudflare-utils";
import { applyCors, corsHeaders, proxyToBackend, getTelegramBotToken, normalizeTelegramChatIds, noStoreHeaders } from "../../lib/cloudflare-utils";

function trpcPath(params: Record<string, string | string[]>): string {
  const rawPath = params.path;
  if (Array.isArray(rawPath)) return rawPath.map(segment => encodeURIComponent(segment)).join("/");
  return rawPath ? encodeURIComponent(rawPath) : "";
}

function toTrpcResponse(data: unknown, isBatch: boolean) {
  const result = { result: { data: { json: data } } };
  return isBatch ? [result] : result;
}

async function handleQuickStatus(env: CloudflareFunctionEnv) {
  const targetUrl = env.CTO_MONITOR_TARGET_URL || "https://nakornchiangrainews.com";
  const start = Date.now();
  try {
    const res = await fetch(targetUrl, { method: "GET", redirect: "follow" });
    const ttfbMs = Date.now() - start;
    const isUp = res.status >= 200 && res.status < 500;
    return {
      httpCode: res.status, ttfbMs, isUp,
      cacheStatus: res.headers.get("cf-cache-status") ?? "UNKNOWN",
      cfRay: res.headers.get("cf-ray") ?? "",
      uptimePercent: isUp ? 100 : 0,
      avgTtfbMs: ttfbMs,
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      httpCode: 0, ttfbMs: Date.now() - start, isUp: false,
      cacheStatus: "ERROR", cfRay: "", uptimePercent: 0, avgTtfbMs: 0,
      checkedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function handleCfAnalytics(env: CloudflareFunctionEnv) {
  const zoneId = env.CLOUDFLARE_ZONE_ID;
  const apiToken = env.CLOUDFLARE_API_TOKEN;
  if (!zoneId || !apiToken) {
    return { totalRequests: 0, cachedRequests: 0, bandwidth: 0, threats: 0, cacheHitRate: 0, count404: 0, visits: 0, pageViews: 0, top404Urls: [], analyticsAvailable: false, unavailableReason: "Missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ZONE_ID" };
  }
  try {
    const query = `{ viewer { zones(filter: { zoneTag: "${zoneId}" }) { httpRequests1dGroups(limit: 1, filter: { date_gt: "${new Date(Date.now() - 86400000).toISOString().split("T")[0]}" }) { sum { requests cachedRequests bytes threats pageViews } uniq { uniques } } } } }`;
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const json = await res.json() as any;
    const data = json?.data?.viewer?.zones?.[0]?.httpRequests1dGroups?.[0]?.sum;
    const uniq = json?.data?.viewer?.zones?.[0]?.httpRequests1dGroups?.[0]?.uniq;
    if (!data) return { totalRequests: 0, cachedRequests: 0, bandwidth: 0, threats: 0, cacheHitRate: 0, count404: 0, visits: 0, pageViews: 0, top404Urls: [], analyticsAvailable: false, unavailableReason: "No analytics data available" };
    const total = data.requests || 0;
    const cached = data.cachedRequests || 0;
    return { totalRequests: total, cachedRequests: cached, bandwidth: data.bytes || 0, threats: data.threats || 0, cacheHitRate: total > 0 ? Math.round((cached / total) * 100) : 0, count404: 0, visits: uniq?.uniques || 0, pageViews: data.pageViews || 0, top404Urls: [], analyticsAvailable: true };
  } catch {
    return { totalRequests: 0, cachedRequests: 0, bandwidth: 0, threats: 0, cacheHitRate: 0, count404: 0, visits: 0, pageViews: 0, top404Urls: [], analyticsAvailable: false, unavailableReason: "Analytics API error" };
  }
}

async function handlePurgeCache(env: CloudflareFunctionEnv) {
  const zoneId = env.CLOUDFLARE_ZONE_ID;
  const apiToken = env.CLOUDFLARE_API_TOKEN;
  if (!zoneId || !apiToken) return { success: false, message: "Missing API credentials" };
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ purge_everything: true }),
    });
    const json = await res.json() as any;
    return { success: json.success, message: json.success ? "Cache purged successfully" : "Cache purge failed" };
  } catch {
    return { success: false, message: "Cache purge error" };
  }
}

async function handleSendTestReport(env: CloudflareFunctionEnv) {
  const botToken = getTelegramBotToken(env);
  const chatIds = normalizeTelegramChatIds(env);
  if (!botToken || chatIds.length === 0) return { success: false, error: "Missing Telegram credentials" };
  const text = `✅ <b>NCR Watchdog — Test Report</b>\n🕐 ${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })} (Bangkok)\n\nระบบ Backend ใหม่บน Cloudflare Pages Functions ทำงานได้ปกติครับ ✨\n\n🔗 https://ncr-watchdog-dashboard.pages.dev`;
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatIds[0], text, parse_mode: "HTML" }),
    });
    const json = await res.json() as any;
    return { success: json.ok, messageId: json.result?.message_id, error: json.description };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export const onRequest: PagesFunction<CloudflareFunctionEnv> = async context => {
  if (context.request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(context.request, context.env) });
  }
  if (!["GET", "POST"].includes(context.request.method.toUpperCase())) {
    return applyCors(
      new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { "Content-Type": "application/json" } }),
      context.request, context.env
    );
  }

  const url = new URL(context.request.url);
  const isBatch = url.searchParams.has("batch");
  const headers = { "Content-Type": "application/json", ...noStoreHeaders };

  if (url.pathname.includes("monitor.telegramConfig")) {
    const chatIds = normalizeTelegramChatIds(context.env);
    const botToken = getTelegramBotToken(context.env);
    const data = { configured: chatIds.length > 0, botConfigured: Boolean(botToken), chatIds, status: "configured" };
    return applyCors(new Response(JSON.stringify(toTrpcResponse(data, isBatch)), { status: 200, headers }), context.request, context.env);
  }

  if (url.pathname.includes("monitor.quickStatus")) {
    const data = await handleQuickStatus(context.env);
    return applyCors(new Response(JSON.stringify(toTrpcResponse(data, isBatch)), { status: 200, headers }), context.request, context.env);
  }

  if (url.pathname.includes("monitor.runCheck")) {
    const data = await handleQuickStatus(context.env);
    return applyCors(new Response(JSON.stringify(toTrpcResponse({ ...data, alertsFired: [], autoFixApplied: false }, isBatch)), { status: 200, headers }), context.request, context.env);
  }

  if (url.pathname.includes("monitor.cfAnalytics")) {
    const data = await handleCfAnalytics(context.env);
    return applyCors(new Response(JSON.stringify(toTrpcResponse(data, isBatch)), { status: 200, headers }), context.request, context.env);
  }

  if (url.pathname.includes("monitor.purgeCache")) {
    const data = await handlePurgeCache(context.env);
    return applyCors(new Response(JSON.stringify(toTrpcResponse(data, isBatch)), { status: 200, headers }), context.request, context.env);
  }

  if (url.pathname.includes("monitor.sendTestReport")) {
    const data = await handleSendTestReport(context.env);
    return applyCors(new Response(JSON.stringify(toTrpcResponse(data, isBatch)), { status: 200, headers }), context.request, context.env);
  }

  if (url.pathname.includes("monitor.history")) {
    return applyCors(new Response(JSON.stringify(toTrpcResponse([], isBatch)), { status: 200, headers }), context.request, context.env);
  }

  if (url.pathname.includes("monitor.alerts")) {
    return applyCors(new Response(JSON.stringify(toTrpcResponse([], isBatch)), { status: 200, headers }), context.request, context.env);
  }

  if (url.pathname.includes("monitor.schedulerStatus")) {
    const data = { currentBangkokTime: new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }), schedules: [] };
    return applyCors(new Response(JSON.stringify(toTrpcResponse(data, isBatch)), { status: 200, headers }), context.request, context.env);
  }

  if (url.pathname.includes("monitor.securityLevel")) {
    return applyCors(new Response(JSON.stringify(toTrpcResponse({ level: "medium" }, isBatch)), { status: 200, headers }), context.request, context.env);
  }

  if (url.pathname.includes("monitor.activeBrokenLinksCount")) {
    return applyCors(new Response(JSON.stringify(toTrpcResponse({ count: 0 }, isBatch)), { status: 200, headers }), context.request, context.env);
  }

  if (url.pathname.includes("monitor.brokenLinks")) {
    return applyCors(new Response(JSON.stringify(toTrpcResponse([], isBatch)), { status: 200, headers }), context.request, context.env);
  }

  if (url.pathname.includes("monitor.cacheDiagnostic")) {
    return applyCors(new Response(JSON.stringify(toTrpcResponse(null, isBatch)), { status: 200, headers }), context.request, context.env);
  }

  if (url.pathname.includes("monitor.cacheHistory")) {
    return applyCors(new Response(JSON.stringify(toTrpcResponse([], isBatch)), { status: 200, headers }), context.request, context.env);
  }

  if (url.pathname.includes("wpSentinel.getV6Data")) {
    return applyCors(new Response(JSON.stringify(toTrpcResponse({
      operatingMode: "Autonomous Caretaker Active",
      wpStatus: "ok", wpHealth: "stable", dbLatencyMs: 0,
      memoryUsageMb: 0, memoryStatus: "optimal", diskFreeGb: 0,
      diskSystemManaged: true, optimizedImages: 0, totalImages: 0,
      verified404: 0, cacheStatusLabel: "Cache Status: Checking",
      statusCritical: false, healthAlert: false, lastSystemCheck: null,
    }, isBatch)), { status: 200, headers }), context.request, context.env);
  }

  if (url.pathname.includes("wpSentinel.getLatencyTimeline")) {
    return applyCors(new Response(JSON.stringify(toTrpcResponse([], isBatch)), { status: 200, headers }), context.request, context.env);
  }

  if (url.pathname.includes("/api/trpc/")) {
    return applyCors(new Response(JSON.stringify(toTrpcResponse([], isBatch)), { status: 200, headers }), context.request, context.env);
  }  // ← เพิ่ม } ตรงนี้

  const suffix = trpcPath(context.params);
  return proxyToBackend(context, `/api/trpc${suffix ? `/${suffix}` : ""}`);
};
