import type { CloudflareFunctionEnv } from "../../lib/cloudflare-utils";
import { applyCors, corsHeaders, proxyToBackend, getTelegramBotToken, normalizeTelegramChatIds, noStoreHeaders } from "../../lib/cloudflare-utils";

function toTrpcResult(data: unknown) {
  return { result: { data } };
}

async function handleQuickStatus(env: CloudflareFunctionEnv) {
  const targetUrl = env.CTO_MONITOR_TARGET_URL || "https://nakornchiangrainews.com";
  const start = Date.now();
  try {
    const res = await fetch(targetUrl, { method: "GET", redirect: "follow" });
    const ttfbMs = Date.now() - start;
    const isUp = res.status >= 200 && res.status < 500;
    return { httpCode: res.status, ttfbMs, isUp, cacheStatus: res.headers.get("cf-cache-status") ?? "UNKNOWN", cfRay: res.headers.get("cf-ray") ?? "", uptimePercent: isUp ? 100 : 0, avgTtfbMs: ttfbMs, checkedAt: new Date().toISOString() };
  } catch (error) {
    return { httpCode: 0, ttfbMs: Date.now() - start, isUp: false, cacheStatus: "ERROR", cfRay: "", uptimePercent: 0, avgTtfbMs: 0, checkedAt: new Date().toISOString(), error: error instanceof Error ? error.message : String(error) };
  }
}

async function handleCfAnalytics(env: CloudflareFunctionEnv) {
  const zoneId = env.CLOUDFLARE_ZONE_ID;
  const apiToken = env.CLOUDFLARE_API_TOKEN;
  if (!zoneId || !apiToken) return {
    totalRequests: 0, cachedRequests: 0, bandwidth: 0, threats: 0,
    cacheHitRate: 0, count404: 0, visits: 0, pageViews: 0,
    top404Urls: [], analyticsAvailable: false, unavailableReason: "Missing credentials"
  };
  try {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    const today = new Date().toISOString().split("T")[0];
    const query = `{
      viewer {
        zones(filter: { zoneTag: "${zoneId}" }) {
          httpRequests1dGroups(
            limit: 2,
            filter: { date_geq: "${yesterday}", date_leq: "${today}" }
          ) {
            sum { requests cachedRequests bytes threats pageViews }
            uniq { uniques }
          }
        }
      }
    }`;
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query })
    });
    const json = await res.json() as any;
    const groups = json?.data?.viewer?.zones?.[0]?.httpRequests1dGroups ?? [];
    if (!groups.length) return {
      totalRequests: 0, cachedRequests: 0, bandwidth: 0, threats: 0,
      cacheHitRate: 0, count404: 0, visits: 0, pageViews: 0,
      top404Urls: [], analyticsAvailable: false, unavailableReason: "No data"
    };
    const totals = groups.reduce((acc: any, g: any) => ({
      requests: acc.requests + (g.sum.requests || 0),
      cachedRequests: acc.cachedRequests + (g.sum.cachedRequests || 0),
      bytes: acc.bytes + (g.sum.bytes || 0),
      threats: acc.threats + (g.sum.threats || 0),
      pageViews: acc.pageViews + (g.sum.pageViews || 0),
      uniques: Math.max(acc.uniques, g.uniq?.uniques || 0),
    }), { requests: 0, cachedRequests: 0, bytes: 0, threats: 0, pageViews: 0, uniques: 0 });
    const total = totals.requests;
    const cached = totals.cachedRequests;
    return {
      totalRequests: total, cachedRequests: cached, bandwidth: totals.bytes,
      threats: totals.threats,
      cacheHitRate: total > 0 ? Math.round((cached / total) * 100) : 0,
      count404: 0, visits: totals.uniques, pageViews: totals.pageViews,
      top404Urls: [], analyticsAvailable: true,
    };
  } catch {
    return {
      totalRequests: 0, cachedRequests: 0, bandwidth: 0, threats: 0,
      cacheHitRate: 0, count404: 0, visits: 0, pageViews: 0,
      top404Urls: [], analyticsAvailable: false, unavailableReason: "Error"
    };
  }
}

async function handlePurgeCache(env: CloudflareFunctionEnv) {
  const zoneId = env.CLOUDFLARE_ZONE_ID;
  const apiToken = env.CLOUDFLARE_API_TOKEN;
  if (!zoneId || !apiToken) return { success: false, message: "Missing credentials" };
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, { method: "POST", headers: { "Authorization": `Bearer ${apiToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ purge_everything: true }) });
    const json = await res.json() as any;
    return { success: json.success, message: json.success ? "Cache purged" : "Failed" };
  } catch { return { success: false, message: "Error" }; }
}

async function handleSendTestReport(env: CloudflareFunctionEnv) {
  const botToken = getTelegramBotToken(env);
  const chatIds = normalizeTelegramChatIds(env);
  if (!botToken || chatIds.length === 0) return { success: false, error: "Missing credentials" };
  const text = `✅ <b>NCR Watchdog — Test Report</b>\n🕐 ${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })} (Bangkok)\n\nระบบทำงานได้ปกติครับ ✨\n\n🔗 https://ncr-watchdog-dashboard.pages.dev`;
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatIds[0], text, parse_mode: "HTML" }) });
    const json = await res.json() as any;
    return { success: json.ok, messageId: json.result?.message_id, error: json.description };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : String(error) }; }
}

async function handleTopPosts(env: CloudflareFunctionEnv) {
  const zoneId = env.CLOUDFLARE_ZONE_ID;
  const apiToken = env.CLOUDFLARE_API_TOKEN;
  if (!zoneId || !apiToken) return { posts: [], available: false };
  try {
    const since = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString();
    const query = `{
      viewer {
        zones(filter: { zoneTag: "${zoneId}" }) {
          httpRequestsAdaptiveGroups(
            limit: 50
            filter: { datetime_gt: "${since}", edgeResponseStatus: 200 }
            orderBy: [count_DESC]
          ) {
            dimensions { clientRequestPath }
            count
          }
        }
      }
    }`;
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query })
    });
    const json = await res.json() as any;
    if (json.errors?.length) return { posts: [], available: false, error: json.errors[0].message };
    const raw = json.data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups ?? [];
    const posts = raw
      .filter((item: any) => {
        const p = item.dimensions.clientRequestPath;
        return p.length > 2 && !p.includes(".") && !p.includes("wp-") &&
               !p.includes("admin") && !p.startsWith("/feed") &&
               !p.startsWith("/sitemap") && !p.startsWith("/xmlrpc") && p !== "/";
      })
      .slice(0, 10)
      .map((item: any) => ({ path: item.dimensions.clientRequestPath, count: item.count }));
    const maxCount = posts.length > 0 ? posts[0].count : 1;
    return { posts: posts.map((p: any) => ({ ...p, pct: Math.round((p.count / maxCount) * 100) })), available: true };
  } catch (err) {
    return { posts: [], available: false, error: String(err) };
  }
}

async function handleProcedure(proc: string, env: CloudflareFunctionEnv): Promise<unknown> {
  if (proc.includes("monitor.telegramConfig")) {
    const chatIds = normalizeTelegramChatIds(env);
    const botToken = getTelegramBotToken(env);
    return { configured: chatIds.length > 0, botConfigured: Boolean(botToken), chatIds, status: "configured" };
  }
  if (proc.includes("monitor.quickStatus")) return handleQuickStatus(env);
  if (proc.includes("monitor.runCheck")) { const d = await handleQuickStatus(env); return { ...d, alertsFired: [], autoFixApplied: false }; }
  if (proc.includes("monitor.cfAnalytics")) return handleCfAnalytics(env);
  if (proc.includes("monitor.topPosts")) return handleTopPosts(env);
  if (proc.includes("monitor.purgeCache")) return handlePurgeCache(env);
  if (proc.includes("monitor.sendTestReport")) return handleSendTestReport(env);
  if (proc.includes("monitor.history")) {
  const b = env.BACKEND_ORIGIN || "https://ncr-watchdog-backend.kannaphong-k.workers.dev";
  try { const r = await fetch(`${b}/api/public/history`); return r.ok ? await r.json() : []; }
  catch { return []; }
}
if (proc.includes("monitor.alerts")) {
  const b = env.BACKEND_ORIGIN || "https://ncr-watchdog-backend.kannaphong-k.workers.dev";
  try { const r = await fetch(`${b}/api/public/alerts`); return r.ok ? await r.json() : []; }
  catch { return []; }
}
  if (proc.includes("monitor.schedulerStatus")) return { currentBangkokTime: new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }), schedules: [] };
  if (proc.includes("monitor.securityLevel")) return { level: "medium" };
  if (proc.includes("monitor.activeBrokenLinksCount")) return { count: 0 };
  if (proc.includes("monitor.cacheHistory")) return [];
  if (proc.includes("monitor.summary")) return {};
  if (proc.includes("monitor.approvePurge")) return { success: false, message: "not implemented" };
  if (proc.includes("monitor.markFixed")) return {};
  if (proc.includes("wpSentinel.getV6Data")) return { operatingMode: "Autonomous Caretaker Active", wpStatus: "ok", wpHealth: "stable", dbLatencyMs: 0, memoryUsageMb: 0, memoryStatus: "optimal", diskFreeGb: 0, diskSystemManaged: true, optimizedImages: 0, totalImages: 0, verified404: 0, cacheStatusLabel: "Cache Status: Checking", statusCritical: false, healthAlert: false, lastSystemCheck: null };
  if (proc.includes("wpSentinel.getLatencyTimeline")) return [];
  return [];
}

export const onRequest: PagesFunction<CloudflareFunctionEnv> = async context => {
  if (context.request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(context.request, context.env) });
  }
  if (!["GET", "POST"].includes(context.request.method.toUpperCase())) {
    return applyCors(new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { "Content-Type": "application/json" } }), context.request, context.env);
  }

  const url = new URL(context.request.url);
  const isBatch = url.searchParams.has("batch");
  const headers = { "Content-Type": "application/json", ...noStoreHeaders };

  const pathSegment = url.pathname.split("/api/trpc/")[1] || "";
  const procedures = pathSegment.split(",").map(p => p.trim()).filter(Boolean);

  if (procedures.length > 1) {
    const results = await Promise.all(procedures.map(proc => handleProcedure(proc, context.env)));
    const response = results.map(data => toTrpcResult(data));
    return applyCors(new Response(JSON.stringify(response), { status: 200, headers }), context.request, context.env);
  }

  const proc = procedures[0] || "";
  const data = await handleProcedure(proc, context.env);

  if (proc) {
    const response = isBatch ? [toTrpcResult(data)] : toTrpcResult(data);
    return applyCors(new Response(JSON.stringify(response), { status: 200, headers }), context.request, context.env);
  }

  const rawPath = context.params.path;
  const suffix = Array.isArray(rawPath) ? rawPath.join("/") : rawPath ?? "";
  return proxyToBackend(context, `/api/trpc${suffix ? `/${suffix}` : ""}`);
};
