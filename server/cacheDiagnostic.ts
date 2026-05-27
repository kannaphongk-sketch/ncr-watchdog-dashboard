/**
 * Cache Diagnostic Tool
 *
 * Analyses response headers captured by checkSite() to determine:
 * 1. Which WP cookies (if any) are present that may be causing CF to bypass cache.
 * 2. A human-readable potential cause for BYPASS / MISS / EXPIRED cache status.
 */

/** WP cookies that force Cloudflare to bypass the cache. */
const WP_BYPASS_COOKIES = [
  "wordpress_logged_in",
  "wp-postpass",
  "comment_author",
  "woocommerce_cart_hash",
  "woocommerce_items_in_cart",
];

export interface CacheDiagnosticResult {
  cfCacheStatus: string;
  cacheControl: string;
  vary: string;
  wpCookiesDetected: string; // comma-separated list or ""
  potentialCause: string;
}

/**
 * Analyse the raw headers from a site check and return a structured diagnostic.
 * @param cfCacheStatus  Value of the cf-cache-status response header.
 * @param cacheControl   Value of the cache-control response header.
 * @param vary           Value of the vary response header.
 * @param setCookieHeader Raw Set-Cookie header string (to detect WP cookies).
 */
export function analyzeCacheDiagnostic(
  cfCacheStatus: string,
  cacheControl: string,
  vary: string,
  setCookieHeader: string
): CacheDiagnosticResult {
  const status = (cfCacheStatus || "UNKNOWN").toUpperCase();

  // Detect WP cookies in the Set-Cookie header
  const detectedCookies = WP_BYPASS_COOKIES.filter((name) =>
    setCookieHeader.toLowerCase().includes(name.toLowerCase())
  );
  const wpCookiesDetected = detectedCookies.join(", ");

  let potentialCause = "";

  if (["BYPASS", "MISS", "EXPIRED"].includes(status)) {
    if (detectedCookies.length > 0) {
      potentialCause = `WP cookie(s) detected (${wpCookiesDetected}) — Cloudflare bypasses cache for authenticated/cookie sessions`;
    } else if (cacheControl.includes("no-store") || cacheControl.includes("no-cache")) {
      potentialCause = `Cache-Control header set to "${cacheControl}" — origin is instructing CF not to cache this response`;
    } else if (vary.toLowerCase().includes("cookie")) {
      potentialCause = `Vary: Cookie header present — CF treats each cookie variation as a unique cache key, causing MISS/BYPASS`;
    } else if (status === "BYPASS") {
      potentialCause = "CF cache bypassed — possible Page Rule or Cache Rule set to Bypass, or origin sent a Set-Cookie header";
    } else if (status === "EXPIRED") {
      potentialCause = "Cached content expired — CF is re-fetching from origin; will be HIT on next request if cacheable";
    } else {
      potentialCause = "Cache MISS — content not yet cached; will be stored on next cacheable response from origin";
    }
  } else if (status === "HIT") {
    potentialCause = "Cache is healthy — response served from Cloudflare edge";
  } else if (status === "DYNAMIC") {
    potentialCause = "Response marked DYNAMIC by CF — not eligible for caching (e.g. API or personalised content)";
  } else if (status === "REVALIDATED") {
    potentialCause = "CF revalidated the cached asset with the origin — cache is fresh";
  } else if (["TIMEOUT", "ERROR", "UNKNOWN"].includes(status)) {
    potentialCause = "Unable to determine cache status — site may be unreachable";
  } else {
    potentialCause = `CF cache status: ${status}`;
  }

  return {
    cfCacheStatus: status,
    cacheControl: cacheControl || "(not set)",
    vary: vary || "(not set)",
    wpCookiesDetected,
    potentialCause,
  };
}
