import type { CloudflareFunctionEnv } from "./lib/cloudflare-utils";
import {
  applyCors,
  corsHeaders,
  getTelegramBotToken,
  normalizeTelegramChatIds,
  noStoreHeaders,
} from "./lib/cloudflare-utils";

interface MonitorResult {
  ok: boolean;
  status: number;
  latencyMs: number;
  checkedAt: string;
  targetUrl: string;
  error?: string;
  telegramRecipients: number;
  telegramDelivered: number;
}

const DEFAULT_TARGET_URL = "https://nakornchiangrainews.com";
const DEFAULT_LATENCY_THRESHOLD_MS = 3_500;
const DEFAULT_TIMEOUT_MS = 10_000;

function numericEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function htmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildTelegramMessage(result: MonitorResult, nextRun?: string): string {
  const statusLine = result.ok ? "✅ CTO Monitor OK" : "🚨 CTO Monitor Alert";
  const nextRunLine = nextRun ? `\nNext scheduled check: <code>${htmlEscape(nextRun)}</code>` : "";
  const errorLine = result.error ? `\nError: <code>${htmlEscape(result.error)}</code>` : "";
  return [
    `<b>${statusLine}</b>`,
    `Target: <code>${htmlEscape(result.targetUrl)}</code>`,
    `HTTP: <code>${result.status}</code>`,
    `Latency: <code>${result.latencyMs}ms</code>`,
    `Checked: <code>${htmlEscape(result.checkedAt)}</code>`,
    `${errorLine}${nextRunLine}`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function sendTelegram(env: CloudflareFunctionEnv, text: string): Promise<number> {
  const token = getTelegramBotToken(env);
  const chatIds = normalizeTelegramChatIds(env);
  if (!token || chatIds.length === 0) return 0;

  const delivered = await Promise.allSettled(
    chatIds.map(chatId =>
      fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
      }).then(async response => {
        if (!response.ok) throw new Error(`Telegram ${chatId} failed with HTTP ${response.status}`);
        return chatId;
      })
    )
  );

  return delivered.filter(result => result.status === "fulfilled").length;
}

async function probeTarget(env: CloudflareFunctionEnv): Promise<Omit<MonitorResult, "telegramRecipients" | "telegramDelivered">> {
  const targetUrl = env.CTO_MONITOR_TARGET_URL || DEFAULT_TARGET_URL;
  const timeoutMs = numericEnv(env.CTO_MONITOR_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  const thresholdMs = numericEnv(env.CTO_MONITOR_LATENCY_THRESHOLD_MS, DEFAULT_LATENCY_THRESHOLD_MS);
  const checkedAt = new Date().toISOString();
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      redirect: "follow",
      headers: { Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "User-Agent": "ncr-watchdog-cloudflare-cto-monitor/1.0" },
      signal: abort.signal,
    });
    const latencyMs = Date.now() - startedAt;
    return {
      ok: response.status >= 200 && response.status < 500 && latencyMs <= thresholdMs,
      status: response.status,
      latencyMs,
      checkedAt,
      targetUrl,
      error: latencyMs > thresholdMs ? `Latency exceeded ${thresholdMs}ms threshold` : undefined,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      latencyMs: Date.now() - startedAt,
      checkedAt,
      targetUrl,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function runCtoMonitor(env: CloudflareFunctionEnv, nextRun?: string): Promise<MonitorResult> {
  const probe = await probeTarget(env);
  const recipients = normalizeTelegramChatIds(env).length;
  const shouldNotify = !probe.ok;
  const delivered = shouldNotify ? await sendTelegram(env, buildTelegramMessage({ ...probe, telegramRecipients: recipients, telegramDelivered: 0 }, nextRun)) : 0;
  return { ...probe, telegramRecipients: recipients, telegramDelivered: delivered };
}

export const onRequest: PagesFunction<CloudflareFunctionEnv> = async context => {
  if (context.request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(context.request, context.env) });
  }

  if (context.request.method !== "POST") {
    return applyCors(
      new Response(JSON.stringify({ error: "Use POST to run the CTO monitor manually." }), {
        status: 405,
        headers: { "Content-Type": "application/json", ...noStoreHeaders },
      }),
      context.request,
      context.env
    );
  }

  const result = await runCtoMonitor(context.env);
  return applyCors(
    new Response(JSON.stringify(result), {
      status: result.ok ? 200 : 502,
      headers: { "Content-Type": "application/json", ...noStoreHeaders },
    }),
    context.request,
    context.env
  );
};

export default {
  async scheduled(controller: ScheduledController, env: CloudflareFunctionEnv, ctx: ExecutionContext): Promise<void> {
    const nextRun = new Date(controller.scheduledTime + 5 * 60 * 1000).toISOString();
    ctx.waitUntil(runCtoMonitor(env, nextRun));
  },
};
