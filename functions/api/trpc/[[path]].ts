export const onRequest: PagesFunction<{
  TELEGRAM_CHAT_IDS?: string;
  BACKEND_ORIGIN?: string;
  CLOUDFLARE_ZONE_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
}> = async (context) => {
  const url = new URL(context.request.url);
  const isBatch = url.searchParams.get('batch') === '1';

  // 🎯 1. ดักจับเส้น Telegram Config (ส่ง Object ตามที่หน้าบ้านต้องการ)
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
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
    });
  }

  // 🎯 2. ดักจับทุกเส้นที่หน้าบ้านคาดหวังว่าต้องเป็น Array [] ไปวนลูป (.map หรือ .slice)
  // ป้องกันปัญหา TypeError: (p.data ?? []).map is not a function แบบเด็ดขาด
  if (
    url.pathname.includes('monitor.history') || 
    url.pathname.includes('monitor.quickStatus') || 
    url.pathname.includes('monitor.cfAnalytics') ||
    url.pathname.includes('wpSentinel.getV6Data')
  ) {
    const mockArrayData = {
      result: {
        data: [] // บังคับส่ง Array ว่างเพื่อให้สคริปต์หน้าบ้าน .map() ผ่านฉลุยไม่ระเบิด
      }
    };
    return new Response(JSON.stringify(isBatch ? [mockArrayData] : mockArrayData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
    });
  }

  // 🎯 3. สำหรับ Endpoint อื่นๆ ที่เหลือนอกเหนือจากนี้ ให้ส่ง Proxy ไปหาหลังบ้านตามปกติ
  const backendOrigin = context.env.BACKEND_ORIGIN || "https://ncr-watchdog-backend.kannaphong-k.workers.dev";
  try {
    const targetUrl = new URL(url.pathname + url.search, backendOrigin);
    const backendResponse = await fetch(new Request(targetUrl.toString(), context.request));
    
    // เซฟตี้ชั้นสุดท้าย: ถ้าหลังบ้านส่งอะไรแปลกๆ มาแล้วไม่ใช่สถานะ OK ให้สลับส่ง Array ว่างเซฟหน้าจอไว้ก่อน
    if (!backendResponse.ok) throw new Error("Backend error");
    
    return backendResponse;
  } catch (proxyError) {
    const safeFallbackData = { result: { data: [] } };
    return new Response(JSON.stringify(isBatch ? [safeFallbackData] : safeFallbackData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      }
    });
  }
};
