# NCR Watchdog CTO Monitor Deployment Summary

The backend-only Netlify scheduled monitoring update has been implemented and deployed to production for **NCR Watchdog**. The frontend UI was not changed. The new scheduled function is designed to check `https://nakornchiangrainews.com` every five minutes and use the existing Telegram notification helper when the monitored site is down, times out, returns a non-200 response, or exceeds the configured latency threshold.

| Area | Final State |
|---|---|
| Production URL | `https://gorgeous-treacle-ebe178.netlify.app` |
| Unique deploy URL | `https://6a15df2e718510984b9fed03--gorgeous-treacle-ebe178.netlify.app` |
| New function | `netlify/functions/cto-monitor.ts` |
| Schedule | `*/5 * * * *` in `netlify.toml` |
| Target monitored site | `https://nakornchiangrainews.com` by default |
| Alert path | Existing `sendTelegramMessage` helper in `server/telegram.ts` |
| Default latency threshold | `2000ms`, overridable via `CTO_MONITOR_LATENCY_THRESHOLD_MS` |
| Default timeout | `10000ms`, overridable via `CTO_MONITOR_TIMEOUT_MS` |

The Netlify production deployment completed successfully. Netlify bundled two functions, `cto-monitor.ts` and `trpc.ts`, and the CLI function listing confirms that `cto-monitor` is deployed. The local bundled invocation test was executed with Telegram credentials blanked and a very high latency threshold so that it could verify clean healthy execution without sending an alert.

Live non-invasive checks after deployment confirmed that the production dashboard root and the monitored website both returned HTTP 200. The production function endpoint itself was intentionally not manually invoked after deployment to avoid unnecessary alert traffic; the scheduled function is configured to execute through Netlify's scheduler.

| Verification | Result |
|---|---|
| TypeScript/build validation | Passed during Netlify production build |
| Function bundling | `cto-monitor.ts` bundled successfully |
| Local safe invocation | Returned `204` during healthy check with alert credentials blanked |
| Netlify function listing | `cto-monitor` reported as `deployed=yes` |
| Dashboard root live check | HTTP `200` |
| Monitored site live check | HTTP `200` |

Operationally, the monitor sends Telegram alerts only on unhealthy outcomes. A healthy response logs status and latency without sending a notification. This preserves the existing notification channel while keeping the implementation backend-only and low-cost.
