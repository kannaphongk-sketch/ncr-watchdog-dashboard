export const onRequest: PagesFunction<{
  TELEGRAM_CHAT_IDS?: string;
  BACKEND_ORIGIN?: string;
  CLOUDFLARE_ZONE_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
}> = async (context) => {
  const url = new URL(context.request.url);
  const isBatch = url.searchParams.get('batch') === '1';

  // 1. สกัดแยก Path ของ tRPC ออกมาดู
  const trpcPrefix = '/api/trpc/';
  const trpcIndex = url.pathname.indexOf(trpcPrefix);
  
  if (trpcIndex === -1) {
    return fallbackProxy(context, url);
  }

  const pathStr = url.pathname.substring(trpcIndex + trpcPrefix.length);
  const requestedEndpoints = pathStr.split(',').map(e => e.trim()).filter(Boolean);

  if (requestedEndpoints.length === 0) {
    return fallbackProxy(context, url);
  }

  // 2. ฟังก์ชันจำลองและดึงข้อมูลรายตัว (รองรับการดึงข้อมูลจริงจาก Cloudflare API)
  const generateMockResponse = async (endpoint: string) => {
    // 🎯 กรณีขอตั้งค่า Telegram
    if (endpoint.includes('monitor.telegramConfig')) {
      const targetChatId = context.env.TELEGRAM_CHAT_IDS || "8674647124";
      return {
        result: {
          data: {
            recipients: targetChatId,
            status: "connected",
            updatedAt: new Date().toISOString()
          }
        }
      };
    }

    // 🎯 LIVE FETCH: ดึงข้อมูลสถิติจาก Cloudflare GraphQL มาคำนวณ Cache Hit
    if (endpoint.includes('monitor.cfAnalytics')) {
      const zoneId = context.env.CLOUDFLARE_ZONE_ID;
      const apiToken = context.env.CLOUDFLARE_API_TOKEN;

      // เซฟตี้ดักจับ: หากยังไม่ได้ผูกกุญแจ Token ให้ส่งกล่องว่างกลับไปก่อนเพื่อไม่ให้หน้าบ้านพัง
      if (!zoneId || !apiToken) {
        return { result: { data: [] } };
      }

      try {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const graphqlQuery = JSON.stringify({
          query: `query GetCacheAnalytics($zoneTag: String!, $since: DateTime!) {
            viewer {
              zones(filter: { zoneTag: $zoneTag }) {
                httpRequests1hGroups(limit: 24, filter: { datetime_gt: $since }) {
                  dimensions { datetime }
                  sum {
                    requests
                    cachedRequests
                  }
                }
              }
            }
          }`,
          variables: { zoneTag: zoneId, since: oneDayAgo }
        });

        const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json'
          },
          body: graphqlQuery
        });

        const resBody: any = await response.json();
        const groups = resBody?.data?.viewer?.zones[0]?.httpRequests1hGroups || [];
        
        // คลีนและจัดระเบียบโครงสร้างข้อมูล (Normalization) ส่งกลับไปให้หน้าบ้านแมปวาดกราฟได้ทันที
        const dataPoints = groups.map((g: any) => ({
          datetime: g.dimensions?.datetime,
          requests: g.sum?.requests || 0,
          cachedRequests: g.sum?.cachedRequests || 0,
          cacheHitRatio: g.sum?.requests > 0 ? Math.round((g.sum.cachedRequests / g.sum.requests) * 100) : 0
        }));

        return { result: { data: dataPoints } };
      } catch (err) {
        return { result: { data: [] } }; // Fallback ป้องกันหน้าจอแตกหาก API ขัดข้อง
      }
    }

    // 🎯 กรณีขอข้อมูลลิสต์อื่นๆ (บังคับส่ง Array ว่าง [] เพื่อไม่ให้ .map หรือ .slice พัง)
    if (
      endpoint.includes('monitor.history') ||
      endpoint.includes('monitor.quickStatus') ||
      endpoint.includes('monitor.runCheck') ||
      endpoint.includes('wpSentinel.getV6Data')
    ) {
      return {
        result: {
          data: []
        }
      };
    }

    return { result: { data: [] } };
  };

  // 3. ประกอบร่างข้อมูลส่งกลับด้วยระเบียบควบคุมกลไก Batching (เปลี่ยนเป็น Asynchronous)
  let finalResponsePayload: any;
  if (isBatch) {
    // มัดรวมคำขอส่งประมวลผลพร้อมกันผ่าน Promise.all เพื่อความเร็วสูงสุด
    finalResponsePayload = await Promise.all(
      requestedEndpoints.map(endpoint => generateMockResponse(endpoint))
    );
  } else {
    finalResponsePayload = await generateMockResponse(requestedEndpoints[0]);
  }

  return new Response(JSON.stringify(finalResponsePayload), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    }
  });
};

// 🔄 ท่อสำรองเผื่อวิ่งไปหาหลังบ้าน Worker ตัวจริง
async function fallbackProxy(context: any, url: URL) {
  const backendOrigin = context.env.BACKEND_ORIGIN || "https://ncr-watchdog-backend.kannaphong-k.workers.dev";
  try {
    const targetUrl = new URL(url.pathname + url.search, backendOrigin);
    return await fetch(new Request(targetUrl.toString(), context.request));
  } catch (e) {
    return new Response(JSON.stringify({ result: { data: [] } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
