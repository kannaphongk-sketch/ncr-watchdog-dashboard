import type { CloudflareFunctionEnv } from "./lib/cloudflare-utils";
import { getTelegramBotToken, normalizeTelegramChatIds } from "./lib/cloudflare-utils";

function getBangkokTime(): string {
  return new Date().toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

const COUNTRY_FLAGS: Record<string, string> = {
  TH: "🇹🇭", US: "🇺🇸", GB: "🇬🇧", JP: "🇯🇵", SG: "🇸🇬",
  CN: "🇨🇳", AU: "🇦🇺", DE: "🇩🇪", FR: "🇫🇷", KR: "🇰🇷",
  IN: "🇮🇳", CA: "🇨🇦", MY: "🇲🇾", PH: "🇵🇭", ID: "🇮🇩",
  VN: "🇻🇳", HK: "🇭🇰", TW: "🇹🇼", NL: "🇳🇱", RU: "🇷🇺",
};

async function queryGraphQL(env: CloudflareFunctionEnv, query: string): Promise<any> {
  const apiToken = env.CLOUDFLARE_API_TOKEN;
  if (!apiToken) return null;
  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    return await res.json();
  } catch { return null; }
}

async function getTopPages(env: CloudflareFunctionEnv, days: number): Promise<{ url: string; requests: number }[]> {
  const zoneId = env.CLOUDFLARE_ZONE_ID;
  if (!zoneId) return [];
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const json = await queryGraphQL(env, `{
    viewer {
      zones(filter: { zoneTag: "${zoneId}" }) {
        httpRequestsAdaptiveGroups(
          limit: 10
          filter: { datetime_geq: "${since}" }
          orderBy: [count_DESC]
        ) {
          count
          dimensions { clientRequestPath }
        }
      }
    }
  }`);
  const groups = json?.data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups ?? [];
  return groups.map((g: any) => ({
    url: g.dimensions?.clientRequestPath ?? "/",
    requests: g.count ?? 0,
  }));
}

async function getTopCountries(env: CloudflareFunctionEnv, days: number): Promise<{ country: string; requests: number }[]> {
  const zoneId = env.CLOUDFLARE_ZONE_ID;
  if (!zoneId) return [];
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const json = await queryGraphQL(env, `{
    viewer {
      zones(filter: { zoneTag: "${zoneId}" }) {
        httpRequestsAdaptiveGroups(
          limit: 10
          filter: { datetime_geq: "${since}" }
          orderBy: [count_DESC]
        ) {
          count
          dimensions { clientCountryName clientIP }
        }
      }
    }
  }`);

  // Try country-level grouping
  const zoneId2 = env.CLOUDFLARE_ZONE_ID;
  const since2 = new Date(Date.now() - days * 86400000).toISOString();
  const json2 = await queryGraphQL(env, `{
    viewer {
      zones(filter: { zoneTag: "${zoneId2}" }) {
        httpRequests1dGroups(
          limit: 10
          filter: { date_geq: "${since2.split("T")[0]}" }
          orderBy: [sum_requests_DESC]
        ) {
          sum { requests }
          dimensions { clientCountryName }
        }
      }
    }
  }`);

  const groups = json2?.data?.viewer?.zones?.[0]?.httpRequests1dGroups ?? [];
  if (groups.length > 0) {
    return groups.map((g: any) => ({
      country: g.dimensions?.clientCountryName ?? "Unknown",
      requests: g.sum?.requests ?? 0,
    }));
  }
  return [];
}

async function getHourlyTraffic(env: CloudflareFunctionEnv): Promise<{ hour: number; requests: number }[]> {
  const zoneId = env.CLOUDFLARE_ZONE_ID;
  if (!zoneId) return [];
  const since = new Date(Date.now() - 86400000).toISOString();
  const json = await queryGraphQL(env, `{
    viewer {
      zones(filter: { zoneTag: "${zoneId}" }) {
        httpRequestsAdaptiveGroups(
          limit: 24
          filter: { datetime_geq: "${since}" }
          orderBy: [datetimeHour_ASC]
        ) {
          count
          dimensions { datetimeHour }
        }
      }
    }
  }`);
  const groups = json?.data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups ?? [];
  return groups.map((g: any) => {
    const dt = g.dimensions?.datetimeHour ?? "";
    const utcHour = dt ? new Date(dt).getUTCHours() : 0;
    const bkkHour = (utcHour + 7) % 24;
    return { hour: bkkHour, requests: g.count ?? 0 };
  }).sort((a: any, b: any) => a.hour - b.hour);
}

function buildHourlyChart(hourly: { hour: number; requests: number }[]): string {
  if (hourly.length === 0) return "ไม่มีข้อมูล";
  const max = Math.max(...hourly.map(h => h.requests));
  if (max === 0) return "ไม่มีข้อมูล";

  // Show every 3 hours
  const slots = [0, 3, 6, 9, 12, 15, 18, 21];
  return slots.map(slot => {
    const entry = hourly.find(h => h.hour === slot) ?? { hour: slot, requests: 0 };
    const pct = Math.round((entry.requests / max) * 10);
    const bar = "█".repeat(pct) + "░".repeat(10 - pct);
    const label = `${String(slot).padStart(2, "0")}:00`;
    const count = entry.requests.toLocaleString();
    const peak = entry.requests === max ? " ← พีค" : "";
    return `${label} ${bar} ${count}${peak}`;
  }).join("\n");
}

async function sendTelegram(env: CloudflareFunctionEnv, text: string): Promise<void> {
  const token = getTelegramBotToken(env);
  const chatIds = normalizeTelegramChatIds(env);
  if (!token || chatIds.length === 0) return;
  await Promise.allSettled(
    chatIds.map(chatId =>
      fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
      })
    )
  );
}

function buildReport(
  mode: "daily" | "weekly" | "monthly",
  pages: { url: string; requests: number }[],
  countries: { country: string; requests: number }[],
  hourly: { hour: number; requests: number }[]
): string {
  const labels = { daily: "☀️ รายวัน", weekly: "📅 รายสัปดาห์", monthly: "🏆 รายเดือน" };
  const periods = { daily: "24 ชั่วโมง", weekly: "7 วัน", monthly: "30 วัน" };
  const BASE = "https://nakornchiangrainews.com";

  // Top 10 URLs
  const urlLines = pages.length === 0 ? "• ไม่พบข้อมูล" :
    pages.map((p, i) => `${i + 1}. <a href="${BASE}${p.url}">${p.url}</a>\n   👁️ <b>${p.requests.toLocaleString()}</b> ครั้ง`).join("\n\n");

  // Top 10 Countries
  const countryLines = countries.length === 0 ? "• ไม่พบข้อมูล" :
    countries.map((c, i) => {
      const code = Object.entries(COUNTRY_FLAGS).find(([, name]) => c.country.includes(name))?.[0] ?? "";
      const flag = COUNTRY_FLAGS[code] ?? "🌐";
      return `${i + 1}. ${flag} ${c.country} — <b>${c.requests.toLocaleString()}</b>`;
    }).join("\n");

  // Hourly chart (daily only)
  const hourlySection = mode === "daily" ? `\n\n⏰ <b>ช่วงเวลาที่คนดูมากสุด (Bangkok)</b>\n<code>${buildHourlyChart(hourly)}</code>` : "";

  return `📊 <b>[NCR] ${labels[mode]} — รายงานประจำ${mode === "daily" ? "วัน" : mode === "weekly" ? "สัปดาห์" : "เดือน"}</b>
📅 ข้อมูลย้อนหลัง ${periods[mode]}
⏰ ${getBangkokTime()} (Bangkok)

🔗 <b>Top 10 หน้าเด่น</b>
${urlLines}

🌍 <b>Top 10 ประเทศ</b>
${countryLines}${hourlySection}

🔗 <a href="https://ncr-watchdog-dashboard.pages.dev">Dashboard</a>`;
}

export default {
  async scheduled(controller: ScheduledController, env: CloudflareFunctionEnv, ctx: ExecutionContext): Promise<void> {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcDay = now.getUTCDay();
    const utcDate = now.getUTCDate();

    if (utcHour !== 2) return;

    const [dailyPages, countries, hourly] = await Promise.all([
      getTopPages(env, 1),
      getTopCountries(env, 1),
      getHourlyTraffic(env),
    ]);

    await sendTelegram(env, buildReport("daily", dailyPages, countries, hourly));

    if (utcDay === 1) {
      const [weeklyPages, weeklyCountries] = await Promise.all([
        getTopPages(env, 7),
        getTopCountries(env, 7),
      ]);
      await sendTelegram(env, buildReport("weekly", weeklyPages, weeklyCountries, []));
    }

    if (utcDate === 1) {
      const [monthlyPages, monthlyCountries] = await Promise.all([
        getTopPages(env, 30),
        getTopCountries(env, 30),
      ]);
      await sendTelegram(env, buildReport("monthly", monthlyPages, monthlyCountries, []));
    }
  },
};
