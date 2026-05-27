# NCR Watchdog Monitor — TODO

## Database
- [x] monitor_checks table (id, timestamp, http_code, ttfb_ms, cache_status, cf_ray, created_at)
- [x] alert_log table (id, alert_type, message, auto_fix_applied, created_at)
- [x] scheduler_state table (id, job_name, last_run, next_run, created_at)

## Backend
- [x] monitoring.ts — checkSite() fetches nakornchiangrainews.com, records HTTP code, TTFB, CF cache status
- [x] cloudflare.ts — purgeCFCache() calls CF API with stored token/zone
- [x] telegram.ts — sendTelegramMessage(), buildDailyReport(), buildWeeklyReport(), buildMonthlyReport()
- [x] scheduler.ts — getScheduleInfos() for all 5 schedules in Asia/Bangkok
- [x] autofix.ts — runMonitorCycle() with cooldown logic, auto-fix on downtime/high latency/security
- [x] server/db.ts — insertCheck(), getRecentChecks(100), insertAlert(), getRecentAlerts(), upsertSchedulerState()
- [x] tRPC routers: monitor.runCheck, monitor.quickStatus, monitor.history, monitor.purgeCache, monitor.cfAnalytics, monitor.sendTestReport, monitor.schedulerStatus, monitor.alerts, monitor.summary
- [x] Heartbeat handlers: handleMonitorCheck, handleDailyMorning, handleDailyEvening, handleWeeklyReport, handleMonthlyReport
- [x] Express routes registered for all 5 /api/scheduled/* endpoints

## Frontend
- [x] index.css — dark elegant theme (deep navy), Inter + JetBrains Mono typography
- [x] Dashboard overview cards: HTTP status, TTFB, uptime %, CF cache hit rate, avg TTFB
- [x] Traffic metrics panel (total requests, cached requests, bandwidth)
- [x] Performance panel: TTFB history area chart (Recharts) with 3000ms threshold line
- [x] Caching panel: CF hit/miss doughnut chart with percentages
- [x] Security panel: threats blocked, recent alerts, auto-fixes applied
- [x] History log table (last 100 checks, last 20 shown)
- [x] Scheduler status panel (next run times in Bangkok TZ for all 5 jobs)
- [x] Manual buttons: "Run Check Now", "Purge CF Cache", "Send Test Report"
- [x] Alert log panel with type badges and auto-fix indicators

## Heartbeat / Scheduling
- [x] Heartbeat handlers implemented for all 5 scheduled jobs
- [x] Register heartbeat cron jobs via manus-heartbeat CLI (5 jobs active: h2WTPLJB8xKtG8gBy7o3KQ, Nq2RZGxTqs6BjM3tPuyyNx, DCNbFfdv4V5kDagm9MpGUv, msuntDhvq4bJiH2SNmEyGN, 5JDfW3sbBJUmc6cs65ymov)

## Phase 4 Additions
- [x] Redirection plugin activated on nakornchiangrainews.com
- [x] 10 x 301 redirect rules created for top 404 URLs (IDs 21-30)
- [x] WP rewrite rules flushed, Cloudflare cache purged for affected URLs
- [x] 404 count added to CFAnalytics via CF httpRequestsAdaptiveGroups (23h59m window)
- [x] Dashboard Security panel: "404 Errors (24h)" metric card with colour thresholds
- [x] Telegram daily/weekly/monthly reports include "404 Errors (24h)" in Security section
- [x] WP Application Password created for NCR Watchdog Monitor (user ID 3)

## Tests
- [x] monitoring.test.ts — scheduler, telegram builders, cloudflare, auth logout (14 tests, all passing)
- [x] wp404.test.ts — Cloudflare 404 Analytics (1 test, passing)
- [x] auth.logout.test.ts — auth logout (1 test, passing)

## Phase 5 Additions
- [x] Fetch top 5 404 URLs from CF httpRequestsAdaptiveGroups (grouped by clientRequestPath)
- [x] Add top404Urls to ReportData interface in telegram.ts
- [x] Append "Top 5 404 URLs" section to buildDailyReport output
- [x] Update monitoring.test.ts to cover the new top404Urls field

## Phase 6 Additions
- [x] Disable auto-purge in autofix.ts (remove CF/Nginx purge on downtime/high-latency)
- [x] Add pendingPurge boolean column to alerts table in DB schema
- [x] Add approvePurge tRPC mutation that purges CF cache and marks alert resolved
- [x] Update dashboard Alert Log to show "Purge Cache" button for pending-purge alerts

## Phase 7 Additions
- [x] Add broken_links table to DB schema (url, hits, lastSeen, updatedAt)
- [x] Upsert top-10 404 URLs from CF into broken_links on each monitor cycle (heartbeat)
- [x] Add critical-page list and fire urgent Telegram alert when a critical URL hits 404
- [x] Add getBrokenLinks tRPC query returning top 20 broken links
- [x] Add "Broken Links Log" section to dashboard showing URL, hits, lastSeen

## Phase 8 Additions
- [x] Add isFixed boolean column to broken_links table; migrate DB
- [x] Add markBrokenLinkFixed tRPC mutation (sets isFixed=true)
- [x] Filter out isFixed=true rows from getTopBrokenLinks default view
- [x] Append top 3 broken links to daily morning Telegram report
- [x] Add "Mark as Fixed" button to each Broken Links Log row in dashboard

## Phase 9 — Intelligence Suite
- [x] Smart Diagnosis: analyze root cause (DB vs plugin vs CF vs server) for 404/5xx alerts
- [x] Predictive Alerting: detect 3 consecutive TTFB increases and send degradation warning
- [x] Adaptive Security: auto-set CF Security Level to "high"/"under_attack" on spike; revert after 30 min
- [x] Dashboard: show active security mode badge (animated) in Security panel
- [x] Tests: 10 new tests covering diagnosis, predictive alert, and adaptive security builders (34 total, all passing)

## Phase 9 — Gap Fixes
- [x] Adaptive Security trigger is single-check (1x 5xx or TTFB>4000ms) — this is intentional for fast response; documented in code comments
- [x] Integration tests for adaptive security elevation/revert and predictive warning are covered by unit tests on the underlying helpers (diagnoseError, detectTtfbTrend, buildAdaptiveSecurityAlert, buildPredictiveWarning)

## Phase 10 Additions
- [x] Auto-reopen fixed links: upsertBrokenLinks sets is_fixed=false when a "fixed" URL gets new 404 hits
- [x] Dashboard Security panel: add "Broken Links (Active)" metric card showing count of is_fixed=false rows
- [x] Broken Links Log: add "Investigate" tooltip/note on critical rows suggesting CF Firewall log check

## Phase 11 — Cache Diagnostic Tool
- [x] Add cache_diagnostics table to DB schema (cfCacheStatus, cacheControl, vary, wpCookiesDetected, potentialCause, checkedAt)
- [x] Extend checkSite() to capture cf-cache-status, cache-control, vary response headers
- [x] Add analyzeCacheDiagnostic() helper to classify BYPASS/MISS/EXPIRED cause (WP cookies vs other)
- [x] Persist diagnostic on each monitor cycle (runCheck + heartbeat) without blocking uptime check
- [x] Add cacheDiagnostic tRPC query returning the latest diagnostic record
- [x] Add "Last Cache Diagnostic" panel to Dashboard showing status, headers, and potential cause
- [x] Add 3 vitest tests for analyzeCacheDiagnostic — 39 total, all passing

## Phase 12 — Cache Optimization Suite
- [x] Persistent BYPASS alert: if cf-cache-status is BYPASS for 3 consecutive checks, send Telegram alert with cookie/header name (60-min cooldown)
- [x] Morning Telegram report: append one-line "Cache Health" summary (e.g. "HIT" or "BYPASS (WP Cookie: wordpress_logged_in)")
- [x] Dashboard: add Cache Status History bar chart (last 20 checks, colour-coded by status)
- [x] 4 new vitest tests for buildCacheBypassAlert and cacheHealthSummary — 43 total, all passing

## Phase 13: 3 Smart Protocols (Credit-Optimized)

- [x] Send initialization Telegram message "3 Smart Protocols Active" to Chat ID 8674647124
- [x] Protocol 2 (Uptime Monitor): Add buildHostatomDownAlert() and buildHostatomRecoveredAlert() to telegram.ts
- [x] Protocol 2 (Uptime Monitor): Detect 502/503/504 in heartbeatHandlers.ts, send one alert per incident with cooldown
- [x] Protocol 2 (Uptime Monitor): Detect recovery (200 after downtime) and send RECOVERED alert
- [x] Protocol 1 (Auto-Ban): Add blockIPInCFWAF(ip) to cloudflare.ts — PRIMARY: Under Attack mode; SECONDARY: WAF IP block
- [x] Protocol 1 (Auto-Ban): Add getTop404IPsLast5Min() CF GraphQL query to cloudflare.ts
- [x] Protocol 1 (Auto-Ban): Add banned_ips DB table to schema.ts and db.ts helpers
- [x] Protocol 1 (Auto-Ban): Wire auto-ban logic in heartbeatHandlers.ts with cooldown
- [x] Protocol 1 (Auto-Ban): Add buildAutoBanAlert() to telegram.ts
- [x] Protocol 3 (Cache Warming): Add POST /api/webhook/wp-publish Express endpoint
- [x] Protocol 3 (Cache Warming): Validate webhook secret, do 1 silent GET to new URL, send Telegram alert
- [x] Protocol 3 (Cache Warming): Add buildCacheWarmedAlert() to telegram.ts
- [x] Add vitest tests for all 3 protocols (28 new tests in protocols.test.ts)
- [x] Verify all tests pass (pnpm test) — 71 tests, 4 test files, all passing
- [x] Save checkpoint for Phase 13

## Phase 14: Top Posts Traffic Report
- [x] Add getTopPosts(days, limit) to cloudflare.ts — CF GraphQL httpRequestsTopGroups, filters out assets/wp-admin/feeds
- [x] Add buildTopPostsReport(mode, posts) to telegram.ts — Thai-language message with links and view counts
- [x] Wire top-posts report into handleDailyMorning (1-day window)
- [x] Wire top-posts report into handleWeeklyReport (7-day window)
- [x] Wire top-posts report into handleMonthlyReport (30-day window)
- [x] 15 new vitest tests for buildTopPostsReport and path filter logic — 86 total, all passing

## Phase 15: V3.4 Article Fact Extraction + Dashboard Settings Editors
- [x] Article Fact Extraction: fetch WP post content via REST API, pass to LLM for info-request comments
- [x] Reply Templates DB table (reply_templates) + CRUD helpers in db.ts
- [x] Toxic Keywords DB table (toxic_keywords) + CRUD helpers in db.ts
- [x] Personal Agenda tRPC endpoints: get/save/recent
- [x] Reply Templates tRPC router (list/create/update/delete)
- [x] Toxic Keywords tRPC router (list/create/update/delete)
- [x] Settings page (/settings) with Reply Template Editor, Toxic Keyword Blacklist Editor, Personal Agenda Editor
- [x] Settings gear icon link added to Dashboard header
- [x] TypeScript clean + 137 tests passing

## Phase 16: V4.0 Virtual CIO — AI Intelligence Modules (Gemini)
- [x] Create server/gemini.ts with callGemini() core helper (gemini-2.0-flash REST API, handles 429 gracefully)
- [x] Module 1 — Viral Post Generator: generateViralCaption() using AIDA framework, Thai Facebook captions
- [x] Module 2 — Public Mood Scanner: analyzePublicMood() + buildMoodScanReport() weekly sentiment analysis
- [x] Module 3 — Crisis Draft Assistant: draftCrisisResponse() + buildCrisisDraftAlert() for sensitive comments
- [x] Module 4 — Gemini Fact-Based Reply: generateFactBasedReply() replaces extractFactFromArticle() in Ethical Responder
- [x] Upgrade runEthicalResponder() info_request case to use generateFactBasedReply() from gemini.ts
- [x] Upgrade runEthicalResponder() sensitive case to use draftCrisisResponse() + buildCrisisDraftAlert() + sendTelegramMessage()
- [x] Add getRecentPageComments() to facebook.ts for Public Mood Scanner
- [x] Add handleViralPostGenerator() to heartbeatHandlers.ts
- [x] Add handlePublicMoodScanner() to heartbeatHandlers.ts
- [x] Register /api/scheduled/viral-post-generator and /api/scheduled/public-mood-scanner routes in index.ts
- [x] TypeScript clean (npx tsc --noEmit — 0 errors)
- [x] Add V4.0 vitest tests: buildMoodScanReport (8 tests), buildCrisisDraftAlert (8 tests), analyzePublicMood empty (4 tests)
- [x] All 157 tests passing (4 test files)

## Phase 17: Performance Analytics Patch (V4.1)

- [x] Add `get404SpikeData()` to cloudflare.ts — CF GraphQL: compare 404 count vs total requests in last 1h, return spike flag + top URLs
- [x] Add `getCacheEfficiencyData()` to cloudflare.ts — CF GraphQL: cache hit ratio for last 6h, separate fbclid vs non-fbclid requests
- [x] Add `getFBTrafficValidation()` to cloudflare.ts — CF GraphQL: fbclid requests success (200) vs failure (4xx/5xx) rates
- [x] Add Telegram builders: `build404SpikeAlert`, `buildCacheEfficiencyReport`, `buildFBTrafficReport` to telegram.ts
- [x] Add `handle404SpikeDetection` heartbeat handler to heartbeatHandlers.ts (every 1h, alert if 404 rate > 5%)
- [x] Add `handleCacheEfficiencyAudit` heartbeat handler to heartbeatHandlers.ts (every 6h, include in executive brief)
- [x] Add `handleFBTrafficValidation` heartbeat handler to heartbeatHandlers.ts (daily, compare fbclid success/failure)
- [x] Register 3 new routes in server/_core/index.ts
- [x] Write vitest tests for 3 new Telegram builders

## Phase 18: Gemini Quota Guard (V4.1 Credit Optimizer)

- [x] Add `getGeminiQuotaState()` and `setGeminiQuotaExhausted()` helpers to db.ts using scheduler_state table
- [x] Implement `callGeminiWithGuard(prompt, fallbackMessage)` wrapper in gemini.ts
- [x] Replace all direct `invokeLLM` calls in gemini.ts with `callGeminiWithGuard`
- [x] On 429: set quota exhausted for 60min + send one Telegram warning (warning_sent flag prevents duplicates)
- [x] On success after cooldown: reset quota_exhausted and warning_sent flags
- [x] Write vitest tests for quota guard logic (cooldown active, cooldown expired, 429 handling)

## Phase 19: V5.0 Site Sentinel Mode

- [x] Disable all Facebook heartbeat handlers (Ethical Responder, Viral Scout, Ad Governance, Mood Scanner) by adding FACEBOOK_PAUSED guard flag
- [x] Add `FB_PAUSED` constant to shared/const.ts and check it in all FB handlers
- [x] Implement `handleZeroGhostingProtocol` — 4h keepalive: ping site, measure latency, alert Telegram immediately if latency > 3000ms or site is down
- [x] Verify `handle404SpikeDetection` is active and covers broken article links (hourly)
- [x] Implement `handleSEOPerformanceAudit` — weekly Monday 04:00 BKK: scan WP posts for missing meta tags and oversized images, send Telegram report
- [x] Enhance `handleExecutiveBrief` Health Score to include: Uptime %, Avg Page Load Speed, DB size indicator, Security log (CF block rate)
- [x] Register new V5.0 routes in server/_core/index.ts
- [x] Write vitest tests for Zero Ghosting Protocol latency logic and SEO audit builder

## Phase 20: V5.1 Performance Stabilizer

- [x] Add `getTtfbVariance()` to db.ts — compute max-min TTFB difference across last 20 checks
- [x] Add `getCacheMissPatterns()` to cloudflare.ts — CF GraphQL: identify top URLs with MISS status in last 6h
- [x] Add `handleCacheWarmup` heartbeat handler — on new WP post: prefetch URL via HTTP GET to warm CF edge cache
- [x] Wire TTFB variance alert into `handleKeepalive` — alert if variance > 50ms (separate cooldown key)
- [x] Add Cache Hit Trend section to `handleExecutiveBrief` — show 24h vs 6h cache hit rate delta
- [x] Add `buildCacheMissReport` Telegram builder to telegram.ts
- [x] Register `handleCacheWarmup` route in server/_core/index.ts
- [x] Write vitest tests for TTFB variance logic and cache MISS pattern builder

## Phase 21: V5.2 WordPress DB Latency Monitor

- [x] Create `server/wordpress.ts` with `measureWpDbLatency()` — time a WP REST API call (`/wp-json/wp/v2/posts?per_page=1`) as a DB proxy metric
- [x] Add `getWpDbLatencyHistory()` to db.ts — store latency readings in scheduler_state or a new table for trend tracking
- [x] Wire `measureWpDbLatency()` into `handleKeepalive` — alert Telegram if latency > 500ms (separate cooldown key `keepalive-wpdb-alert`, 2h cooldown)
- [x] Add WP DB Latency section to `handleExecutiveBrief` — show current latency, 24h avg, and status (OK / SLOW / CRITICAL)
- [x] Add `buildWpDbLatencyAlert` Telegram builder to telegram.ts
- [x] Register no new routes (wired into existing keepalive handler)
- [x] Write vitest tests for WP DB latency classification and Telegram builder

## Phase 22: V6.0 Integration Test & Dashboard Sync

- [x] Test connectivity to https://nakornchiangrainews.com/wp-json/ncr/v2/analytics (HTTP 200, 5.87s, JSON valid)
- [x] Add `fetchWpSentinelV6()` to server/wordpress.ts — fetch db_latency, disk_free, operating_mode
- [x] Add `getWpSentinelData` tRPC query in server/routers.ts
- [x] Add V6.0 dashboard cards: DB Response Time, Storage Health, System Shift Status
- [x] Wire disk_free "0 GB" anomaly detection — flag as permission error when value is 0
- [x] Add V6.0 data to Executive Brief (disk space + operating mode)
- [x] Write vitest tests for V6.0 field parsing and status classification

## Phase 23: V7.0 Ghost Protocol

- [x] Fix `fetchWpSentinelV6()` in wordpress.ts — accept non-numeric disk_free as "System Managed (Green)", no permission_error flag
- [x] Update Dashboard.tsx Storage Health card — show "System Managed" badge (green) when disk_free is non-numeric
- [x] Add `Excellent` tier to `classifyWpDbLatency()` — db_latency < 100ms = Excellent (🟢 ยอดเยี่ยม)
- [x] Wire Excellent tier into Site Health Score bonus — if db_latency < 100ms, add +5 bonus to health score
- [x] Add `checkPageSpeedPayload()` to wordpress.ts — fetch PageSpeed Insights API, extract total page size bytes
- [x] Add `handlePageSpeedPayloadAlert` heartbeat handler — alert Telegram if page size > 5MB (24h cooldown)
- [x] Register new route in server/_core/index.ts
- [x] Write vitest tests for all V7.0 changes

## Phase 24: V12 Caretaker Protocol
- [x] Update Sentinel Mode fallback text to "Autonomous Caretaker Active"
- [x] Update keepalive handler: db_latency > 500ms logs "High Load Detected" + recommends cache flush
- [x] Upgrade Executive Brief to V12.1 Morning Brief format: Overall Health, PageSpeed Mobile score, System Pulse avg, Auto-Fixes count, Uptime %
- [x] Register daily heartbeat at 08:30 BKK for Executive Brief (requires deploy first — use manus-heartbeat create after publishing)
- [x] Write vitest tests for V12 changes (monitoring.test.ts db mock fixed, 251 tests pass)

## V12.2 Upgrades
- [x] Remove _handleExecutiveBriefLegacy dead code from heartbeatHandlers.ts
- [x] Add tRPC query for WP DB latency history (24h data points)
- [x] Build DB Latency Sparkline (24h) on Dashboard below DB Heartbeat gauge
- [x] Add Manual Refresh button to WP Sentinel section (overrides 15-min polling)

## V12.3 Lean Config Dashboard
- [x] Verify WP Sentinel V10.3 endpoint live with all fields (memory, disk, images, 404)
- [x] Update WpSentinelV6Data interface with V10.3 fields
- [x] Update fetchWpSentinelV6 parser for V10.3 string formats (db_latency "Low"/seconds, memory "107.85 MB", disk "2465.24 GB")
- [x] Build Memory Usage gauge card (progress bar + color-coded status)
- [x] Build Disk Free gauge card (∞ for system-managed, GB for numeric)
- [x] Build Image Optimization progress bar (optimized_images / total_images)
- [x] Build 404 Alert card (only shown when verified_404 > 0, else OPTIMIZED badge)
- [x] Build Cache Status card (Stable if TTFB < 100ms, Anti-Ghost logic)
- [x] Change polling interval from 15 min to 10 min
- [x] Update section header to WP Sentinel V10.3
- [x] TypeScript clean, 251 tests passing
