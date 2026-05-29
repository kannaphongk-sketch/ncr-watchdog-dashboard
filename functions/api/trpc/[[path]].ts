// ── เพิ่มใน handleProcedure ใน functions/api/trpc/[[path]].ts ──
// หาบรรทัด: if (proc.includes("monitor.cfAnalytics")) return handleCfAnalytics(env);
// เพิ่มต่อจากบรรทัดนั้น:

  if (proc.includes("monitor.topPosts")) return handleTopPosts(env);

// และเพิ่มฟังก์ชัน handleTopPosts ก่อน handleProcedure:

async function handleTopPosts(env: CloudflareFunctionEnv) {
  const zoneId = env.CLOUDFLARE_ZONE_ID;
  const apiToken = env.CLOUDFLARE_API_TOKEN;
  if (!zoneId || !apiToken) return { posts: [], available: false };
  try {
    const hoursBack = 23;
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
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
