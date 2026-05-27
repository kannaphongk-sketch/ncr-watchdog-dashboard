# NCR Watchdog Cloudflare Cache Rule Recommendation

Author: **Manus AI**

This recommendation implements the Gemini caching objective: **increase edge caching for the static dashboard while preventing stale tRPC, Sentinel, Cloudflare, PageSpeed, Telegram, monitoring, and scheduler data**. The application sends all live dashboard data through `/api/trpc`, so `/api/*` must remain bypassed or no-store at every layer.

## Recommended rule order

Cloudflare cache rules should be evaluated with the dynamic API bypass rule before the broad static-site cache rule. This prevents a broad **Cache Everything** rule from accidentally caching dashboard data sync calls.

| Priority | Rule name | Expression | Action | Browser TTL | Edge TTL | Purpose |
|---:|---|---|---|---|---|---|
| 1 | `NCR Watchdog API Bypass` | `(http.host eq "gorgeous-treacle-ebe178.netlify.app" and starts_with(http.request.uri.path, "/api/"))` | **Bypass cache** | Respect origin | Respect origin | Keeps tRPC dashboard queries and mutations fresh. |
| 2 | `NCR Watchdog Static Cache Everything` | `(http.host eq "gorgeous-treacle-ebe178.netlify.app" and not starts_with(http.request.uri.path, "/api/") and http.request.method in {"GET" "HEAD"})` | **Eligible for cache / Cache Everything** | Respect origin headers | Respect origin headers, or set a short edge TTL such as 5 minutes for HTML | Allows static dashboard HTML and assets to benefit from Cloudflare edge caching. |

## Origin header policy already implemented

The Netlify deployment should now emit these origin cache policies:

| Path | Origin cache-control policy | Rationale |
|---|---|---|
| `/api/*` | `no-store, no-cache, must-revalidate, max-age=0` plus CDN no-store headers | Dynamic dashboard data must not be cached by browsers, Netlify CDN, or Cloudflare. |
| `/.netlify/functions/*` | `no-store, no-cache, must-revalidate, max-age=0` plus CDN no-store headers | Protects the direct serverless function path even if accessed outside the `/api/*` redirect. |
| `/assets/*` | `public, max-age=31536000, immutable` | Vite emits fingerprinted assets, so long-lived immutable caching is safe for built JavaScript and CSS bundles. |
| `/*` | `public, max-age=0, s-maxage=300, stale-while-revalidate=60, must-revalidate` | Keeps browsers revalidating the SPA HTML shell while permitting a short shared edge cache to lower repeat TTFB without risking stale API data. |

## Optional Cloudflare Ruleset API payload

If applying via Cloudflare API, use the account’s existing zone ID and create or update the `http_request_cache_settings` phase entry point. Keep the bypass rule before the cache rule.

```json
{
  "name": "NCR Watchdog dashboard cache policy",
  "kind": "zone",
  "phase": "http_request_cache_settings",
  "rules": [
    {
      "description": "NCR Watchdog API Bypass",
      "expression": "(http.host eq \"gorgeous-treacle-ebe178.netlify.app\" and starts_with(http.request.uri.path, \"/api/\"))",
      "action": "set_cache_settings",
      "action_parameters": {
        "cache": false
      },
      "enabled": true
    },
    {
      "description": "NCR Watchdog Static Cache Everything",
      "expression": "(http.host eq \"gorgeous-treacle-ebe178.netlify.app\" and not starts_with(http.request.uri.path, \"/api/\") and http.request.method in {\"GET\" \"HEAD\"})",
      "action": "set_cache_settings",
      "action_parameters": {
        "cache": true,
        "edge_ttl": { "mode": "respect_origin" },
        "browser_ttl": { "mode": "respect_origin" }
      },
      "enabled": true
    }
  ]
}
```

## Post-deployment verification checklist

After Netlify deployment, verify cache headers with `curl -I` or an equivalent HTTP inspector. The API endpoint should report **no-store**, and at least one built asset under `/assets/` should report **public, max-age=31536000, immutable**.

| Check | Expected result |
|---|---|
| `HEAD /api/trpc/wpSentinel.getV6Data?...` | `Cache-Control: no-store, no-cache, must-revalidate, max-age=0` |
| `HEAD /.netlify/functions/trpc/...` | `Cache-Control: no-store, no-cache, must-revalidate, max-age=0` |
| `HEAD /assets/<hashed-file>.js` | `Cache-Control: public, max-age=31536000, immutable` |
| `HEAD /` | `Cache-Control: public, max-age=0, s-maxage=300, stale-while-revalidate=60, must-revalidate` |
| `GET /` | Dashboard loads normally and live cards still update from tRPC. |
