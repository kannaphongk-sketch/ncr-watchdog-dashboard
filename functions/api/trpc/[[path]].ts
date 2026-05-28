import type { CloudflareFunctionEnv } from "../../lib/cloudflare-utils";
import { applyCors, corsHeaders, proxyToBackend, getTelegramBotToken, normalizeTelegramChatIds, noStoreHeaders } from "../../lib/cloudflare-utils";

function trpcPath(params: Record<string, string | string[]>): string {
  const rawPath = params.path;
  if (Array.isArray(rawPath)) return rawPath.map(segment => encodeURIComponent(segment)).join("/");
  return rawPath ? encodeURIComponent(rawPath) : "";
}

export const onRequest: PagesFunction<CloudflareFunctionEnv> = async context => {
  if (context.request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(context.request, context.env) });
  }

  if (!["GET", "POST"].includes(context.request.method.toUpperCase())) {
    return applyCors(
      new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      }),
      context.request,
      context.env
    );
  }

  const url = new URL(context.request.url);

  if (url.pathname.includes("monitor.telegramConfig")) {
    const isBatch = url.searchParams.has("batch");
    const chatIds = normalizeTelegramChatIds(context.env);
    const botToken = getTelegramBotToken(context.env);
    const data = {
      configured: chatIds.length > 0,
      botConfigured: Boolean(botToken),
      chatIds,
      status: "configured"
    };
    // superjson format
    const result = { result: { data } };
    const response = isBatch ? [result] : result;
    return applyCors(
      new Response(JSON.stringify(response), {
        status: 200,
        headers: { "Content-Type": "application/json", "trpc-accept": "application/json", ...noStoreHeaders }
      }),
      context.request,
      context.env
    );
  }

  const suffix = trpcPath(context.params);
  return proxyToBackend(context, `/api/trpc${suffix ? `/${suffix}` : ""}`);
};
