import superjson from "superjson";
import type { CloudflareFunctionEnv } from "../../lib/cloudflare-utils";
import { applyCors, corsHeaders, getTelegramBotToken, noStoreHeaders, normalizeTelegramChatIds, proxyToBackend } from "../../lib/cloudflare-utils";

function getRequestedEndpoints(url: URL): string[] {
  const trpcPrefix = "/api/trpc/";
  const trpcIndex = url.pathname.indexOf(trpcPrefix);
  if (trpcIndex === -1) return [];

  return url.pathname
    .substring(trpcIndex + trpcPrefix.length)
    .split(",")
    .map(endpoint => endpoint.trim())
    .filter(Boolean);
}

async function runLocalCheck(env: CloudflareFunctionEnv) {
  const targetUrl = env.CTO_MONITOR_TARGET_URL || "https://nakornchiangrainews.com";
  const startedAt = Date.now();
  const timeoutMs = Number(env.CTO_MONITOR_TIMEOUT_MS || 10000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? timeoutMs : 10000);

  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent": "NCR Watchdog Dashboard Pages Fallback",
      },
    });
    const httpCode = response.status;
    const isUp = httpCode >= 200 && httpCode < 400;
    return {
      httpCode,
      ttfbMs: Date.now() - startedAt,
      cacheStatus: response.headers.get("CF-Cache-Status") || "UNKNOWN",
      cfRay: response.headers.get("CF-Ray"),
      isUp,
      alertsFired: isUp ? [] : ["downtime"],
      autoFixApplied: false,
      uptimePercent: isUp ? 100 : 0,
      avgTtfbMs: Date.now() - startedAt,
    };
  } catch {
    return {
      httpCode: 0,
      ttfbMs: Date.now() - startedAt,
      cacheStatus: "UNKNOWN",
      cfRay: null,
      isUp: false,
      alertsFired: ["unreachable"],
      autoFixApplied: false,
      uptimePercent: 0,
      avgTtfbMs: 0,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function generateFallbackData(endpoint: string, env: CloudflareFunctionEnv): Promise<unknown> {
  if (endpoint.includes("monitor.runCheck")) {
    return runLocalCheck(env);
  }

  if (endpoint.includes("monitor.telegramConfig")) {
    const chatIds = normalizeTelegramChatIds(env);
    return {
      configured: chatIds.length > 0,
      botConfigured: Boolean(getTelegramBotToken(env)),
      chatIds,
      recipients: chatIds.join(","),
      status: "configured",
    };
  }

  if (endpoint.includes("monitor.quickStatus")) {
    return {
      isUp: false,
      httpCode: 0,
      ttfbMs: 0,
      uptimePercent: 0,
      avgTtfbMs: 0,
      checkedAt: new Date().toISOString(),
    };
  }

  if (endpoint.includes("monitor.cfAnalytics")) {
    return {
      analyticsAvailable: false,
      unavailableReason: "Cloudflare analytics unavailable from backend proxy",
      totalRequests: 0,
      cachedRequests: 0,
      cacheHitRate: 0,
      count404: 0,
      threats: 0,
      top404Urls: [],
    };
  }

  if (endpoint.includes("monitor.sendTestReport")) return { success: false, error: "Backend unavailable" };
  if (endpoint.includes("monitor.purgeCache")) return { success: false, message: "Backend unavailable" };
  if (endpoint.includes("monitor.approvePurge")) return { success: false, message: "Backend unavailable" };
  if (endpoint.includes("monitor.markFixed")) return { success: false, message: "Backend unavailable" };
  if (endpoint.includes("monitor.schedulerStatus")) return { schedules: [] };
  if (endpoint.includes("monitor.activeBrokenLinksCount")) return { count: 0 };
  if (endpoint.includes("monitor.securityLevel")) return { level: "unknown" };
  if (endpoint.includes("monitor.cacheDiagnostic")) return null;

  if (
    endpoint.includes("monitor.history") ||
    endpoint.includes("monitor.alerts") ||
    endpoint.includes("monitor.brokenLinks") ||
    endpoint.includes("monitor.cacheHistory") ||
    endpoint.includes("wpSentinel.getV6Data") ||
    endpoint.includes("wpSentinel.getLatencyTimeline")
  ) {
    return [];
  }

  return null;
}

function serializeTRPCData(data: unknown): unknown {
  return superjson.serialize(data);
}

async function buildFallbackPayload(url: URL, env: CloudflareFunctionEnv): Promise<unknown> {
  const endpoints = getRequestedEndpoints(url);
  const payloads = await Promise.all((endpoints.length ? endpoints : [""]).map(async endpoint => ({
    result: { data: serializeTRPCData(await generateFallbackData(endpoint, env)) },
  })));

  return url.searchParams.get("batch") === "1" ? payloads : payloads[0];
}

function shouldServeLocalFallback(url: URL): boolean {
  return getRequestedEndpoints(url).some(endpoint => endpoint.includes("monitor.telegramConfig") || endpoint.includes("monitor.runCheck"));
}

export const onRequest: PagesFunction<CloudflareFunctionEnv> = async context => {
  if (context.request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(context.request, context.env) });
  }

  const url = new URL(context.request.url);

  if (shouldServeLocalFallback(url)) {
    return applyCors(
      new Response(JSON.stringify(await buildFallbackPayload(url, context.env)), {
        status: 200,
        headers: { "Content-Type": "application/json", ...noStoreHeaders },
      }),
      context.request,
      context.env
    );
  }

  try {
    const response = await proxyToBackend(context, url.pathname);
    if (response.ok) return response;
    console.warn(`[pages/trpc] Backend proxy returned ${response.status}; serving safe fallback payload.`);
  } catch (error) {
    console.error("[pages/trpc] Backend proxy failed; serving safe fallback payload.", error);
  }

  return applyCors(
    new Response(JSON.stringify(await buildFallbackPayload(url, context.env)), {
      status: 200,
      headers: { "Content-Type": "application/json", ...noStoreHeaders },
    }),
    context.request,
    context.env
  );
};

