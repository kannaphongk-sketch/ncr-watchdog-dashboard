interface Env {
  BACKEND_ORIGIN?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TG_BOT_TOKEN?: string;
  TELEGRAM_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  TELEGRAM_CHAT_IDS?: string;
  TELEGRAM_AUTHORIZED_CHAT_IDS?: string;
  TG_CHAT_ID?: string;
  TG_CHAT_IDS?: string;
}

const DEFAULT_BACKEND_ORIGIN = "http://35.196.168.113.sslip.io:3000";
const REQUIRED_TELEGRAM_IDS = "8855631169,8674647124,8216202664";
const firstPresent = (...values: Array<string | undefined>) => values.find(value => value?.trim())?.trim() || "";

export const onRequest: PagesFunction<Env> = async context => {
  const backendOrigin = (context.env.BACKEND_ORIGIN || DEFAULT_BACKEND_ORIGIN).replace(/\/$/, "");
  const incomingUrl = new URL(context.request.url);
  const targetUrl = new URL(incomingUrl.pathname + incomingUrl.search, backendOrigin);

  const requestHeaders = new Headers(context.request.headers);
  requestHeaders.set("Host", targetUrl.host);
  requestHeaders.set("X-Forwarded-Host", incomingUrl.host);
  requestHeaders.set("X-Forwarded-Proto", incomingUrl.protocol.replace(":", ""));
  const telegramBotToken = firstPresent(context.env.TELEGRAM_BOT_TOKEN, context.env.TG_BOT_TOKEN, context.env.TELEGRAM_TOKEN);
  const telegramChatIds = firstPresent(context.env.TELEGRAM_CHAT_IDS, context.env.TELEGRAM_CHAT_ID, context.env.TELEGRAM_AUTHORIZED_CHAT_IDS, context.env.TG_CHAT_IDS, context.env.TG_CHAT_ID, REQUIRED_TELEGRAM_IDS);
  if (telegramBotToken) requestHeaders.set("X-NCR-Telegram-Bot-Token", telegramBotToken);
  requestHeaders.set("X-NCR-Telegram-Chat-Ids", telegramChatIds);

  const proxiedRequest = new Request(targetUrl.toString(), {
    method: context.request.method,
    headers: requestHeaders,
    body: ["GET", "HEAD"].includes(context.request.method) ? undefined : context.request.body,
    redirect: "manual",
  });

  const response = await fetch(proxiedRequest);
  const responseHeaders = new Headers(response.headers);
  responseHeaders.set("Access-Control-Allow-Origin", incomingUrl.origin);
  responseHeaders.set("Access-Control-Allow-Credentials", "true");
  responseHeaders.set("Vary", "Origin");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
};
