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
            orderBy: [date_DESC]
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

async function handleProcedure(proc: string, env: CloudflareFunctionEnv): Promise<unknown> {
  if (proc.includes("monitor.telegramConfig")) {
    const chatIds = normalizeTelegramChatIds(env);
    const botToken = getTelegramBotToken(env);
    return { configured: chatIds.length > 0, botConfigured: Boolean(botToken), chatIds, status: "configured" };
  }
  if (proc.includes("monitor.quickStatus")) return handleQuickStatus(env);
  if (proc.includes("monitor.runCheck")) { const d = await handleQuickStatus(env); return { ...d, alertsFired: [], autoFixApplied: false }; }
  if (proc.includes("monitor.cfAnalytics")) return handleCfAnalytics(env);
  if (proc.includes("monitor.purgeCache")) return handlePurgeCache(env);
  if (proc.includes("monitor.sendTestReport")) return handleSendTestReport(env);
  if (proc.includes("monitor.history")) return [];
  if (proc.includes("monitor.alerts")) return [];
  if (proc.includes("monitor.schedulerStatus")) return { currentBangkokTime: new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }), schedules: [] };
  if (proc.includes("monitor.securityLevel")) return { level: "medium" };
  if (proc.includes("monitor.activeBrokenLinksCount")) return { count: 0 };
  if (proc.includes("monitor.brokenLinks")) return [];
  if (proc.includes("monitor.cacheDiagnostic")) return null;
  if (proc.includes("monitor.cacheHistory")) return [];
  if (proc.includes("monitor.summary")) return {};
  if (proc.includes("wpSentinel.getV6Data")) return { operatingMode: "Autonomous Caretaker Active", wpStatus: "ok", wpHealth: "stable", dbLatencyMs: 0, memoryUsageMb: 0, memoryStatus: "optimal", diskFreeGb: 0, diskSystemManaged: true, optimizedImages: 0, totalImages: 0, verified404: 0, cacheStatusLabel: "Cache Status: Checking", statusCritical: false, healthAlert: false, lastSystemCheck: null };
  if (proc.includes("wpSentinel.getLatencyTimeline")) return [];
  return [];
}
