export const onRequest: PagesFunction<{
  TELEGRAM_CHAT_IDS?: string;
  BACKEND_ORIGIN?: string;
  CLOUDFLARE_ZONE_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
}> = async (context) => {
  const url = new URL(context.request.url);
  const isBatch = url.searchParams.get('batch') === '1';

  const trpcPrefix = '/api/trpc/';
  const trpcIndex = url.pathname.indexOf(trpcPrefix);
  if (trpcIndex === -1) return fallbackProxy(context, url);

  const pathStr = url.pathname.substring(trpcIndex + trpcPrefix.length);
  const requestedEndpoints = pathStr.split(',').map(e => e.trim()).filter(Boolean);

  const generateMockResponse = async (endpoint: string) => {
    // 🎯 1. แก้ไขส่วน Analytics ให้ส่งทั้ง % และ List
    if (endpoint.includes('monitor.cfAnalytics')) {
      const zoneId = context.env.CLOUDFLARE_ZONE_ID;
      const apiToken = context.env.CLOUDFLARE_API_TOKEN;

      if (!zoneId || !apiToken) {
        return { result: { data: { cacheHitRatio: "0", history: [] } } };
      }

      try {
        const query = JSON.stringify({
          query: `query GetCache($zoneTag: String!) {
            viewer {
              zones(filter: { zoneTag: $zoneTag }) {
                httpRequests1hGroups(limit: 24, filter: { datetime_gt: "${new Date(Date.now() - 86400000).toISOString()}" }) {
                  sum { requests, cachedRequests }
                }
              }
            }
          }`,
          variables: { zoneTag: zoneId }
        });

        const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
          body: query
        });

        const cfData: any = await res.json();
        const stats = cfData?.data?.viewer?.zones[0]?.httpRequests1hGroups || [];
        
        const total = stats.reduce((acc: any, s: any) => acc + (s.sum.requests || 0), 0);
        const cached = stats.reduce((acc: any, s: any) => acc + (s.sum.cachedRequests || 0), 0);
        const ratio = total > 0 ? Math.round((cached / total) * 100) : 0;

        return {
          result: {
            data: {
              cacheHitRatio: ratio.toString(), // ส่งเป็น String กันเหนียว .toString()
              history: stats,
              status: "success"
            }
          }
        };
      } catch (e) {
        return { result: { data: { cacheHitRatio: "0", history: [] } } };
      }
    }

    // 🎯 2. ส่วน Telegram Recipients (ต้องมีค่าเสมอ)
    if (endpoint.includes('monitor.telegramConfig')) {
      return {
        result: {
          data: {
            recipients: (context.env.TELEGRAM_CHAT_IDS || "8674647124").toString(),
            status: "connected"
          }
        }
      };
    }

    // 🎯 3. กันหน้าจอแตกสำหรับส่วน List อื่นๆ
    return { result: { data: [] } };
  };

  if (isBatch) {
    const results = await Promise.all(requestedEndpoints.map(e => generateMockResponse(e)));
    return new Response(JSON.stringify(results), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  const result = await generateMockResponse(requestedEndpoints[0]);
  return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

async function fallbackProxy(context: any, url: URL) {
  const backendOrigin = context.env.BACKEND_ORIGIN || "https://ncr-watchdog-backend.kannaphong-k.workers.dev";
  try {
    return await fetch(new Request(new URL(url.pathname + url.search, backendOrigin).toString(), context.request));
  } catch (e) {
    return new Response(JSON.stringify({ result: { data: [] } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
}
