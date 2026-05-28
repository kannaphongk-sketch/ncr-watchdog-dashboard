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
