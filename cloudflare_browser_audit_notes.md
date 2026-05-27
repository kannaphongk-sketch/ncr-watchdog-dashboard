# Cloudflare Browser Audit Notes

**Date:** 2026-05-27 GMT+7  
**Zone:** `nakornchiangrainews.com`  
**Location:** Cloudflare Dashboard > Caching > Cache Rules

## Visible Cache Rules

The authenticated Cloudflare dashboard shows **5 active Cache Rules**. The visible order and partial rule details are:

| Order | Rule name | Visible match summary | Visible action summary | Status | Initial conflict assessment |
|---:|---|---|---|---|---|
| 1 | `Bypass cache for WP admin/login/logged-in...` | URI path contains `/wp-admin/`, URI path contains `/wp-login.php`, and additional truncated path/cookie conditions | Bypass cache | Active | Intended WordPress safety bypass; should be preserved. |
| 2 | `Cache Static Assets` | File extension is in common static asset extensions including CSS, JS, JPG, JPEG, PNG, GIF, WEBP, ICO, SVG, WOFF, WOFF2 | Eligible for cache | Active | Useful existing static asset caching; likely overlaps with the requested static-shell optimization but does not cover HTML shell. Preserve unless a broader rule must supersede carefully. |
| 3 | `Cache Everything for public pages (HTML)` | Hostname equals `nakornchiangrainews.com` and additional truncated hostname/page conditions | Browser TTL / Edge TTL actions visible | Active | Existing broad HTML/page cache rule for the primary WordPress site; must inspect before adding any broad rule to avoid conflicts. |
| 4 | `Ignore Facebook FBCLID` | URI query string contains `fbclid` and URI path does not contain `/wp-admin...` | Browser TTL / Edge TTL actions visible | Active | Query normalization/cache behavior for public pages; preserve unless conflict is found. |
| 5 | `HTML Cache Everything - Anti Ghost...` | URI path starts with `/` and cookie does not contain `wordpress_logged_in` and additional truncated cookie conditions | Browser TTL / Edge TTL actions visible | Active | Existing broad HTML cache rule; likely overlap for WordPress host. Must inspect carefully before making any additional Cache Everything rule. |

## Immediate observation

The requested dashboard host is `gorgeous-treacle-ebe178.netlify.app`, while the current visible rules appear targeted primarily at `nakornchiangrainews.com` and WordPress paths/cookies. I will inspect details before creating or modifying rules because multiple existing active rules already implement HTML and static caching for the zone’s primary site.

## Precise authenticated API audit

Using the authenticated Cloudflare dashboard session for non-mutating reads, I confirmed the zone metadata and exact active rule definitions.

| Item | Value |
|---|---|
| Zone name | `nakornchiangrainews.com` |
| Zone ID | `764bf1ffbc7583553c1484338d9a7495` |
| Zone status | `active` |
| Plan | `Free Website` |
| Cache Rules ruleset ID | `5e85d68936714a18aa21548d8e9b4e45` |
| Cache Rules ruleset version | `15` |

### Active Cache Rules, exact expressions

| Order | Description | Expression | Action parameters | Enabled |
|---:|---|---|---|---|
| 1 | `Bypass cache for WP admin/login/cron/api/logged-in users` | `(http.request.uri.path contains "/wp-admin/") or (http.request.uri.path contains "/wp-login.php") or (http.request.uri.path contains "/wp-cron.php") or (http.request.uri.path contains "/xmlrpc.php") or (http.request.uri.path contains "/wp-json/") or (http.request.uri.query contains "preview=true") or (http.request.uri.query contains "customize_changeset_uuid") or (http.cookie contains "wordpress_logged_in_") or (http.cookie contains "wp_woocommerce_session_") or (http.cookie contains "comment_author_") or (http.cookie contains "wp-postpass_") or (http.request.method ne "GET" and http.request.method ne "HEAD")` | `cache: false` | true |
| 2 | `Cache Static Assets` | `(http.request.uri.path.extension in {"css" "js" "jpg" "jpeg" "png" "gif" "webp" "ico" "svg" "woff" "woff2"})` | `cache: true`, `edge_ttl: respect_origin` | true |
| 3 | `Cache Everything for public pages (HTML)` | `(http.host eq "nakornchiangrainews.com") or (http.host eq "www.nakornchiangrainews.com")` | `cache: true`, `edge_ttl: override_origin default 7200`, `browser_ttl: respect_origin` | true |
| 4 | `Ignore Facebook FBCLID` | `(http.request.uri.query contains "fbclid" and not http.request.uri.path contains "/wp-admin" and not http.request.uri.path contains "/wp-login.php")` | `cache: true`, `browser_ttl: override_origin default 7200` | true |
| 5 | `HTML Cache Everything - Anti Ghost` | `(starts_with(http.request.uri.path, "/") and not http.cookie contains "wordpress_logged_in" and not http.request.uri.path contains "/wp-admin")` | `cache: true`, `edge_ttl: override_origin default 86400`, `browser_ttl: override_origin default 14400`, `serve_stale: disable_stale_while_updating true` | true |

### Active Page Rules

| Priority | Target | Actions | Status |
|---:|---|---|---|
| 1 | `*nakornchiangrainews.com/wp-admin/*` | `cache_level: bypass`, `disable_apps`, `disable_performance` | active |
| 2 | `*nakornchiangrainews.com/wp-login.php*` | `security_level: high`, `cache_level: bypass`, `disable_apps` | active |
| 3 | `*nakornchiangrainews.com/*preview=true*` | `cache_level: bypass` | active |

### Conflict analysis

The existing Cache Rules already handle static assets and public HTML caching for `nakornchiangrainews.com`. However, rule 5 is host-agnostic because it matches every request path beginning with `/`, excludes only logged-in WordPress cookies and `/wp-admin`, and therefore can also match the Netlify dashboard host `gorgeous-treacle-ebe178.netlify.app`, including `/api/` paths. To protect dashboard synced data, a specific dashboard API bypass rule must be inserted with precedence that prevents this broad host-agnostic cache rule from caching `/api/*`.

The safest non-duplicative update is to preserve all existing rules and add one new host-specific dashboard API bypass rule plus one new host-specific dashboard frontend rule. Because there is already a host-agnostic broad cache rule, the dashboard frontend rule should use the same respect-origin approach as the Netlify configuration rather than overriding origin TTLs. The API bypass must remain effective even when broad rules also match.


## Cache Rules ordering guidance checked before mutation

Cloudflare’s Cache Rules documentation states that Cache Rules are stackable, multiple matching rules can be combined, and **if multiple matching rules set the same setting, the value in the last matching rule wins**. It also states that **Cache Rules take precedence over Page Rules** when both match the same path. Therefore, the dashboard `/api/*` bypass rule must appear **after** any broad cache-eligible rule that could also match dashboard API paths, otherwise a later cache-everything rule could override the bypass.

Reference checked: <https://developers.cloudflare.com/cache/how-to/cache-rules/order/>


## Applied Cache Rules update

The confirmed Cloudflare Cache Rules update was applied successfully through the authenticated dashboard API on **2026-05-27 GMT+7**.

| Item | Before | After |
|---|---:|---:|
| Ruleset ID | `5e85d68936714a18aa21548d8e9b4e45` | `5e85d68936714a18aa21548d8e9b4e45` |
| Ruleset version | `15` | `16` |
| Active Cache Rules | 5 | 7 |
| API response status | N/A | `200` |
| API success | N/A | `true` |

### Final active Cache Rules order

| Order | Description | Expression | Action summary | Enabled |
|---:|---|---|---|---|
| 1 | `Bypass cache for WP admin/login/cron/api/logged-in users` | Existing WordPress admin/login/API/logged-in bypass expression | `cache: false` | true |
| 2 | `Cache Static Assets` | Existing static extension match | `cache: true`, `edge_ttl: respect_origin` | true |
| 3 | `Cache Everything for public pages (HTML)` | Existing `nakornchiangrainews.com` and `www.nakornchiangrainews.com` host match | `cache: true`, `edge_ttl: override_origin 7200`, `browser_ttl: respect_origin` | true |
| 4 | `Ignore Facebook FBCLID` | Existing `fbclid` query handling | `cache: true`, `browser_ttl: override_origin 7200` | true |
| 5 | `HTML Cache Everything - Anti Ghost` | Existing broad host-agnostic HTML cache expression | `cache: true`, `edge_ttl: override_origin 86400`, `browser_ttl: override_origin 14400` | true |
| 6 | `NCR Watchdog dashboard frontend cache everything` | `(http.host eq "gorgeous-treacle-ebe178.netlify.app" and not starts_with(http.request.uri.path, "/api/"))` | `cache: true`, `edge_ttl: override_origin 86400`, `browser_ttl: respect_origin` | true |
| 7 | `NCR Watchdog dashboard API bypass cache` | `(http.host eq "gorgeous-treacle-ebe178.netlify.app" and starts_with(http.request.uri.path, "/api/"))` | `cache: false` | true |

### Safety note

The dashboard API bypass is intentionally last because Cloudflare’s Cache Rules order guidance says that for conflicting cache settings, **the last matching rule wins**. This protects `/api/*` from the existing broad cache-everything rule and from the new dashboard frontend cache rule.

## Post-save active status verification

A second authenticated dashboard API read confirmed the saved Cache Rules entrypoint remains active at ruleset version `16` with seven rules. The two NCR Watchdog rules are enabled and ordered as intended.

| Rule | Confirmed order | Enabled | Expression |
|---|---:|---|---|
| `NCR Watchdog dashboard frontend cache everything` | 6 | true | `(http.host eq "gorgeous-treacle-ebe178.netlify.app" and not starts_with(http.request.uri.path, "/api/"))` |
| `NCR Watchdog dashboard API bypass cache` | 7 | true | `(http.host eq "gorgeous-treacle-ebe178.netlify.app" and starts_with(http.request.uri.path, "/api/"))` |

The API bypass is confirmed after the frontend rule and after the broad existing `HTML Cache Everything - Anti Ghost` rule.

## Live header verification after Cloudflare browser update

After saving the Cache Rules update and closing the Cloudflare browser session, I ran live header checks against the NCR Watchdog Netlify deployment.

| Endpoint | Result | Relevant headers |
|---|---|---|
| `https://gorgeous-treacle-ebe178.netlify.app/` | `HTTP/2 200` | `cache-control: public,max-age=0,s-maxage=300,stale-while-revalidate=60,must-revalidate`; `cache-status: "Netlify Edge"; fwd=miss` |
| `https://gorgeous-treacle-ebe178.netlify.app/assets/index-jQgiknog.js` | `HTTP/2 200` | `cache-control: public,max-age=31536000,immutable`; `cache-status: "Netlify Edge"; fwd=miss` |
| `https://gorgeous-treacle-ebe178.netlify.app/api/trpc/wpSentinel.getV6Data?...` | `HTTP/2 200` | `cache-control: no-store,no-cache,must-revalidate,max-age=0`; `cdn-cache-control: no-store`; `cache-status: "Netlify Durable"; fwd=bypass`; `cache-status: "Netlify Edge"; fwd=miss` |

The direct `netlify.app` checks confirm the origin-side safety baseline remains correct: dynamic API data is not cacheable, hashed static assets are immutable, and the app shell has a short shared-cache TTL. The Cloudflare rules were also verified active in the `nakornchiangrainews.com` zone at version `16`; note that direct requests to the `netlify.app` hostname are served by Netlify directly, so Cloudflare-specific `cf-cache-status` headers are not expected on those direct-host checks.

The authenticated Cloudflare browser session was closed after active rule verification to minimize continued browser usage.
