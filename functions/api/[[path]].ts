import type { CloudflareFunctionEnv } from "../lib/cloudflare-utils";
import { applyCors, corsHeaders, proxyToBackend, getTelegramBotToken, normalizeTelegramChatIds, noStoreHeaders } from "../lib/cloudflare-utils";

function apiPath(params: Record<string, string | string[]>): string {
  const rawPath = params.path;
  if (Array.isArray(rawPath)) return rawPath.map(segment => encodeURIComponent(segment)).join("/");
  return rawPath ? encodeURIComponent(rawPath) : "";
}

export const onRequest: PagesFunction<CloudflareFunctionEnv> = async context => {
  if (context.request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(context.request, context.env) });
  }

  const url = new URL(context.request.url);

  // Handle monitor.telegramConfig directly without proxying
  if (url.pathname.includes("/api/trpc/monitor.telegramConfig")) {
    const isBatch = url.searchParams.has("batch");
    const chatIds = normalizeTelegramChatIds(context.env);
    const botToken = getTelegramBotToken(context.env);
    const data = {
      configured: chatIds.length > 0,
      botConfigured: Boolean(botToken),
      chatIds,
      status: "configured"
    };
    const response = isBatch ? [{ result: { data } }] : { result: { data } };
    return applyCors(
      new Response(JSON.stringify(response), {
        status: 200,
        headers: { "Content-Type": "application/json", ...noStoreHeaders }
      }),
      context.request,
      context.env
    );
  }

  try {
    const suffix = apiPath(context.params);
    return proxyToBackend(context, `/api${suffix ? `/${suffix}` : ""}`);
  } catch (error) {
    return applyCors(
      new Response(JSON.stringify({ error: "Backend fetch failed", detail: error instanceof Error ? error.message : String(error) }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }),
      context.request,
      context.env
    );
  }
};
