import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { checkSite } from "./monitoring";
import { purgeCFCache, getCFAnalytics, get404Stats } from "./cloudflare";
import { getCFSecurityLevel } from "./intelligence";
import { sendTelegramMessage, buildDailyReport } from "./telegram";
import { getRecentChecks, getUptimePercent, getAvgTtfb, getRecentAlerts, getSchedulerStates, resolveAlertPurge, getTopBrokenLinks, markBrokenLinkFixed, upsertBrokenLinks, CRITICAL_URLS, isInCooldown, setCooldown, getActiveBrokenLinksCount, saveCacheDiagnostic, getLatestCacheDiagnostic, getRecentCacheDiagnostics, getAllReplyTemplates, createReplyTemplate, updateReplyTemplate, deleteReplyTemplate, getAllToxicKeywords, createToxicKeyword, updateToxicKeyword, deleteToxicKeyword, upsertPersonalAgenda, getPersonalAgenda, getRecentAgendas } from "./db";
import { analyzeCacheDiagnostic } from "./cacheDiagnostic";
import { getScheduleInfos, getCurrentBangkokTime } from "./scheduler";
import { runMonitorCycle } from "./autofix";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  monitor: router({
    runCheck: publicProcedure.mutation(async () => {
      const result = await runMonitorCycle();
      // Fetch CF analytics and persist top-10 404 URLs to broken_links table
      // so manual "Run Check Now" clicks also populate the Broken Links Log
      // Persist cache diagnostic from the check result (non-blocking)
      try {
        const diag = analyzeCacheDiagnostic(
          result.check.cacheStatus,
          result.check.cacheControl ?? "",
          result.check.vary ?? "",
          result.check.setCookieHeader ?? ""
        );
        await saveCacheDiagnostic(diag);
      } catch (e) {
        console.warn("[cache-diag] failed to save:", e);
      }
      try {
        const cfData = await getCFAnalytics();
        if (cfData.top404Urls.length > 0) {
          await upsertBrokenLinks(cfData.top404Urls);
          const criticalHits = cfData.top404Urls.filter((entry) =>
            CRITICAL_URLS.some((p) => entry.url === p || entry.url.startsWith(p + "?"))
          );
          if (criticalHits.length > 0 && !(await isInCooldown("critical_404"))) {
            const { buildCritical404Alert } = await import("./telegram");
            await sendTelegramMessage(buildCritical404Alert(criticalHits.map((e) => e.url)));
            await setCooldown("critical_404", 60);
          }
        }
      } catch (e) {
        console.error("[runCheck] broken links upsert failed:", e);
      }
      return {
        httpCode: result.check.httpCode,
        ttfbMs: result.check.ttfbMs,
        cacheStatus: result.check.cacheStatus,
        cfRay: result.check.cfRay,
        isUp: result.check.isUp,
        alertsFired: result.alertsFired,
        autoFixApplied: result.autoFixApplied,
        uptimePercent: result.uptimePercent,
        avgTtfbMs: result.avgTtfbMs,
        error: result.check.error,
      };
    }),

    quickStatus: publicProcedure.query(async () => {
      const check = await checkSite();
      const uptimePercent = await getUptimePercent();
      const avgTtfbMs = await getAvgTtfb();
      return { ...check, uptimePercent, avgTtfbMs };
    }),

    history: publicProcedure.query(async () => {
      const checks = await getRecentChecks(100);
      return checks.map((c) => ({
        id: c.id,
        httpCode: c.httpCode,
        ttfbMs: c.ttfbMs,
        cacheStatus: c.cacheStatus ?? "UNKNOWN",
        cfRay: c.cfRay ?? "",
        isUp: c.isUp,
        createdAt: c.createdAt,
      }));
    }),

    purgeCache: publicProcedure.mutation(async () => {
      return purgeCFCache();
    }),

    cfAnalytics: publicProcedure.query(async () => {
      // count404 is now built into getCFAnalytics() via CF httpRequestsAdaptiveGroups
      const [cf, stats404] = await Promise.all([getCFAnalytics(), get404Stats()]);
      // Merge: CF count404 as primary, top404Urls from CF (already included in cf object)
      return { ...cf, top404Urls: cf.top404Urls };
    }),

    sendTestReport: publicProcedure.mutation(async () => {
      const checks = await getRecentChecks(1);
      const latestCheck = checks[0];
      const uptimePercent = await getUptimePercent();
      const avgTtfbMs = await getAvgTtfb();
      const cfData = await getCFAnalytics();
      const alerts = await getRecentAlerts(10);

      const reportData = {
        httpCode: latestCheck?.httpCode ?? 200,
        ttfbMs: latestCheck?.ttfbMs ?? 0,
        cacheStatus: latestCheck?.cacheStatus ?? "UNKNOWN",
        isUp: latestCheck?.isUp ?? true,
        uptimePercent,
        cacheHitRate: cfData.cacheHitRate,
        totalRequests: cfData.totalRequests,
        cachedRequests: cfData.cachedRequests,
        bandwidth: cfData.bandwidth,
        threats: cfData.threats,
        visits: cfData.visits,
        pageViews: cfData.pageViews,
        avgTtfbMs,
        recentAlerts: alerts.length,
        count404: cfData.count404,
        top404Urls: cfData.top404Urls,
      };

      const msg = buildDailyReport("morning", reportData);
      const result = await sendTelegramMessage(msg);
      return { success: result.success, messageId: result.messageId, error: result.error };
    }),

    schedulerStatus: publicProcedure.query(async () => {
      const scheduleInfos = getScheduleInfos();
      const dbStates = await getSchedulerStates();
      const currentTime = getCurrentBangkokTime();
      return {
        currentBangkokTime: currentTime,
        schedules: scheduleInfos.map((info) => {
          const dbState = dbStates.find((s) => s.jobName === info.jobName);
          return {
            jobName: info.jobName,
            label: info.label,
            cronUtc: info.cronUtc,
            nextRunBangkok: info.nextRunBangkok,
            nextRunUtc: info.nextRunUtc,
            lastRunAt: dbState?.lastRunAt ?? null,
            lastStatus: dbState?.lastStatus ?? "pending",
            taskUid: dbState?.scheduleCronTaskUid ?? null,
          };
        }),
      };
    }),

    alerts: publicProcedure.query(async () => {
      return getRecentAlerts(20);
    }),

    approvePurge: publicProcedure
      .input((v: unknown) => {
        const { alertId } = v as { alertId: number };
        if (typeof alertId !== "number") throw new Error("alertId must be a number");
        return { alertId };
      })
      .mutation(async ({ input }) => {
        const purgeResult = await purgeCFCache();
        if (purgeResult.success) {
          await resolveAlertPurge(input.alertId);
        }
        return { success: purgeResult.success, message: purgeResult.message };
      }),

    brokenLinks: publicProcedure.query(async () => {
      return getTopBrokenLinks(20);
    }),

    activeBrokenLinksCount: publicProcedure.query(async () => {
      const count = await getActiveBrokenLinksCount();
      return { count };
    }),

    markFixed: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await markBrokenLinkFixed(input.id);
        return { success: true };
      }),

    securityLevel: publicProcedure.query(async () => {
      const level = await getCFSecurityLevel();
      return { level: level ?? "medium" };
    }),

    cacheDiagnostic: publicProcedure.query(async () => {
      return getLatestCacheDiagnostic();
    }),

    /** Returns last 20 cache diagnostics for the status bar chart (newest first). */
    cacheHistory: publicProcedure.query(async () => {
      return getRecentCacheDiagnostics(20);
    }),

    summary: publicProcedure.query(async () => {
      const uptimePercent = await getUptimePercent();
      const avgTtfbMs = await getAvgTtfb();
      const cfData = await getCFAnalytics();
      const recentAlerts = await getRecentAlerts(5);
      const scheduleInfos = getScheduleInfos();
      return {
        uptimePercent,
        avgTtfbMs,
        cfData,
        recentAlerts,
        scheduleInfos,
        currentBangkokTime: getCurrentBangkokTime(),
      };
    }),
  }),

  // ─── Reply Templates (V3.4) ──────────────────────────────────────────────────
  replyTemplates: router({
    list: protectedProcedure.query(async () => getAllReplyTemplates()),
    create: protectedProcedure
      .input(z.object({ template: z.string().min(1).max(500) }))
      .mutation(async ({ input }) => { await createReplyTemplate(input.template); return { success: true }; }),
    update: protectedProcedure
      .input(z.object({ id: z.number().int().positive(), template: z.string().min(1).max(500).optional(), isActive: z.boolean().optional() }))
      .mutation(async ({ input }) => { const { id, ...patch } = input; await updateReplyTemplate(id, patch); return { success: true }; }),
    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => { await deleteReplyTemplate(input.id); return { success: true }; }),
  }),

  // ─── Toxic Keywords (V3.4) ───────────────────────────────────────────────────
  toxicKeywords: router({
    list: protectedProcedure.query(async () => getAllToxicKeywords()),
    create: protectedProcedure
      .input(z.object({ keyword: z.string().min(1).max(255), category: z.string().default("spam") }))
      .mutation(async ({ input }) => { await createToxicKeyword(input.keyword, input.category); return { success: true }; }),
    update: protectedProcedure
      .input(z.object({ id: z.number().int().positive(), keyword: z.string().min(1).max(255).optional(), category: z.string().optional(), isActive: z.boolean().optional() }))
      .mutation(async ({ input }) => { const { id, ...patch } = input; await updateToxicKeyword(id, patch); return { success: true }; }),
    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => { await deleteToxicKeyword(input.id); return { success: true }; }),
  }),


  // ─── WP Sentinel V6.0 ────────────────────────────────────────────────────────
  wpSentinel: router({
    getV6Data: publicProcedure.query(async () => {
      const { fetchWpSentinelV6 } = await import("./wordpress");
      return fetchWpSentinelV6();
    }),
    // V12.2: DB Latency Sparkline — 24h timeline data points
    getLatencyTimeline: publicProcedure.query(async () => {
      const { getWpDbLatencyTimeline } = await import("./db");
      return getWpDbLatencyTimeline(24);
    }),
  }),

  // ─── Personal Agenda (V3.4) ──────────────────────────────────────────────────
  agenda: router({
    get: protectedProcedure
      .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
      .query(async ({ input }) => getPersonalAgenda(input.date)),
    save: protectedProcedure
      .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), content: z.string().max(2000) }))
      .mutation(async ({ input }) => { await upsertPersonalAgenda(input.date, input.content); return { success: true }; }),
    recent: protectedProcedure.query(async () => getRecentAgendas(7)),
  }),
});

export type AppRouter = typeof appRouter;
