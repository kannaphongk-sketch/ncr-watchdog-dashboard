import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";

type Env = Record<string, string | undefined>;
type PagesContext = { request: Request; env: Env; params: { path?: string | string[] }; waitUntil?: (promise: Promise<unknown>) => void };

type MonitorCheck = {
  id: number;
  httpCode: number;
  ttfbMs: number;
  cacheStatus: string;
  cfRay: string;
  isUp: boolean;
  createdAt: string;
};

type Alert = {
  id: number;
  alertType: string;
  message: string;
  autoFixApplied: boolean;
  httpCode: number;
  ttfbMs: number;
  resolved: boolean;
  pendingPurge: boolean;
  createdAt: string;
};

const state = globalThis as typeof globalThis & {
  __ncrChecks?: MonitorCheck[];
  __ncrAlerts?: Alert[];
  __ncrCacheHistory?: Array<{ id: number; cfCacheStatus: string; cacheControl: string; vary: string; wpCookiesDetected: string; potentialCause: string; createdAt: string }>;
};

const checks = (state.__ncrChecks ??= []);
const alerts = (state.__ncrAlerts ??= []);
const cacheHistory = (state.__ncrCacheHistory ??= []);

const t = initTRPC.context<{ env: Env }>().create({ transformer: superjson });
const publicProcedure = t.procedure;
const router = t.router;

const targetUrl = (env: Env) => env.CTO_MONITOR_TARGET_URL || "https://nakornchiangrainews.com";
const nowIso = () => new Date().toISOString();
const bangkokTime = () => new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });

async function probeSite(env: Env): Promise<MonitorCheck> {
  const started = Date.now();
  const controller = new AbortController();
  const timeoutMs = Number(env.CTO_MONITOR_TIMEOUT_MS || "10000");
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(targetUrl(env), {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "NCR-Watchdog/Cloudflare-Pages",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    const latency = Date.now() - started;
    const check: MonitorCheck = {
      id: checks.length + 1,
      httpCode: res.status,
      ttfbMs: latency,
      cacheStatus: res.headers.get("cf-cache-status") || "UNKNOWN",
      cfRay: res.headers.get("cf-ray") || "",
      isUp: res.status >= 200 && res.status < 500,
      createdAt: nowIso(),
    };
    checks.unshift(check);
    checks.splice(100);
    cacheHistory.unshift({
      id: cacheHistory.length + 1,
      cfCacheStatus: check.cacheStatus,
      cacheControl: res.headers.get("cache-control") || "",
      vary: res.headers.get("vary") || "",
      wpCookiesDetected: res.headers.get("set-cookie") ? "yes" : "no",
      potentialCause: check.cacheStatus === "BYPASS" || check.cacheStatus === "MISS" ? "Cache may not be fully warmed or request is bypassing edge cache." : "No immediate cache issue detected.",
      createdAt: check.createdAt,
    });
    cacheHistory.splice(20);
    const threshold = Number(env.CTO_MONITOR_LATENCY_THRESHOLD_MS || "2000");
    if (!check.isUp || check.ttfbMs > threshold) {
      alerts.unshift({
        id: alerts.length + 1,
        alertType: check.isUp ? "high_latency" : "downtime",
        message: check.isUp ? `High latency detected at ${check.ttfbMs}ms` : `Downtime or blocked response detected with HTTP ${check.httpCode}`,
        autoFixApplied: false,
        httpCode: check.httpCode,
        ttfbMs: check.ttfbMs,
        resolved: false,
        pendingPurge: true,
        createdAt: check.createdAt,
      });
      alerts.splice(20);
    }
    return check;
  } catch (error) {
    const latency = Date.now() - started;
    const check: MonitorCheck = { id: checks.length + 1, httpCode: 0, ttfbMs: latency, cacheStatus: "ERROR", cfRay: "", isUp: false, createdAt: nowIso() };
    checks.unshift(check);
    checks.splice(100);
    alerts.unshift({ id: alerts.length + 1, alertType: "downtime", message: error instanceof Error ? error.message : String(error), autoFixApplied: false, httpCode: 0, ttfbMs: latency, resolved: false, pendingPurge: true, createdAt: check.createdAt });
    alerts.splice(20);
    return check;
  } finally {
    clearTimeout(timeout);
  }
}

const uptimePercent = () => {
  if (!checks.length) return 100;
  const up = checks.filter((c) => c.isUp).length;
  return Math.round((up / checks.length) * 10000) / 100;
};

const avgTtfbMs = () => {
  if (!checks.length) return 0;
  return Math.round(checks.reduce((sum, c) => sum + c.ttfbMs, 0) / checks.length);
};

const scheduleInfos = () => [
  { jobName: "monitor-check", label: "Monitor Check", cronUtc: "*/15 * * * *", nextRunBangkok: "Cloudflare Pages Function manual/cron-ready", nextRunUtc: "Cloudflare Pages Function manual/cron-ready" },
  { jobName: "daily-report", label: "Daily Report", cronUtc: "0 0 * * *", nextRunBangkok: "Cloudflare cron not yet bound", nextRunUtc: "Cloudflare cron not yet bound" },
];

const appRouter = router({
  auth: router({
    me: publicProcedure.query(() => null),
    logout: publicProcedure.mutation(() => ({ success: true } as const)),
  }),
  monitor: router({
    runCheck: publicProcedure.mutation(async ({ ctx }) => {
      const check = await probeSite(ctx.env);
      return { ...check, alertsFired: alerts.length, autoFixApplied: false, uptimePercent: uptimePercent(), avgTtfbMs: avgTtfbMs() };
    }),
    quickStatus: publicProcedure.query(async ({ ctx }) => {
      const check = checks[0] || (await probeSite(ctx.env));
      return { ...check, uptimePercent: uptimePercent(), avgTtfbMs: avgTtfbMs() };
    }),
    history: publicProcedure.query(() => checks),
    purgeCache: publicProcedure.mutation(async ({ ctx }) => {
      const token = ctx.env.CF_API_TOKEN || ctx.env.CLOUDFLARE_API_TOKEN;
      const zone = ctx.env.CF_ZONE_ID || ctx.env.CLOUDFLARE_ZONE_ID;
      if (!token || !zone) return { success: false, message: "Cloudflare API token or zone ID is not configured." };
      const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/purge_cache`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ purge_everything: true }) });
      return { success: res.ok, message: res.ok ? "Cloudflare cache purge requested." : `Cloudflare purge failed with HTTP ${res.status}` };
    }),
    cfAnalytics: publicProcedure.query(() => ({ cacheHitRate: 0, totalRequests: 0, cachedRequests: 0, bandwidth: "0 MB", threats: 0, visits: 0, pageViews: 0, count404: 0, top404Urls: [] })),
    sendTestReport: publicProcedure.mutation(() => ({ success: true, messageId: undefined, error: undefined })),
    schedulerStatus: publicProcedure.query(() => ({ currentBangkokTime: bangkokTime(), schedules: scheduleInfos().map((s) => ({ ...s, lastRunAt: checks[0]?.createdAt ?? null, lastStatus: checks[0] ? "success" : "pending", taskUid: null })) })),
    alerts: publicProcedure.query(() => alerts),
    approvePurge: publicProcedure.input(z.object({ alertId: z.number() })).mutation(({ input }) => {
      const alert = alerts.find((a) => a.id === input.alertId);
      if (alert) { alert.resolved = true; alert.pendingPurge = false; }
      return { success: true, message: "Alert marked resolved in Cloudflare Function memory." };
    }),
    brokenLinks: publicProcedure.query(() => []),
    activeBrokenLinksCount: publicProcedure.query(() => ({ count: 0 })),
    markFixed: publicProcedure.input(z.object({ id: z.number() })).mutation(() => ({ success: true })),
    securityLevel: publicProcedure.query(() => ({ level: "medium" })),
    cacheDiagnostic: publicProcedure.query(() => cacheHistory[0] || null),
    cacheHistory: publicProcedure.query(() => cacheHistory),
    summary: publicProcedure.query(() => ({ uptimePercent: uptimePercent(), avgTtfbMs: avgTtfbMs(), cfData: { cacheHitRate: 0, totalRequests: 0, cachedRequests: 0, bandwidth: "0 MB", threats: 0, visits: 0, pageViews: 0, count404: 0, top404Urls: [] }, recentAlerts: alerts.slice(0, 5), scheduleInfos: scheduleInfos(), currentBangkokTime: bangkokTime() })),
  }),
  wpSentinel: router({
    getV6Data: publicProcedure.query(() => ({ ok: true, source: "cloudflare-pages-minimal", checkedAt: nowIso(), metrics: {} })),
    getLatencyTimeline: publicProcedure.query(() => checks.slice(0, 24).map((c) => ({ createdAt: c.createdAt, latencyMs: c.ttfbMs, ttfbMs: c.ttfbMs }))),
  }),
  replyTemplates: router({
    list: publicProcedure.query(() => []),
    create: publicProcedure.mutation(() => ({ success: true })),
    update: publicProcedure.mutation(() => ({ success: true })),
    delete: publicProcedure.mutation(() => ({ success: true })),
  }),
  toxicKeywords: router({
    list: publicProcedure.query(() => []),
    create: publicProcedure.mutation(() => ({ success: true })),
    update: publicProcedure.mutation(() => ({ success: true })),
    delete: publicProcedure.mutation(() => ({ success: true })),
  }),
  agenda: router({
    get: publicProcedure.query(() => null),
    save: publicProcedure.mutation(() => ({ success: true })),
  }),
});

export type AppRouter = typeof appRouter;

const noStoreHeaders = {
  "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
  "cdn-cache-control": "no-store",
  pragma: "no-cache",
  expires: "0",
};

export const onRequestOptions = () => new Response(null, { status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type,authorization,x-trpc-source", ...noStoreHeaders } });

export const onRequest = async (context: PagesContext) => {
  const pathParam = context.params.path;
  const path = Array.isArray(pathParam) ? pathParam.join("/") : pathParam || "";
  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req: context.request,
    router: appRouter,
    path,
    createContext: async () => ({ env: context.env }),
  });
  const headers = new Headers(response.headers);
  Object.entries(noStoreHeaders).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, { status: response.status, headers });
};

export const onRequestGet = onRequest;
export const onRequestPost = onRequest;
