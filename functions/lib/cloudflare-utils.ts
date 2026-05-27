export interface CloudflareFunctionEnv {
  BACKEND_ORIGIN?: string;
  FRONTEND_URL?: string;
  DASHBOARD_URL?: string;
  ALLOWED_ORIGINS?: string;
  CTO_MONITOR_TARGET_URL?: string;
  CTO_MONITOR_LATENCY_THRESHOLD_MS?: string;
  CTO_MONITOR_TIMEOUT_MS?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TG_BOT_TOKEN?: string;
  TELEGRAM_TOKEN?: string;
  TG_TOKEN?: string;
  BOT_TOKEN?: string;
  NCR_TELEGRAM_BOT_TOKEN?: string;
  NCR_WATCHDOG_TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  TELEGRAM_CHAT_IDS?: string;
  TELEGRAM_AUTHORIZED_CHAT_IDS?: string;
  TG_CHAT_ID?: string;
  TG_CHAT_IDS?: string;
}

export const DEFAULT_BACKEND_ORIGIN = "http://35.196.168.113:3000";
export const REQUIRED_TELEGRAM_IDS = ["8855631169", "8674647124", "8216202664"] as const;

export const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
  Pragma: "no-cache",
  Expires: "0",
} as const;

export function firstPresent(...values: Array<string | undefined>): string {
  return values.find(value => value?.trim())?.trim() || "";
}

export function splitCommaSeparated(value?: string): string[] {
  return (value || "")
    .split(",")
    .map(part => part.trim())
    .filter(Boolean);
}

export function normalizeTelegramChatIds(env: CloudflareFunctionEnv): string[] {
  const raw = firstPresent(
    env.TELEGRAM_CHAT_IDS,
    env.TELEGRAM_CHAT_ID,
    env.TELEGRAM_AUTHORIZED_CHAT_IDS,
    env.TG_CHAT_IDS,
    env.TG_CHAT_ID,
    REQUIRED_TELEGRAM_IDS.join(",")
  );
  return Array.from(new Set([...REQUIRED_TELEGRAM_IDS, ...splitCommaSeparated(raw)]));
}

export function getTelegramBotToken(env: CloudflareFunctionEnv): string {
  return firstPresent(
    env.TELEGRAM_BOT_TOKEN,
    env.TG_BOT_TOKEN,
    env.TELEGRAM_TOKEN,
    env.TG_TOKEN,
    env.BOT_TOKEN,
    env.NCR_TELEGRAM_BOT_TOKEN,
    env.NCR_WATCHDOG_TELEGRAM_BOT_TOKEN
  );
}

export function getBackendOrigin(env: CloudflareFunctionEnv): string {
  return (env.BACKEND_ORIGIN || DEFAULT_BACKEND_ORIGIN).replace(/\/$/, "");
}

export function corsHeaders(request: Request, env?: CloudflareFunctionEnv): Record<string, string> {
  const incomingUrl = new URL(request.url);
  const origin = request.headers.get("Origin") || incomingUrl.origin;
  const configuredAllowedOrigins = (env?.ALLOWED_ORIGINS || env?.FRONTEND_URL || "")
    .split(",")
    .map(value => value.trim().replace(/\/$/, ""))
    .filter(Boolean);
  const allowedOrigins = new Set([
    "https://ncr-watchdog-dashboard.pages.dev",
    "https://29bfa18a.ncr-dashboard.pages.dev",
    "https://ncr-dashboard.pages.dev",
    ...configuredAllowedOrigins,
  ]);
  const normalizedOrigin = origin.replace(/\/$/, "");
  const allowOrigin =
    !origin ||
    allowedOrigins.has(normalizedOrigin) ||
    /^https:\/\/[a-z0-9-]+\.ncr-watchdog-dashboard\.pages\.dev$/i.test(normalizedOrigin) ||
    /^https:\/\/[a-z0-9-]+\.ncr-dashboard\.pages\.dev$/i.test(normalizedOrigin)
      ? origin
      : "https://ncr-watchdog-dashboard.pages.dev";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, trpc-accept, x-trpc-source",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function applyCors(response: Response, request: Request, env?: CloudflareFunctionEnv): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders(request, env))) headers.set(key, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function applyNoStore(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(noStoreHeaders)) headers.set(key, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function buildProxiedRequest(context: EventContext<CloudflareFunctionEnv, string, unknown>, pathname: string): Request {
  const incomingUrl = new URL(context.request.url);
  const targetUrl = new URL(pathname + incomingUrl.search, getBackendOrigin(context.env));
  const requestHeaders = new Headers(context.request.headers);
  requestHeaders.delete("Host");
  requestHeaders.set("X-Forwarded-Host", incomingUrl.host);
  requestHeaders.set("X-Forwarded-Proto", incomingUrl.protocol.replace(":", ""));

  const telegramBotToken = getTelegramBotToken(context.env);
  const telegramChatIds = normalizeTelegramChatIds(context.env).join(",");
  if (telegramBotToken) requestHeaders.set("X-NCR-Telegram-Bot-Token", telegramBotToken);
  requestHeaders.set("X-NCR-Telegram-Chat-Ids", telegramChatIds);

  return new Request(targetUrl.toString(), {
    method: context.request.method,
    headers: requestHeaders,
    body: ["GET", "HEAD"].includes(context.request.method.toUpperCase()) ? undefined : context.request.body,
    redirect: "manual",
  });
}

export async function proxyToBackend(context: EventContext<CloudflareFunctionEnv, string, unknown>, pathname: string): Promise<Response> {
  const response = await fetch(buildProxiedRequest(context, pathname));
  return applyCors(applyNoStore(response), context.request, context.env);
}
