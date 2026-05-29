export interface CloudflareFunctionEnv {
  TELEGRAM_CHAT_IDS?: string;
  BACKEND_ORIGIN?: string;
  CLOUDFLARE_ZONE_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
}

// ── 1. ฟังก์ชันดึงข้อมูลวิเคราะห์โพสต์ยอดนิยม (Top Posts Analytics) ──
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
    return { 
      posts: posts.map((p: any) => ({ ...p, pct: Math.round((p.count / maxCount) * 100) })), 
      available: true 
    };
  } catch (err) {
    return { posts: [], available: false, error: String(err) };
  }
}

// ── 2. ฟังก์ชันดึงข้อมูลสถิติ Cloudflare Cache Hit ──
async function handleCfAnalytics(env: CloudflareFunctionEnv) {
  const zoneId = env.CLOUDFLARE_ZONE_ID;
  const apiToken = env.CLOUDFLARE_API_TOKEN;
  if (!zoneId || !apiToken) return { cacheHitRatio: "0", totalRequests: 0, history: [] };

  const query = JSON.stringify({
    query: `query GetAnalytics($zoneTag: String!) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          httpRequests1hGroups(limit: 24, filter: { datetime_gt: "${new Date(Date.now() - 86400000).toISOString()}" }) {
            sum { requests, cachedRequests }
            dimensions { datetime }
          }
        }
      }
    }`,
    variables: { zoneTag: zoneId }
  });

  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiToken}`, "Content-Type": "application/json" },
      body: query
    });
    const json: any = await res.json();
    const stats = json?.data?.viewer?.zones[0]?.httpRequests1hGroups || [];
    
    const total = stats.reduce((acc: number, s: any) => acc + (s.sum.requests || 0), 0);
    const cached = stats.reduce((acc: number, s: any) => acc + (s.sum.cachedRequests || 0), 0);

    return {
      cacheHitRatio: total > 0 ? Math.round((cached / total) * 100).toString() : "0",
      totalRequests: total,
      history: stats
    };
  } catch {
    return { cacheHitRatio: "0", history: [] };
  }
}

// ── 3. ฟังก์ชันควบคุมการกระจายท่อข้อมูล (Procedure Router) ──
async function handleProcedure(proc: string, search: string, env: CloudflareFunctionEnv) {
  // ดักจับเส้นโพสต์ยอดนิยมตัวใหม่
  if (proc.includes("monitor.topPosts")) {
    return await handleTopPosts(env);
  }
  // ดักจับเส้นสถิติหลัก Cloudflare
  if (proc.includes("monitor.cfAnalytics")) {
    return await handleCfAnalytics(env);
  }
  // ดักจับเส้นการตั้งค่า Telegram
  if (proc.includes("monitor.telegramConfig")) {
    return { 
      recipients: env.TELEGRAM_CHAT_IDS || "8674647124", 
      status: "connected", 
      updatedAt: new Date().toISOString() 
    };
  }

  // หากไม่ตรงเงื่อนไขใดๆ ด้านบน ให้ยิงข้ามไปขอข้อมูลประวัติจาก Backend Worker ตัวจริง
  return await proxyToBackend(proc, search, env);
}

// ── 4. Main Entry Point สำหรับ Cloudflare Pages Functions ──
export const onRequest: PagesFunction<CloudflareFunctionEnv> = async (context) => {
  const url = new URL(context.request.url);
  const isBatch = url.searchParams.has("batch");
  const pathSegment = url.pathname.split("/api/trpc/")[1] || "";
  const procedures = pathSegment.split(",").map(p => p.trim()).filter(Boolean);

  if (procedures.length === 0) {
    return new Response(JSON.stringify({ result: { data: [] } }), { headers: { "Content-Type": "application/json" } });
  }

  if (isBatch) {
    const results = await Promise.all(
      procedures.map(async p => ({ result: { data: await handleProcedure(p, url.search, context.env) } }))
    );
    return new Response(JSON.stringify(results), { headers: { "Content-Type": "application/json" } });
  }

  const data = await handleProcedure(procedures[0], url.search, context.env);
  return new Response(JSON.stringify({ result: { data } }), { headers: { "Content-Type": "application/json" } });
};

// ── 5. ท่อ Proxy สำรองยิงไปหาตัว Backend ──
async function proxyToBackend(proc: string, search: string, env: CloudflareFunctionEnv) {
  const backendOrigin = env.BACKEND_ORIGIN || "https://ncr-watchdog-backend.kannaphong-k.workers.dev";
  try {
    const res = await fetch(`${backendOrigin}/api/trpc/${proc}${search}`);
    const json: any = await res.json();
    return json?.result?.data || [];
  } catch {
    return [];
  }
}
