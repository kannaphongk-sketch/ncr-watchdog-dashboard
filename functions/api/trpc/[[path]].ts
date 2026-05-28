export const onRequest: PagesFunction<{
  TELEGRAM_CHAT_IDS?: string;
  BACKEND_ORIGIN?: string;
  CLOUDFLARE_ZONE_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
}> = async (context) => {
  const url = new URL(context.request.url);
  const isBatch = url.searchParams.get('batch') === '1';

  // 🎯 1. จัดการเส้นของ Telegram Config (เปลี่ยนเลขกลุ่มเป็นปัจจุบัน)
  if (url.pathname.includes('monitor.telegramConfig')) {
    const targetChatId = context.env.TELEGRAM_CHAT_IDS || "8674647124";
    const mockTelegramData = {
      result: {
        data: {
          recipients: targetChatId,
          status: "connected",
          updatedAt: new Date().toISOString()
        }
      }
    };
    return new Response(JSON.stringify(isBatch ? [mockTelegramData] : mockTelegramData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
    });
  }

  // 🎯 2. จัดการเส้น Cloudflare Analytics (แก้ไขบั๊กประกาศตัวแปร query ซ้ำเรียบร้อยแล้ว)
  if (url.pathname.includes('monitor.cfAnalytics')) {
    const zoneId = context.env.CLOUDFLARE_ZONE_ID || "764bf1ffbc7583553c1484338d9a7495";
    const apiToken = context.env.CLOUDFLARE_API_TOKEN;

    // ประกาศเพียง "ครั้งเดียว" ในบล็อก ป้องกันข้อผิดพลาดตอนบิวด์ระบบ
    const graphqlQuery = JSON.stringify({
      query: `{
        viewer {
          zones(filter: { zoneTag: "${zoneId}" }) {
            httpRequests1mGroups(limit: 5, filter: { datetime_gt: "${new Date(Date.now() - 3600000).toISOString()}" }) {
              dimensions { datetime }
              sum { requests }
            }
          }
        }
      }`
    });

    if (apiToken) {
      try {
        const cfResponse = await fetch('https://api.cloudflare.com/client/v4/graphql', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json'
          },
          body: graphqlQuery
        });
        const cfData = await cfResponse.json();
        const mockAnalyticsData = { result: { data: cfData?.data || {} } };
        return new Response(JSON.stringify(isBatch ? [mockAnalyticsData] : mockAnalyticsData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e) {
        // หากการเชื่อมต่อ Cloudflare API ขัดข้อง ระบบจะไหลไปที่ Fallback ด้านล่างอัตโนมัติ
      }
    }
  }

  // 🎯 3. ระบบเซฟตี้กันหน้าจอแตก (Fallback สำหรับ Endpoint อื่นๆ เช่น history, quickStatus)
  // หากติดต่อหลังบ้านเดิมไม่ได้ จะพ่นโครงสร้าง Array ว่างเปล่ากลับไป เพื่อไม่ให้ React สั่ง .slice() พัง
  const backendOrigin = context.env.BACKEND_ORIGIN || "https://ncr-watchdog-backend.kannaphong-k.workers.dev";
  try {
    const targetUrl = new URL(url.pathname + url.search, backendOrigin);
    const backendResponse = await fetch(new Request(targetUrl.toString(), context.request));
    if (!backendResponse.ok) throw new Error("Origin offline");
    return backendResponse;
  } catch (proxyError) {
    const safeFallbackData = {
      result: {
        data: [] // โล่ป้องกันข้อผิดพลาด TypeError: U.slice is not a function 
      }
    };
    return new Response(JSON.stringify(isBatch ? [safeFallbackData] : safeFallbackData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      }
    });
  }
};
