interface Env {
  BACKEND_ORIGIN?: string;
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

const DEFAULT_BACKEND_ORIGIN = "http://35.196.168.113:3000";
const REQUIRED_TELEGRAM_IDS = "8855631169,8674647124,8216202664";
const firstPresent = (...values: Array<string | undefined>) => values.find(value => value?.trim())?.trim() || "";

function corsHeaders(request: Request) {
  const incomingUrl = new URL(request.url);
  const origin = request.headers.get("Origin") || incomingUrl.origin;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, trpc-accept, x-trpc-source",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function applyCors(response: Response, request: Request) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders(request))) headers.set(key, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function fallbackTRPCResponse(path: string, request: Request, error: unknown) {
  const message = error instanceof Error ? error.message : "Backend fetch failed";
  const now = new Date().toISOString();
  const fallbackByProcedure: Record<string, unknown> = {
    "monitor.telegramConfig": {
      configured: false,
      botConfigured: false,
      chatIds: REQUIRED_TELEGRAM_IDS.split(","),
      requiredChatIds: REQUIRED_TELEGRAM_IDS.split(","),
      missingRequiredChatIds: [],
      recipientCount: 3,
      botName: "@ncr_watchdog_bot",
      source: "pages-proxy-fallback",
      error: message,
    },
    "monitor.quickStatus": {
      httpCode: 0,
      ttfbMs: 0,
      cacheStatus: "UNKNOWN",
      cfRay: "",
      isUp: false,
      uptimePercent: 0,
      avgTtfbMs: 0,
      checkedAt: now,
      error: message,
    },
  };
  const data = fallbackByProcedure[path];
  if (data === undefined) return null;
  return applyCors(
    new Response(JSON.stringify([{ result: { data: { json: data } } }]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
    request
  );
}

export const onRequest: PagesFunction<Env> = async context => {
  if (context.request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(context.request) });
  }

  const backendOrigin = (context.env.BACKEND_ORIGIN || DEFAULT_BACKEND_ORIGIN).replace(/\/$/, "");
  const incomingUrl = new URL(context.request.url);
  const targetUrl = new URL(incomingUrl.pathname + incomingUrl.search, backendOrigin);

  const requestHeaders = new Headers(context.request.headers);
  requestHeaders.delete("Host");
  requestHeaders.set("X-Forwarded-Host", incomingUrl.host);
  requestHeaders.set("X-Forwarded-Proto", incomingUrl.protocol.replace(":", ""));

  const telegramBotToken = firstPresent(
    context.env.TELEGRAM_BOT_TOKEN,
    context.env.TG_BOT_TOKEN,
    context.env.TELEGRAM_TOKEN,
    context.env.TG_TOKEN,
    context.env.BOT_TOKEN,
    context.env.NCR_TELEGRAM_BOT_TOKEN,
    context.env.NCR_WATCHDOG_TELEGRAM_BOT_TOKEN
  );
  const telegramChatIds = firstPresent(
    context.env.TELEGRAM_CHAT_IDS,
    context.env.TELEGRAM_CHAT_ID,
    context.env.TELEGRAM_AUTHORIZED_CHAT_IDS,
    context.env.TG_CHAT_IDS,
    context.env.TG_CHAT_ID,
    REQUIRED_TELEGRAM_IDS
  );
  if (telegramBotToken) requestHeaders.set("X-NCR-Telegram-Bot-Token", telegramBotToken);
  requestHeaders.set("X-NCR-Telegram-Chat-Ids", telegramChatIds);

  try {
    const proxiedRequest = new Request(targetUrl.toString(), {
      method: context.request.method,
      headers: requestHeaders,
      body: ["GET", "HEAD"].includes(context.request.method) ? undefined : context.request.body,
      redirect: "manual",
    });

    const response = await fetch(proxiedRequest);
    return applyCors(response, context.request);
  } catch (error) {
    const trpcPath = incomingUrl.pathname.replace(/^\/api\/trpc\/?/, "").split(",")[0];
    const fallback = fallbackTRPCResponse(trpcPath, context.request, error);
    if (fallback) return fallback;
    return applyCors(
      new Response(JSON.stringify({ error: "Backend fetch failed", detail: error instanceof Error ? error.message : String(error) }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }),
      context.request
    );
  }
};
