# NCR Watchdog Sentinel Normalization Fix — Verification Notes

Production URL: https://gorgeous-treacle-ebe178.netlify.app
Final deploy ID: 6a15cd9419d7f168fc7d1cbd
Final unique deploy URL: https://6a15cd9419d7f168fc7d1cbd--gorgeous-treacle-ebe178.netlify.app

## Local validation

`pnpm run check && pnpm run build` completed successfully after the final server-side normalization patch. The build emitted only existing non-blocking Vite warnings for optional analytics placeholders and chunk size.

## Production tRPC verification

The focused production verifier `scripts/verify_sentinel_display_mapping.py` passed all required Sentinel mapping checks:

| Field | Production value | Expected value | Result |
| --- | --- | --- | --- |
| wpHealth | Stable | Stable | PASS |
| wpStatus | Full-Autonomous Mode | Full-Autonomous Mode | PASS |
| healthAlert | False | False | PASS |
| statusCritical | False | False | PASS |
| operatingMode | Autonomous Caretaker Active | Autonomous Caretaker Active | PASS |

Additional observed metrics from the same production tRPC call were `dbLatencyMs=0`, `memoryUsageMb=108`, `optimizedImages=0`, and `totalImages=0`.

## Browser-observed dashboard state

A live browser check at `https://gorgeous-treacle-ebe178.netlify.app` confirmed that the dashboard now renders WordPress Sentinel without `Unknown` for the health or mode fields. The page displayed:

| Dashboard section | Observed value |
| --- | --- |
| Site status | 200 Online |
| TTFB | 2.71s |
| Uptime | 100.0% |
| CF Cache Hit | 29% |
| WP Sentinel health badge | Stable |
| Sentinel Mode | Autonomous Caretaker Active |
| DB Heartbeat | 0ms, Excellent (<100ms) |
| Memory Usage | 108.0 / 512 MB, Optimal |
| Disk Free | 2465 GB free, Ample |
| Cache Status | Stable, TTFB < 100ms — Anti-Ghost Active |
| 404 Status | OPTIMIZED, no broken links detected this hour |

Browser screenshot: `/home/ubuntu/screenshots/gorgeous-treacle-ebe_2026-05-26_16-44-45_1838.webp`.
