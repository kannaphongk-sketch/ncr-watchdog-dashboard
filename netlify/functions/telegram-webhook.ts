import { ENV } from "../../server/_core/env";
import { checkSite } from "../../server/monitoring";
import { purgeCFCache } from "../../server/cloudflare";
import { getLatestCFAnalyticsSnapshot } from "../../server/db";

interface TelegramUpdate {
  message?: {
    chat?: { id?: number | string };
    text?: string;
    from?: { id?: number | string; username?: string };
  };
}

const htmlEscape = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");

const getAuthorizedChatIds = () =>
  ENV.tgAuthorizedChatIds
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

const sendTelegramReply = async (chatId: string, text: string) => {
  if (!ENV.tgBotToken) return;
  await fetch(`https://api.telegram.org/bot${ENV.tgBotToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
  });
};

const buildHelp = () => `<b>NCR Watchdog Commands</b>\n\n` +
  `• <code>/status</code> — live WordPress/Cloudflare health snapshot\n` +
  `• <code>/purge_cache</code> — purge Cloudflare cache safely\n` +
  `• <code>/analytics</code> — latest cached traffic summary\n` +
  `• <code>/help</code> — show this menu`;

const handleCommand = async (command: string) => {
  if (command === "/status") {
    const status = await checkSite();
    return `<b>NCR Watchdog Status</b>\n` +
      `HTTP: <code>${status.httpCode}</code> ${status.isUp ? "Online" : "Offline"}\n` +
      `TTFB: <code>${status.ttfbMs}ms</code>\n` +
      `Cache: <code>${htmlEscape(status.cacheStatus ?? "UNKNOWN")}</code>\n` +
      `CF Ray: <code>${htmlEscape(status.cfRay ?? "N/A")}</code>`;
  }

  if (command === "/purge_cache") {
    const result = await purgeCFCache();
    return `<b>Cloudflare Cache Purge</b>\n` +
      `Result: <code>${result.success ? "success" : "failed"}</code>\n` +
      `Message: ${htmlEscape(result.message)}`;
  }

  if (command === "/analytics") {
    const latest = await getLatestCFAnalyticsSnapshot(1);
    if (!latest) return "No cached analytics snapshot is available yet.";
    return `<b>NCR Analytics Snapshot (24h)</b>\n` +
      `Visitors: <code>${latest.visits.toLocaleString()}</code>\n` +
      `Page Views: <code>${latest.pageViews.toLocaleString()}</code>\n` +
      `Requests: <code>${latest.totalRequests.toLocaleString()}</code>\n` +
      `Cache Hit: <code>${latest.cacheHitRate}%</code>\n` +
      `Threats: <code>${latest.threats.toLocaleString()}</code>`;
  }

  return buildHelp();
};

export default async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return Response.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }

  const chatId = update.message?.chat?.id?.toString();
  const text = update.message?.text?.trim().split(/\s+/)[0].split("@")[0] ?? "";
  if (!chatId || !text.startsWith("/")) return Response.json({ ok: true, ignored: true });

  const authorized = getAuthorizedChatIds();
  if (!authorized.includes(chatId)) {
    await sendTelegramReply(chatId, "Unauthorized NCR Watchdog command source.");
    return Response.json({ ok: true, authorized: false });
  }

  try {
    const reply = await handleCommand(text);
    await sendTelegramReply(chatId, reply);
    return Response.json({ ok: true, command: text });
  } catch (err) {
    await sendTelegramReply(chatId, `Command failed: <code>${htmlEscape((err as Error).message)}</code>`);
    return Response.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
};
