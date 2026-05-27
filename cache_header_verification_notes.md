# NCR Watchdog Cache Header Verification Notes

**Author:** Manus AI  
**Verification date:** 2026-05-27 GMT+7  
**Production URL:** <https://gorgeous-treacle-ebe178.netlify.app>  
**Latest verified production deploy:** `6a15d3e7553a80782efedb00`

## Summary

The corrected Netlify header precedence has been deployed and verified in production. The earlier mismatch was caused by the general `/*` app-shell header rule overriding the more specific `/assets/*` rule. I corrected this by ordering the Netlify header rules from general to specific, then redeployed the site and re-ran the live verification.

The production site now has the intended caching behavior: **HTML app-shell responses revalidate quickly**, **Vite content-hashed JavaScript assets are immutable for one year**, and **dynamic tRPC API responses are explicitly marked as no-store** so dashboard metrics should not become stale through browser, Netlify CDN, or Cloudflare caching.

## Verified Live Headers

| Surface | Verified URL | Status | Verified `cache-control` | Result |
|---|---|---:|---|---|
| Root page | `https://gorgeous-treacle-ebe178.netlify.app/` | `200 OK` | `public,max-age=0,s-maxage=300,stale-while-revalidate=60,must-revalidate` | Pass |
| Hashed JavaScript asset | `https://gorgeous-treacle-ebe178.netlify.app/assets/index-jQgiknog.js` | `200 OK` | `public,max-age=31536000,immutable` | Pass |
| Dynamic tRPC API | `https://gorgeous-treacle-ebe178.netlify.app/api/trpc/wpSentinel.getV6Data?...` | `200 OK` | `no-store,no-cache,must-revalidate,max-age=0` | Pass |

The dynamic API response also returned `cdn-cache-control: no-store`, `pragma: no-cache`, and `expires: 0`, which provides additional cache-bypass signals for intermediary caches and legacy clients.

## Validation Performed

Before the final redeploy, I ran the TypeScript and production build checks successfully.

| Check | Command | Result | Notes |
|---|---|---|---|
| TypeScript validation | `pnpm run check` | Passed | No TypeScript errors reported. |
| Production build | `pnpm run build` | Passed | Vite and server bundle completed successfully. |
| Netlify production deploy | `pnpm --package=netlify-cli dlx netlify deploy --prod` | Passed | Deploy `6a15d3e7553a80782efedb00` is live. |
| Live cache verification | `python3.11 scripts/verify_cache_headers.py` | Passed | Root, hashed asset, and dynamic API headers match expectations. |

The existing non-blocking build warnings remain unchanged: missing optional Vite analytics placeholders and a large JavaScript chunk warning. These warnings did not block the production build or deployment.

## Files Updated or Created

| File | Purpose |
|---|---|
| `netlify.toml` | Reordered cache header rules so `/assets/*` immutable caching is not overridden by the global `/*` rule. |
| `netlify/functions/trpc.ts` | Ensures all dynamic tRPC function responses include no-store headers. |
| `docs/cloudflare_cache_rule_recommendation.md` | Documents the recommended Cloudflare Cache Everything strategy with API bypass. |
| `scripts/verify_cache_headers.py` | Adds a repeatable production cache header verification script. |
| `cache_header_verification_raw.txt` | Captures the latest raw live header verification output. |
| `cache_header_verification.json` | Captures the latest structured live header verification output. |

## Operational Conclusion

The cache optimization is now production-verified. The dashboard should continue to receive fresh dynamic monitoring data from the tRPC API while Cloudflare and Netlify can safely cache hashed static assets aggressively for speed. The remaining manual step is to apply the Cloudflare cache rules described in `docs/cloudflare_cache_rule_recommendation.md`, especially the API bypass rule for `/api/*` before enabling broad static-page caching.
