import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";

// ── Helper: call the Pages Function (functions/api/trpc/[[path]].ts) ──────────
// In production (Cloudflare Pages), the Pages Function handles /api/trpc/*
// directly. In dev (Express), we call the same endpoint relative to the origin.
// The Pages Function already reads CF_API_TOKEN and CLOUDFLARE_ZONE_ID from its
// own environment, so no credentials are needed here.

async function callPagesProc(proc: string): Promise<unknown> {
  // Use relative URL so it works both locally (Express proxy) and on Pages.
  const url = `/api/trpc/${proc}?batch=1`;
  const res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Pages function responded ${res.status}`);
  const json = (await res.json()) as unknown;
  const item = Array.isArray(json) ? (json[0] as Record<string, unknown>) : (json as Record<string, unknown>);
  return (item as Record<string, Record<string, unknown>>)?.result?.data
    ?? (item as Record<string, unknown>)?.result
    ?? item;
}

// ── Monitor router ────────────────────────────────────────────────────────────

const monitorRouter = router({
  quickStatus: publicProcedure.query(() => callPagesProc("monitor.quickStatus")),
  runCheck: publicProcedure.mutation(() => callPagesProc("monitor.runCheck")),
  cfAnalytics: publicProcedure.query(() => callPagesProc("monitor.cfAnalytics")),
  purgeCache: publicProcedure.mutation(() => callPagesProc("monitor.purgeCache")),
  sendTestReport: publicProcedure.mutation(() => callPagesProc("monitor.sendTestReport")),
  history: publicProcedure.query(() => callPagesProc("monitor.history")),
  alerts: publicProcedure.query(() => callPagesProc("monitor.alerts")),
  schedulerStatus: publicProcedure.query(() => callPagesProc("monitor.schedulerStatus")),
  securityLevel: publicProcedure.query(() => callPagesProc("monitor.securityLevel")),
  activeBrokenLinksCount: publicProcedure.query(() => callPagesProc("monitor.activeBrokenLinksCount")),
  brokenLinks: publicProcedure.query(() => callPagesProc("monitor.brokenLinks")),
  cacheDiagnostic: publicProcedure.query(() => callPagesProc("monitor.cacheDiagnostic")),
  cacheHistory: publicProcedure.query(() => callPagesProc("monitor.cacheHistory")),
  summary: publicProcedure.query(() => callPagesProc("monitor.summary")),
  telegramConfig: publicProcedure.query(() => callPagesProc("monitor.telegramConfig")),
  approvePurge: publicProcedure
    .input(z.object({ alertId: z.number() }))
    .mutation(() => callPagesProc("monitor.approvePurge")),
  markFixed: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(() => callPagesProc("monitor.markFixed")),
});

// ── WP Sentinel router ────────────────────────────────────────────────────────

const wpSentinelRouter = router({
  getV6Data: publicProcedure.query(() => callPagesProc("wpSentinel.getV6Data")),
  getLatencyTimeline: publicProcedure.query(() => callPagesProc("wpSentinel.getLatencyTimeline")),
});

// ── App router ────────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  monitor: monitorRouter,
  wpSentinel: wpSentinelRouter,
});

export type AppRouter = typeof appRouter;
