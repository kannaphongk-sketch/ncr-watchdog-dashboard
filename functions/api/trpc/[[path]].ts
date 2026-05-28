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

  // แยกชื่อ Endpoint ออกมาเป็น Array เช่น ["monitor.telegramConfig", "monitor.history"]
  const pathStr = url.pathname.substring(trpcIndex + trpcPrefix.length);
  const requestedEndpoints = pathStr.split(',').map(e => e.trim()).filter(Boolean);

  if (requestedEndpoints.length === 0) {
    return fallbackProxy(context, url);
  }

  // 2. ฟังก์ชันจำลองข้อมูลรายตัว (Mock Generator ตามประเภทที่หน้าบ้านคาดหวัง)
  const generateMockResponse = (endpoint: string) => {
    // กรณีขอตั้งค่า Telegram (ต้องการ Object ข้อมูลผู้รับ)
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

    // กรณีขอข้อมูลลิสต์/สถิติ/ประวัติ (บังคับส่ง Array ว่าง [] เพื่อไม่ให้ .map หรือ .slice พัง)
    if (
      endpoint.includes('monitor.history') ||
      endpoint.includes('monitor.quickStatus') ||
      endpoint.includes('monitor.cfAnalytics') ||
      endpoint.includes('monitor.runCheck') ||
      endpoint.includes('wpSentinel.getV6Data')
    ) {
      return {
        result: {
          data: [] // โล่ป้องกันเด็ดขาดสำหรับตัวเตะตัดขา .map()
        }
      };
    }

    // ค่าเริ่มต้นกันเหนียวสำหรับเส้นอื่นๆ
    return { result: { data: [] } };
  };

  // 3. ประกอบร่างข้อมูลส่งกลับให้ตรงตามโครงสร้าง Batching
  let finalResponsePayload: any;
  if (isBatch) {
    // ถ้าหน้าบ้านมัดรวมมา ต้องส่งอาร์เรย์ที่มีจำนวนผลลัพธ์เท่ากับจำนวนที่ขอมาในลำดับเดียวกันเป๊ะ
    finalResponsePayload = requestedEndpoints.map(endpoint => generateMockResponse(endpoint));
  } else {
    // ถ้ามาเดี่ยวๆ ก็ส่งกลับไปตัวเดี่ยวๆ
    finalResponsePayload = generateMockResponse(requestedEndpoints[0]);
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

// 🔄 ท่อสำรองเผื่อเส้นไหนหลุดรอดให้วิ่งไปหาหลังบ้าน Worker ตัวจริง
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
