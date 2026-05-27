# NCR Watchdog Production Deployment Verification Notes

Production URL: https://gorgeous-treacle-ebe178.netlify.app
Deployment ID: 6a15c86f23f9f04173fdfdd4
Site ID: 1bd22346-5280-4363-8050-06e33f68d4c4

## Local Validation

The project passed `pnpm run check` and `pnpm run build` after deployment-oriented fixes to the monitoring and WordPress Sentinel environment configuration.

## Production Environment Variables

The production Netlify context was verified to include the required variable names: `CF_API_TOKEN`, `CF_ZONE_ID`, `DASHBOARD_URL`, `NCR_API_SECRET`, `NODE_VERSION`, `TG_BOT_TOKEN`, `TG_CHAT_ID`, `WP_SITE_URL`, and `WP_SENTINEL_URL`. Secret values were not printed or stored in this note.

## Production tRPC and Integration Checks

The safe integration script confirmed the deployed dashboard homepage and public tRPC backend were reachable. The following production queries returned successful tRPC responses: `monitor.quickStatus`, `monitor.securityLevel`, `monitor.cfAnalytics`, `wpSentinel.getV6Data`, and `wpSentinel.getLatencyTimeline`. The latency timeline returned an empty list because no historical keepalive readings had been persisted yet.

Telegram delivery was verified through the deployed `monitor.sendTestReport` tRPC mutation, which returned HTTP 200 and result keys `error`, `messageId`, and `success`. This confirms the production function can reach Telegram with configured credentials.

## Browser Dashboard Observation

The production dashboard loaded at the Netlify URL with title `NCR Watchdog — nakornchiangrainews.com`. After live queries resolved, the UI showed HTTP Status `200 Online`, TTFB approximately `2.90s`, Uptime `100.0%`, Cloudflare cache hit ratio `29%`, total Cloudflare requests `161,007`, cached requests `46,438`, bandwidth `5.3 GB`, Cloudflare threats blocked `5,486`, and 404 errors `1,191` in the visible 24-hour analytics panels.

The WordPress Sentinel panel loaded live data, including DB heartbeat `0ms`, memory usage `108.0 / 512 MB`, disk free `2465 GB`, cache status `Stable`, and 404 status `OPTIMIZED`. Sentinel health/mode labels showed `Unknown` with `Status CRITICAL: ok`, which indicates the endpoint is reachable but the returned status schema uses an unknown or unmapped health/mode label.

## Screenshots

Initial production screenshot: `/home/ubuntu/screenshots/gorgeous-treacle-ebe_2026-05-26_16-27-12_4634.webp`
Resolved live-data screenshot: `/home/ubuntu/screenshots/gorgeous-treacle-ebe_2026-05-26_16-27-29_5650.webp`

## Run Check Now Verification

The production `monitor.runCheck` tRPC mutation was executed successfully and returned HTTP 200. The result reported `httpCode=200`, `ttfbMs=2852`, `cacheStatus=MISS`, `cfRay=a01e273e2f72cf62-CMH`, and `isUp=True`, confirming that the deployed dashboard can perform an on-demand monitor cycle and persist/update operational data through the backend path.
