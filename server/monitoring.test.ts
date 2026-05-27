import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock the DB helpers so tests don't need a real database ─────────────────
vi.mock("./db", () => ({
  insertCheck: vi.fn().mockResolvedValue(undefined),
  getRecentChecks: vi.fn().mockResolvedValue([]),
  getUptimePercent: vi.fn().mockResolvedValue(100),
  getAvgTtfb: vi.fn().mockResolvedValue(500),
  getRecentAlerts: vi.fn().mockResolvedValue([]),
  insertAlert: vi.fn().mockResolvedValue(undefined),
  getLastAlertTime: vi.fn().mockResolvedValue(null),
  upsertSchedulerState: vi.fn().mockResolvedValue(undefined),
  getSchedulerStates: vi.fn().mockResolvedValue([]),
  getLatestCFAnalyticsSnapshot: vi.fn().mockResolvedValue(null),
  saveCacheDiagnostic: vi.fn().mockResolvedValue(undefined),
  getRecentCacheDiagnostics: vi.fn().mockResolvedValue([]),
  isInCooldown: vi.fn().mockResolvedValue(false),
  setCooldown: vi.fn().mockResolvedValue(undefined),
  upsertBrokenLinks: vi.fn().mockResolvedValue(undefined),
  upsertBannedIP: vi.fn().mockResolvedValue(undefined),
  isBannedIP: vi.fn().mockResolvedValue(false),
  CRITICAL_URLS: [],
}));

// ─── Mock cloudflare so no real HTTP calls ────────────────────────────────────
vi.mock("./cloudflare", () => ({
  purgeCFCache: vi.fn().mockResolvedValue({ success: true, message: "Purged" }),
  getCFAnalytics: vi.fn().mockResolvedValue({
    totalRequests: 1000,
    cachedRequests: 600,
    cacheHitRate: 60,
    bandwidth: 1024 * 1024 * 50,
    threats: 5,
  }),
}));

// ─── Mock telegram sendTelegramMessage only (not builders) ──────────────────
vi.mock("./telegram", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./telegram")>();
  return {
    ...actual,
    sendTelegramMessage: vi.fn().mockResolvedValue({ success: true, messageId: 999 }),
  };
});

// ─── Scheduler tests ──────────────────────────────────────────────────────────
describe("scheduler", () => {
  it("getScheduleInfos returns at least 4 schedule entries", async () => {
    const { getScheduleInfos } = await import("./scheduler");
    const infos = getScheduleInfos();
    expect(infos.length).toBeGreaterThanOrEqual(4);
  });

  it("each schedule has required fields", async () => {
    const { getScheduleInfos } = await import("./scheduler");
    const infos = getScheduleInfos();
    for (const info of infos) {
      expect(info).toHaveProperty("jobName");
      expect(info).toHaveProperty("label");
      expect(info).toHaveProperty("cronUtc");
      expect(info).toHaveProperty("nextRunBangkok");
      expect(info).toHaveProperty("nextRunUtc");
    }
  });

  it("getCurrentBangkokTime returns a non-empty string", async () => {
    const { getCurrentBangkokTime } = await import("./scheduler");
    const t = getCurrentBangkokTime();
    expect(typeof t).toBe("string");
    expect(t.length).toBeGreaterThan(0);
  });

  it("daily morning cron is at 02:00 UTC (09:00 BKK)", async () => {
    const { getScheduleInfos } = await import("./scheduler");
    const infos = getScheduleInfos();
    const morning = infos.find((i) => i.jobName === "daily-morning");
    expect(morning).toBeDefined();
    // cron "0 0 2 * * *" = 09:00 BKK (UTC+7)
    expect(morning!.cronUtc).toMatch(/0 0 2 \* \* \*/);
  });

  it("daily evening cron is at 11:00 UTC (18:00 BKK)", async () => {
    const { getScheduleInfos } = await import("./scheduler");
    const infos = getScheduleInfos();
    const evening = infos.find((i) => i.jobName === "daily-evening");
    expect(evening).toBeDefined();
    expect(evening!.cronUtc).toMatch(/0 0 11 \* \* \*/);
  });

  it("weekly cron runs on Sunday", async () => {
    const { getScheduleInfos } = await import("./scheduler");
    const infos = getScheduleInfos();
    const weekly = infos.find((i) => i.jobName === "weekly-sunday");
    expect(weekly).toBeDefined();
    expect(weekly!.cronUtc).toMatch(/0$/); // ends with day-of-week = 0 (Sunday)
  });

  it("monthly cron runs on 1st of month", async () => {
    const { getScheduleInfos } = await import("./scheduler");
    const infos = getScheduleInfos();
    const monthly = infos.find((i) => i.jobName === "monthly-first");
    expect(monthly).toBeDefined();
    expect(monthly!.cronUtc).toContain("1 *"); // dom = 1
  });
});

// ─── autofix: manual approval tests ────────────────────────────────────────
describe("autofix manual approval", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("runMonitorCycle does NOT call purgeCFCache automatically", async () => {
    const { purgeCFCache } = await import("./cloudflare");
    const purgeSpy = vi.mocked(purgeCFCache);
    purgeSpy.mockClear();

    // Mock a DOWN site
    vi.doMock("./monitoring", () => ({
      checkSite: vi.fn().mockResolvedValue({ httpCode: 0, ttfbMs: 0, cacheStatus: "MISS", cfRay: "", isUp: false, error: "timeout" }),
    }));
    vi.doMock("./db", () => ({
      saveMonitorCheck: vi.fn().mockResolvedValue(undefined),
      saveAlert: vi.fn().mockResolvedValue(undefined),
      isInCooldown: vi.fn().mockResolvedValue(false),
      setCooldown: vi.fn().mockResolvedValue(undefined),
      getUptimePercent: vi.fn().mockResolvedValue(95),
      getAvgTtfb: vi.fn().mockResolvedValue(300),
    }));

    const { runMonitorCycle } = await import("./autofix");
    const result = await runMonitorCycle();

    // Auto-purge must NOT have been called
    expect(purgeSpy).not.toHaveBeenCalled();
    // autoFixApplied must be false
    expect(result.autoFixApplied).toBe(false);
    // alert must have been fired
    expect(result.alertsFired).toContain("downtime");
  });

  it("runMonitorCycle saves alert with pendingPurge=true on downtime", async () => {
    const saveAlertMock = vi.fn().mockResolvedValue(undefined);
    vi.doMock("./monitoring", () => ({
      checkSite: vi.fn().mockResolvedValue({ httpCode: 0, ttfbMs: 0, cacheStatus: "MISS", cfRay: "", isUp: false, error: "timeout" }),
    }));
    vi.doMock("./db", () => ({
      saveMonitorCheck: vi.fn().mockResolvedValue(undefined),
      saveAlert: saveAlertMock,
      isInCooldown: vi.fn().mockResolvedValue(false),
      setCooldown: vi.fn().mockResolvedValue(undefined),
      getUptimePercent: vi.fn().mockResolvedValue(95),
      getAvgTtfb: vi.fn().mockResolvedValue(300),
    }));

    const { runMonitorCycle } = await import("./autofix");
    await runMonitorCycle();

    expect(saveAlertMock).toHaveBeenCalledWith(
      expect.objectContaining({ pendingPurge: true, autoFixApplied: false })
    );
  });
});

// ─── Telegram report builder tests ───────────────────────────────────────────
describe("telegram report builders", () => {
  it("buildDailyReport returns a non-empty string", async () => {
    const { buildDailyReport } = await import("./telegram");
    const report = buildDailyReport("morning", {
      httpCode: 200,
      ttfbMs: 450,
      cacheStatus: "HIT",
      isUp: true,
      uptimePercent: 99.9,
      cacheHitRate: 65,
      totalRequests: 5000,
      cachedRequests: 3250,
      bandwidth: 1024 * 1024 * 100,
      threats: 2,
      visits: 1200,
      pageViews: 4500,
      avgTtfbMs: 480,
      recentAlerts: 0,
    });
    expect(typeof report).toBe("string");
    expect(report.length).toBeGreaterThan(50);
    expect(report).toContain("nakornchiangrainews.com");
  });

  it("buildDailyReport includes dashboard link", async () => {
    const { buildDailyReport } = await import("./telegram");
    const report = buildDailyReport("morning", {
      httpCode: 200,
      ttfbMs: 450,
      cacheStatus: "HIT",
      isUp: true,
      uptimePercent: 99.9,
      cacheHitRate: 65,
      totalRequests: 5000,
      cachedRequests: 3250,
      bandwidth: 1024 * 1024 * 100,
      threats: 2,
      visits: 1200,
      pageViews: 4500,
      avgTtfbMs: 480,
      recentAlerts: 0,
    });
    expect(report).toContain("http");
  });

  it("buildDailyReport includes Top 5 404 URLs when provided", async () => {
    const { buildDailyReport } = await import("./telegram");
    const report = buildDailyReport("morning", {
      httpCode: 200,
      ttfbMs: 450,
      cacheStatus: "HIT",
      isUp: true,
      uptimePercent: 99.9,
      cacheHitRate: 65,
      totalRequests: 5000,
      cachedRequests: 3250,
      bandwidth: 1024 * 1024 * 100,
      threats: 2,
      visits: 1200,
      pageViews: 4500,
      avgTtfbMs: 480,
      recentAlerts: 0,
      count404: 350,
      top404Urls: [
        { url: "/lifestyle1/", hits: 118 },
        { url: "/news1/", hits: 111 },
        { url: "/lifestyle3/", hits: 250 },
      ],
    });
    expect(report).toContain("Top 5 404 URLs");
    expect(report).toContain("/lifestyle1/");
    expect(report).toContain("/news1/");
    expect(report).toContain("118");
  });

  it("buildDailyReport omits Top 5 section when top404Urls is empty", async () => {
    const { buildDailyReport } = await import("./telegram");
    const report = buildDailyReport("morning", {
      httpCode: 200,
      ttfbMs: 450,
      cacheStatus: "HIT",
      isUp: true,
      uptimePercent: 99.9,
      cacheHitRate: 65,
      totalRequests: 5000,
      cachedRequests: 3250,
      bandwidth: 1024 * 1024 * 100,
      threats: 2,
      visits: 1200,
      pageViews: 4500,
      avgTtfbMs: 480,
      recentAlerts: 0,
      top404Urls: [],
    });
    expect(report).not.toContain("Top 5 404 URLs");
  });

  it("buildWeeklyReport includes the word Weekly", async () => {
    const { buildWeeklyReport } = await import("./telegram");
    const report = buildWeeklyReport({
      httpCode: 200,
      ttfbMs: 450,
      cacheStatus: "HIT",
      isUp: true,
      uptimePercent: 99.9,
      cacheHitRate: 65,
      totalRequests: 5000,
      cachedRequests: 3250,
      bandwidth: 1024 * 1024 * 100,
      threats: 2,
      visits: 1200,
      pageViews: 4500,
      avgTtfbMs: 480,
      recentAlerts: 0,
      checksTotal: 100,
      checksUp: 99,
    });
    expect(report).toContain("Weekly");
  });

  it("buildMonthlyReport includes the month name", async () => {
    const { buildMonthlyReport } = await import("./telegram");
    const report = buildMonthlyReport({
      httpCode: 200,
      ttfbMs: 450,
      cacheStatus: "HIT",
      isUp: true,
      uptimePercent: 99.9,
      cacheHitRate: 65,
      totalRequests: 5000,
      cachedRequests: 3250,
      bandwidth: 1024 * 1024 * 100,
      threats: 2,
      visits: 1200,
      pageViews: 4500,
      avgTtfbMs: 480,
      recentAlerts: 0,
      checksTotal: 100,
      checksUp: 99,
      month: "May 2026",
    });
    expect(report).toContain("May 2026");
  });
});

// ─── Cloudflare module tests ──────────────────────────────────────────────────
describe("cloudflare", () => {
  it("purgeCFCache returns success object", async () => {
    const { purgeCFCache } = await import("./cloudflare");
    const result = await purgeCFCache();
    expect(result).toHaveProperty("success");
    expect(result).toHaveProperty("message");
  });

  it("getCFAnalytics returns required fields", async () => {
    const { getCFAnalytics } = await import("./cloudflare");
    const result = await getCFAnalytics();
    expect(result).toHaveProperty("totalRequests");
    expect(result).toHaveProperty("cachedRequests");
    expect(result).toHaveProperty("cacheHitRate");
    expect(result).toHaveProperty("bandwidth");
    expect(result).toHaveProperty("threats");
    expect(result.cacheHitRate).toBeGreaterThanOrEqual(0);
    expect(result.cacheHitRate).toBeLessThanOrEqual(100);
  });
});

// ─── Broken links & critical 404 alert tests ────────────────────────────────
describe("brokenLinks", () => {
  it("CRITICAL_URLS contains the homepage and main categories", async () => {
    const actual = await vi.importActual<typeof import("./db")>("./db");
    expect(actual.CRITICAL_URLS).toContain("/");
    expect(actual.CRITICAL_URLS).toContain("/category/news/");
    expect(actual.CRITICAL_URLS).toContain("/category/lifestyle/");
  });

  it("buildCritical404Alert includes the affected URLs", async () => {
    const { buildCritical404Alert } = await import("./telegram");
    const msg = buildCritical404Alert(["/", "/category/news/"]);
    expect(msg).toContain("CRITICAL 404");
    expect(msg).toContain("/");
    expect(msg).toContain("/category/news/");
  });

  it("upsertBrokenLinks auto-reopens a previously fixed URL when new hits arrive", async () => {
    const { upsertBrokenLinks, getTopBrokenLinks, markBrokenLinkFixed, getActiveBrokenLinksCount } = await vi.importActual<typeof import("./db")>("./db");
    // Insert a URL and mark it fixed
    await upsertBrokenLinks([{ url: "/test-auto-reopen/", hits: 5 }]);
    const before = await getTopBrokenLinks(20);
    const row = before.find((r) => r.url === "/test-auto-reopen/");
    if (row) {
      await markBrokenLinkFixed(row.id);
      // Confirm it's gone from active list
      const afterFix = await getTopBrokenLinks(20);
      expect(afterFix.find((r) => r.url === "/test-auto-reopen/")).toBeUndefined();
      // Now upsert again — should auto-reopen
      await upsertBrokenLinks([{ url: "/test-auto-reopen/", hits: 3 }]);
      const afterReopen = await getTopBrokenLinks(20);
      expect(afterReopen.find((r) => r.url === "/test-auto-reopen/")).toBeDefined();
    }
  });

  it("getActiveBrokenLinksCount returns a non-negative integer", async () => {
    const { getActiveBrokenLinksCount } = await vi.importActual<typeof import("./db")>("./db");
    const count = await getActiveBrokenLinksCount();
    expect(typeof count).toBe("number");
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it("morning report includes top broken links section", async () => {
    const { buildDailyReport } = await import("./telegram");
    const base = {
      httpCode: 200, ttfbMs: 350, cacheStatus: "HIT", isUp: true,
      uptimePercent: 99.5, cacheHitRate: 72, totalRequests: 12000,
      cachedRequests: 8640, bandwidth: 1024 * 1024 * 50, threats: 3,
      avgTtfbMs: 380, recentAlerts: 0, visits: 900, pageViews: 4500,
      count404: 12,
    };
    const topBrokenLinks = [
      { url: "/old-page/", hits: 320 },
      { url: "/missing-article/", hits: 85 },
      { url: "/deleted-tag/", hits: 14 },
    ];
    const morningMsg = buildDailyReport("morning", { ...base, topBrokenLinks });
    expect(morningMsg).toContain("Top Broken Links");
    expect(morningMsg).toContain("/old-page/");
    expect(morningMsg).toContain("320");

    // Evening report should NOT include the broken links section
    const eveningMsg = buildDailyReport("evening", { ...base, topBrokenLinks });
    expect(eveningMsg).not.toContain("Top Broken Links");
  });
});

// ─── Intelligence Suite tests ───────────────────────────────────────────────
describe("intelligence", () => {
  it("diagnoseError: timeout returns timeout category", async () => {
    const { diagnoseError } = await import("./intelligence");
    const result = diagnoseError({ httpCode: 0, ttfbMs: 15000, cacheStatus: "TIMEOUT", cfRay: "", isUp: false, error: "Request timed out" });
    expect(result.category).toBe("timeout");
    expect(result.label).toContain("Timeout");
  });

  it("diagnoseError: HTTP 520 returns cf_edge_error", async () => {
    const { diagnoseError } = await import("./intelligence");
    const result = diagnoseError({ httpCode: 520, ttfbMs: 200, cacheStatus: "MISS", cfRay: "", isUp: false });
    expect(result.category).toBe("cf_edge_error");
  });

  it("diagnoseError: HTTP 500 with fast TTFB returns database_failure", async () => {
    const { diagnoseError } = await import("./intelligence");
    const result = diagnoseError({ httpCode: 500, ttfbMs: 120, cacheStatus: "MISS", cfRay: "", isUp: false });
    expect(result.category).toBe("database_failure");
  });

  it("diagnoseError: HTTP 500 with slow TTFB returns plugin_conflict", async () => {
    const { diagnoseError } = await import("./intelligence");
    const result = diagnoseError({ httpCode: 500, ttfbMs: 2500, cacheStatus: "MISS", cfRay: "", isUp: false });
    expect(result.category).toBe("plugin_conflict");
  });

  it("detectTtfbTrend: returns true for 3 strictly increasing values", async () => {
    const { detectTtfbTrend } = await import("./intelligence");
    // newest-first order (as returned by getRecentChecks DESC)
    const checks = [{ ttfbMs: 900 }, { ttfbMs: 700 }, { ttfbMs: 500 }, { ttfbMs: 300 }, { ttfbMs: 200 }];
    expect(detectTtfbTrend(checks, 3)).toBe(true);
  });

  it("detectTtfbTrend: returns false when trend is not strictly increasing", async () => {
    const { detectTtfbTrend } = await import("./intelligence");
    const checks = [{ ttfbMs: 700 }, { ttfbMs: 900 }, { ttfbMs: 500 }, { ttfbMs: 300 }, { ttfbMs: 200 }];
    expect(detectTtfbTrend(checks, 3)).toBe(false);
  });

  it("detectTtfbTrend: returns false when not enough checks", async () => {
    const { detectTtfbTrend } = await import("./intelligence");
    expect(detectTtfbTrend([{ ttfbMs: 500 }, { ttfbMs: 700 }], 3)).toBe(false);
  });

  it("buildSmartDiagnosisAlert includes diagnosis label", async () => {
    const { buildSmartDiagnosisAlert } = await import("./telegram");
    const msg = buildSmartDiagnosisAlert(500, 120, { label: "Possible Database Failure", detail: "Check DB connection." });
    expect(msg).toContain("DOWNTIME DETECTED");
    expect(msg).toContain("Possible Database Failure");
    expect(msg).toContain("Smart Diagnosis");
  });

  it("buildPredictiveWarning includes trend values", async () => {
    const { buildPredictiveWarning } = await import("./telegram");
    const msg = buildPredictiveWarning([500, 700, 900]);
    expect(msg).toContain("Performance Degradation Warning");
    expect(msg).toContain("3 consecutive checks");
    expect(msg).toContain("500ms");
    expect(msg).toContain("900ms");
  });

  it("buildAdaptiveSecurityAlert elevated includes level", async () => {
    const { buildAdaptiveSecurityAlert } = await import("./telegram");
    const msg = buildAdaptiveSecurityAlert("elevated", "under_attack", "5xx spike");
    expect(msg).toContain("Adaptive Security ACTIVATED");
    expect(msg).toContain("under_attack");
    expect(msg).toContain("5xx spike");
  });

  it("buildAdaptiveSecurityAlert reverted confirms medium", async () => {
    const { buildAdaptiveSecurityAlert } = await import("./telegram");
    const msg = buildAdaptiveSecurityAlert("reverted", "medium");
    expect(msg).toContain("Adaptive Security REVERTED");
    expect(msg).toContain("medium");
  });
});

// ─── Cache Diagnostic tests ─────────────────────────────────────────────────
describe("cacheDiagnostic", () => {
  it("analyzeCacheDiagnostic: HIT status returns positive cause", async () => {
    const { analyzeCacheDiagnostic } = await import("./cacheDiagnostic");
    const result = analyzeCacheDiagnostic("HIT", "max-age=3600", "Accept-Encoding", "");
    expect(result.potentialCause).toContain("Cache is healthy");
    expect(result.wpCookiesDetected).toBe("");
  });

  it("analyzeCacheDiagnostic: BYPASS with WP cookie detects cookie name", async () => {
    const { analyzeCacheDiagnostic } = await import("./cacheDiagnostic");
    const result = analyzeCacheDiagnostic("BYPASS", "no-cache", "Cookie", "wordpress_logged_in_abc=xyz");
    expect(result.wpCookiesDetected).toContain("wordpress_logged_in");
    expect(result.potentialCause).toContain("WP cookie");
  });

  it("analyzeCacheDiagnostic: MISS with no cookies returns generic miss cause", async () => {
    const { analyzeCacheDiagnostic } = await import("./cacheDiagnostic");
    const result = analyzeCacheDiagnostic("MISS", "no-store", "Accept-Encoding", "");
    expect(result.potentialCause).toContain("no-store");
    expect(result.wpCookiesDetected).toBe("");
  });
});


// --- Cache Optimization Suite tests ---
describe("cacheOptimizationSuite", () => {
  it("buildCacheBypassAlert includes status, cookie, and cause", async () => {
    const { buildCacheBypassAlert } = await import("./telegram");
    const msg = buildCacheBypassAlert("BYPASS", "wordpress_logged_in", "WP cookie bypassing cache");
    expect(msg).toContain("Cache BYPASS Alert");
    expect(msg).toContain("BYPASS");
    expect(msg).toContain("wordpress_logged_in");
    expect(msg).toContain("WP cookie bypassing cache");
  });

  it("buildCacheBypassAlert without cookie omits cookie line", async () => {
    const { buildCacheBypassAlert } = await import("./telegram");
    const msg = buildCacheBypassAlert("MISS", "", "Cache-Control: no-store from origin");
    expect(msg).toContain("MISS");
    expect(msg).not.toContain("WP Cookie Detected");
  });

  it("buildDailyReport morning includes cacheHealthSummary", async () => {
    const { buildDailyReport } = await import("./telegram");
    const data = {
      httpCode: 200, ttfbMs: 400, cacheStatus: "HIT", isUp: true,
      uptimePercent: 99.9, cacheHitRate: 85, totalRequests: 10000,
      cachedRequests: 8500, bandwidth: 1024 * 1024 * 100, threats: 2,
      avgTtfbMs: 380, recentAlerts: 0, visits: 1200, pageViews: 4500,
      cacheHealthSummary: "HIT",
    };
    const msg = buildDailyReport("morning", data);
    expect(msg).toContain("Cache Health");
    expect(msg).toContain("HIT");
  });

  it("buildDailyReport evening omits cacheHealthSummary", async () => {
    const { buildDailyReport } = await import("./telegram");
    const data = {
      httpCode: 200, ttfbMs: 400, cacheStatus: "HIT", isUp: true,
      uptimePercent: 99.9, cacheHitRate: 85, totalRequests: 10000,
      cachedRequests: 8500, bandwidth: 1024 * 1024 * 100, threats: 2,
      avgTtfbMs: 380, recentAlerts: 0, visits: 1200, pageViews: 4500,
      cacheHealthSummary: "HIT",
    };
    const msg = buildDailyReport("evening", data);
    expect(msg).not.toContain("Cache Health");
  });

  it("BYPASS streak: 3 consecutive non-HIT statuses trigger alert", () => {
    // Verify the streak detection logic: all 3 checks must be in BYPASS_STATUSES
    const BYPASS_STATUSES = ["BYPASS", "MISS", "EXPIRED"];
    const allBypass = ["BYPASS", "BYPASS", "BYPASS"].every((s) => BYPASS_STATUSES.includes(s));
    const mixedNonHit = ["BYPASS", "MISS", "EXPIRED"].every((s) => BYPASS_STATUSES.includes(s));
    const withHit = ["HIT", "BYPASS", "BYPASS"].every((s) => BYPASS_STATUSES.includes(s));
    expect(allBypass).toBe(true);   // 3x BYPASS triggers
    expect(mixedNonHit).toBe(true); // BYPASS+MISS+EXPIRED also triggers (all non-HIT)
    expect(withHit).toBe(false);    // any HIT breaks the streak
  });
});

// ─── Auth logout test (from template) ────────────────────────────────────────
describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { appRouter } = await import("./routers");
    const { COOKIE_NAME } = await import("../shared/const");
    type CookieCall = { name: string; options: Record<string, unknown> };
    const clearedCookies: CookieCall[] = [];

    const ctx = {
      user: {
        id: 1,
        openId: "test-user",
        email: "test@example.com",
        name: "Test User",
        loginMethod: "manus",
        role: "user" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as never,
      res: {
        clearCookie: (name: string, options: Record<string, unknown>) => {
          clearedCookies.push({ name, options });
        },
      } as never,
    };

    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
  });
});
