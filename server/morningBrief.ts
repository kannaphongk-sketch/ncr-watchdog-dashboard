/**
 * Morning Brief Engine (07:30 AM BKK)
 * Merges 4 content modules into a single Telegram message:
 *  1. TH News  — top 3 headlines from nakornchiangrainews.com RSS
 *  2. Global News — top 3 headlines from Reuters/AP RSS
 *  3. Personal Agenda — today's notes from DB (entered via dashboard)
 *  4. English 3 Sentences — LLM-generated daily English practice
 */

import { invokeLLM } from "./_core/llm";

// ─── RSS Fetching ─────────────────────────────────────────────────────────────

interface RSSItem {
  title: string;
  link: string;
}

async function fetchRSS(url: string, limit = 3): Promise<RSSItem[]> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "NCR-Watchdog/1.0 (+https://nakornchiangrainews.com)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const xml = await res.text();

    // Simple XML parser — extract <item> blocks
    const items: RSSItem[] = [];
    const itemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
    let match;
    while ((match = itemRegex.exec(xml)) !== null && items.length < limit) {
      const block = match[1];
      const titleMatch = block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
      const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/i) ||
                        block.match(/<guid[^>]*>(https?:\/\/[^<]+)<\/guid>/i);
      const title = titleMatch?.[1]?.trim().replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">") ?? "";
      const link = linkMatch?.[1]?.trim() ?? "";
      if (title) items.push({ title, link });
    }
    return items;
  } catch {
    return [];
  }
}

export async function fetchThaiNews(): Promise<RSSItem[]> {
  return fetchRSS("https://nakornchiangrainews.com/feed/", 3);
}

export async function fetchGlobalNews(): Promise<RSSItem[]> {
  // Try Reuters world news RSS first, fall back to AP
  const reuters = await fetchRSS("https://feeds.reuters.com/reuters/topNews", 3);
  if (reuters.length > 0) return reuters;
  return fetchRSS("https://feeds.bbci.co.uk/news/world/rss.xml", 3);
}

// ─── LLM English Sentences ───────────────────────────────────────────────────

export async function generateEnglishSentences(): Promise<string> {
  try {
    const today = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Asia/Bangkok",
    });
    const resp = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are an English teacher for Thai news journalists. Generate exactly 3 practical English sentences for daily use in a newsroom. Each sentence should be useful, natural, and at intermediate level. Format: numbered list 1. 2. 3. — no extra commentary.",
        },
        {
          role: "user",
          content: `Today is ${today}. Generate 3 useful English sentences for a Thai journalist's morning practice.`,
        },
      ],
    });
    const content = resp.choices?.[0]?.message?.content;
    const text = typeof content === "string" ? content.trim() : "";
    return text || "1. Good morning! 2. Today's news is ready. 3. Let's get started.";
  } catch {
    return "1. Good morning! 2. Today's news is ready. 3. Let's get started.";
  }
}

// ─── Message Builder ──────────────────────────────────────────────────────────

export function buildMorningBriefMessage(params: {
  thaiNews: RSSItem[];
  globalNews: RSSItem[];
  agendaContent: string;
  englishSentences: string;
  dateLabel: string;
}): string {
  const { thaiNews, globalNews, agendaContent, englishSentences, dateLabel } = params;

  // TH News section
  const thSection =
    thaiNews.length > 0
      ? thaiNews.map((n, i) => `${i + 1}. <a href="${n.link}">${n.title}</a>`).join("\n")
      : "• ไม่พบข้อมูล";

  // Global News section
  const globalSection =
    globalNews.length > 0
      ? globalNews.map((n, i) => `${i + 1}. <a href="${n.link}">${n.title}</a>`).join("\n")
      : "• ไม่พบข้อมูล";

  // Personal Agenda section
  const agendaSection = agendaContent?.trim()
    ? agendaContent.trim()
    : "• (ยังไม่ได้กรอกวาระวันนี้)";

  // English section
  const englishSection = englishSentences || "1. Good morning! 2. Today's news is ready. 3. Let's get started.";

  return `🌅 <b>Morning Brief — ${dateLabel}</b>

📰 <b>ข่าวเด่น NCR วันนี้</b>
${thSection}

🌍 <b>ข่าวโลก</b>
${globalSection}

📋 <b>วาระวันนี้</b>
${agendaSection}

🇬🇧 <b>English Practice (3 Sentences)</b>
${englishSection}

━━━━━━━━━━━━━━━━━━━━
🛡️ NCR Watchdog — Credit-Optimized Mode`;
}
