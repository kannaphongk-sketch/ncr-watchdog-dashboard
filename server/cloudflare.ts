import { ENV } from "./_core/env";

export interface CFPurgeResult {
  success: boolean;
  message: string;
}

/**
 * Purges all Cloudflare cache for nakornchiangrainews.com
 */
export async function purgeCFCache(): Promise<CFPurgeResult> {
  if (!ENV.cfApiToken || !ENV.cfZoneId) {
    return { success: false, message: "CF credentials not configured" };
  }

  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${ENV.cfZoneId}/purge_cache`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ENV.cfApiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ purge_everything: true }),
      }
    );

    const data = (await res.json()) as { success: boolean; errors?: { message: string }[] };

    if (data.success) {
      return { success: true, message: "Cloudflare cache purged successfully" };
    } else {
      const errMsg = data.errors?.map((e) => e.message).join(", ") || "Unknown CF error";
      return { success: false, message: errMsg };
    }
  } catch (err) {
    return { success: false, message: `CF purge failed: ${(err as Error).message}` };
  }
}

export interface CFAnalytics {
  cacheHitRate: number;
  totalRequests: number;
  cachedRequests: number;
  bandwidth: number;
  threats: number;
  /** Unique visitors (uniq.uniques from CF GraphQL) */
  visits: number;
  /** Page views (sum.pageViews from CF GraphQL) */
  pageViews: number;
  /** 404 errors in the last 24h from CF httpRequestsAdaptiveGroups */
  count404: number;
  /** Top 5 404 URLs by hit count */
  top404Urls: { url: string; hits: number }[];
  /** Top countries by request count for the requested analytics window */
  countryTraffic: CountryTraffic[];
  /** True only when Cloudflare GraphQL analytics were configured and returned usable zone data. */
  analyticsAvailable: boolean;
  /** Human-readable reason shown by the dashboard when analytics are unavailable. */
  unavailableReason?: string;
  /** Runtime variables that must be configured before analytics can be fetched. */
  missingVariables?: string[];
}

function buildEmptyCFAnalytics(reason: string, missingVariables: string[] = []): CFAnalytics {
  return {
    cacheHitRate: 0,
    totalRequests: 0,
    cachedRequests: 0,
    bandwidth: 0,
    threats: 0,
    visits: 0,
    pageViews: 0,
    count404: 0,
    top404Urls: [],
    countryTraffic: [],
    analyticsAvailable: false,
    unavailableReason: reason,
    missingVariables,
  };
}

const CF_ANALYTICS_EMPTY: CFAnalytics = buildEmptyCFAnalytics("Cloudflare analytics unavailable");

function getMissingCloudflareAnalyticsVariables(): string[] {
  const missing: string[] = [];
  if (!ENV.cfZoneId) missing.push("CLOUDFLARE_ZONE_ID");
  if (!ENV.cfApiToken) missing.push("CLOUDFLARE_API_TOKEN");
  return missing;
}

/**
 * Get Cloudflare zone analytics (traffic, cache hit rate, visits, page views)
 * Uses CF GraphQL Analytics API — httpRequests1dGroups for the last 24h window.
 *
 * Field mapping:
 *   sum.requests        → total HTTP requests
 *   sum.cachedRequests  → cached requests (for hit rate)
 *   sum.bytes           → total bandwidth (bytes)
 *   sum.threats         → threats blocked
 *   sum.pageViews       → page views (HTML responses)
 *   uniq.uniques        → unique visitors (HLL estimate)
 */
export async function getCFAnalytics(windowDays = 1): Promise<CFAnalytics> {
  const missingVariables = getMissingCloudflareAnalyticsVariables();
  if (missingVariables.length > 0) {
    return buildEmptyCFAnalytics(`Cloudflare analytics not configured: missing ${missingVariables.join(", ")}`, missingVariables);
  }

  try {
    const now = Date.now();
    const safeDays = Math.max(1, Math.min(Math.round(windowDays), 31));
    const since = new Date(now - safeDays * 24 * 60 * 60 * 1000).toISOString();
    const until = new Date(now).toISOString();
    const sinceDate = since.slice(0, 10);
    const untilDate = until.slice(0, 10);

    const query = `
      query {
        viewer {
          zones(filter: { zoneTag: "${ENV.cfZoneId}" }) {
            httpRequests1dGroups(
              limit: ${Math.min(safeDays + 1, 31)}
              filter: { date_geq: "${sinceDate}", date_leq: "${untilDate}" }
            ) {
              sum {
                requests
                cachedRequests
                bytes
                cachedBytes
                threats
                pageViews
              }
              uniq {
                uniques
              }
            }
            httpRequestsAdaptiveGroups(
              limit: 10
              orderBy: [count_DESC]
              filter: { datetime_geq: "${since}", datetime_leq: "${until}", edgeResponseStatus: 404 }
            ) {
              count
              dimensions {
                clientRequestPath
              }
            }
            countryGroups: httpRequestsAdaptiveGroups(
              limit: 5
              orderBy: [count_DESC]
              filter: { datetime_geq: "${since}", datetime_leq: "${until}" }
            ) {
              count
              dimensions {
                clientCountryName
              }
            }
          }
        }
      }
    `;

    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ENV.cfApiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });

    const data = (await res.json()) as {
      data?: {
        viewer?: {
          zones?: {
            httpRequests1dGroups?: {
              sum: {
                requests: number;
                cachedRequests: number;
                bytes: number;
                threats: number;
                pageViews: number;
              };
              uniq: {
                uniques: number;
              };
            }[];
            httpRequestsAdaptiveGroups?: {
              count: number;
              dimensions?: { clientRequestPath?: string };
            }[];
            countryGroups?: {
              count: number;
              dimensions?: { clientCountryName?: string };
            }[];
          }[];
        };
      };
    };

    const groups = data?.data?.viewer?.zones?.[0]?.httpRequests1dGroups ?? [];
    if (groups.length === 0) {
      return buildEmptyCFAnalytics("Cloudflare analytics returned no zone data; verify CLOUDFLARE_ZONE_ID and token permissions");
    }

    const totals = groups.reduce(
      (acc, group) => {
        acc.requests += group.sum.requests ?? 0;
        acc.cachedRequests += group.sum.cachedRequests ?? 0;
        acc.bytes += group.sum.bytes ?? 0;
        acc.threats += group.sum.threats ?? 0;
        acc.pageViews += group.sum.pageViews ?? 0;
        acc.uniques += group.uniq?.uniques ?? 0;
        return acc;
      },
      { requests: 0, cachedRequests: 0, bytes: 0, threats: 0, pageViews: 0, uniques: 0 }
    );

    const cacheHitRate = totals.requests > 0 ? Math.round((totals.cachedRequests / totals.requests) * 100) : 0;

    const zone = data?.data?.viewer?.zones?.[0];
    const adaptiveGroups = zone?.httpRequestsAdaptiveGroups ?? [];
    const count404 = adaptiveGroups.reduce((acc, g) => acc + (g.count ?? 0), 0);
    const top404Urls = adaptiveGroups
      .filter((g) => g.dimensions?.clientRequestPath)
      .map((g) => ({ url: g.dimensions!.clientRequestPath!, hits: g.count }))
      .slice(0, 10);
    const countryTraffic = (zone?.countryGroups ?? [])
      .filter((g) => g.dimensions?.clientCountryName)
      .map((g) => ({ country: g.dimensions!.clientCountryName!, requests: g.count }))
      .slice(0, 5);

    return {
      cacheHitRate,
      totalRequests: totals.requests,
      cachedRequests: totals.cachedRequests,
      bandwidth: totals.bytes,
      threats: totals.threats,
      pageViews: totals.pageViews,
      visits: totals.uniques,
      count404,
      top404Urls,
      countryTraffic,
      analyticsAvailable: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return buildEmptyCFAnalytics(`Cloudflare analytics fetch failed: ${message}`);
  }
}

// ─── Protocol 1: Auto-Ban ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────


/**
 * Protocol 1: Get top IPs by 404 count in the last 5 minutes using CF GraphQL.
 * Returns IPs with count >= threshold (default: 100).
 */
export async function getTop404IPsLast5Min(threshold = 100): Promise<{ ip: string; count: number }[]> {
  if (!ENV.cfApiToken || !ENV.cfZoneId) return [];
  try {
    const now = Date.now();
    const since = new Date(now - 5 * 60 * 1000).toISOString();
    const until = new Date(now).toISOString();
    const query = `
      query {
        viewer {
          zones(filter: { zoneTag: "${ENV.cfZoneId}" }) {
            httpRequestsAdaptiveGroups(
              limit: 10
              orderBy: [count_DESC]
              filter: { datetime_geq: "${since}", datetime_leq: "${until}", edgeResponseStatus: 404 }
            ) {
              count
              dimensions {
                clientIP
              }
            }
          }
        }
      }
    `;
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: { Authorization: `Bearer ${ENV.cfApiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const data = (await res.json()) as {
      data?: { viewer?: { zones?: { httpRequestsAdaptiveGroups?: { count: number; dimensions?: { clientIP?: string } }[] }[] } };
    };
    const groups = data?.data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups ?? [];
    return groups
      .filter((g) => g.count >= threshold && g.dimensions?.clientIP)
      .map((g) => ({ ip: g.dimensions!.clientIP!, count: g.count }));
  } catch {
    return [];
  }
}

export interface CFBlockResult {
  success: boolean;
  message: string;
  /** true = WAF rule created; false = WAF not available (token lacks permission), used fallback */
  wafBlocked: boolean;
}

/**
 * Protocol 1: Activate Cloudflare "Under Attack" mode immediately when a high-404-rate IP is detected.
 * PRIMARY action: escalate CF Security Level to "under_attack" (works with Zone Settings Write permission).
 * SECONDARY action: also attempt CF Firewall Access Rules IP block (requires WAF:Edit permission).
 */
export async function blockIPInCFWAF(ip: string): Promise<CFBlockResult> {
  if (!ENV.cfApiToken || !ENV.cfZoneId) {
    return { success: false, message: "CF credentials not configured", wafBlocked: false };
  }

  // PRIMARY: Activate "Under Attack" mode immediately — works with current token permissions
  let underAttackActivated = false;
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${ENV.cfZoneId}/settings/security_level`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${ENV.cfApiToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ value: "under_attack" }),
      }
    );
    const data = (await res.json()) as { success: boolean };
    underAttackActivated = data.success;
  } catch {
    // ignore, continue to WAF attempt
  }

  // SECONDARY: Attempt CF Firewall Access Rules IP block (requires WAF:Edit permission)
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${ENV.cfZoneId}/firewall/access-rules/rules`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${ENV.cfApiToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "block",
          configuration: { target: "ip", value: ip },
          notes: `Auto-banned by NCR Watchdog: high 404 rate (>100 in 5min)`,
        }),
      }
    );
    const data = (await res.json()) as { success: boolean; errors?: { message: string }[] };
    if (data.success) {
      return {
        success: true,
        message: `🚨 IP ${ip} permanently blocked in CF WAF. Under Attack mode also activated.`,
        wafBlocked: true,
      };
    }
  } catch {
    // WAF not available — Under Attack mode is the defense
  }

  if (underAttackActivated) {
    return {
      success: true,
      message: `⚡ CF "Under Attack" mode ACTIVATED immediately (IP: ${ip}). WAF IP block requires token upgrade.`,
      wafBlocked: false,
    };
  }

  return {
    success: false,
    message: `CF defense failed for IP ${ip}. Manual action required.`,
    wafBlocked: false,
  };
}

export interface Redirect404Stats {
  /** Number of 404 errors logged by the Redirection plugin in the last 24h */
  count404: number;
  /** Top 404 URLs (up to 10) */
  top404Urls: { url: string; hits: number }[];
}

/**
 * Fetch 404 error count and top URLs from the Redirection plugin REST API.
 * Uses WordPress Application Password for authentication.
 */
export async function get404Stats(): Promise<Redirect404Stats> {
  if (!ENV.wpUser || !ENV.wpAppPassword) {
    return { count404: 0, top404Urls: [] };
  }

  try {
    const credentials = Buffer.from(`${ENV.wpUser}:${ENV.wpAppPassword}`).toString("base64");
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const res = await fetch(
      `${ENV.wpSiteUrl}/wp-json/redirection/v1/404?per_page=100&orderby=last_access&direction=desc`,
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          Accept: "application/json",
          "User-Agent": "NCRWatchdog/1.0 (monitoring bot; +https://nakornchiangrainews.com)",
        },
      }
    );

    if (!res.ok) {
      return { count404: 0, top404Urls: [] };
    }

    const data = (await res.json()) as {
      total?: number;
      items?: { url: string; hits: number; last_access?: string }[];
    };

    const items = data.items ?? [];
    const count404 = data.total ?? items.length;

    // Aggregate hits by URL
    const urlMap = new Map<string, number>();
    for (const item of items) {
      urlMap.set(item.url, (urlMap.get(item.url) ?? 0) + (item.hits ?? 1));
    }

    const top404Urls = Array.from(urlMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([url, hits]) => ({ url, hits }));

    return { count404, top404Urls };
  } catch {
    return { count404: 0, top404Urls: [] };
  }
}

// --- Top Posts Analytics ---

export interface TopPost {
  path: string;
  count: number;
}

/**
 * Fetch top-viewed news pages from Cloudflare Analytics via GraphQL.
 * Filters out system files, wp-admin, and paths with dots (assets).
 * @param days  Look-back window in days (1=daily, 7=weekly, 30=monthly)
 * @param limit Maximum results (default 10)
 */
export async function getTopPosts(days: number, limit = 10): Promise<TopPost[]> {
  const { ENV } = await import("./_core/env");
  const cfApiToken = ENV.cfApiToken;
  const cfZoneId = ENV.cfZoneId;
  // Use 23h window to stay within CF's 1-day limit for httpRequestsAdaptiveGroups
  const hoursBack = Math.min(days * 24, 23);
  const dateISO = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
  const query = `{
    viewer {
      zones(filter: { zoneTag: "${cfZoneId}" }) {
        httpRequestsAdaptiveGroups(
          limit: 50,
          filter: { datetime_gt: "${dateISO}", edgeResponseStatus: 200 },
          orderBy: [count_DESC]
        ) {
          dimensions { clientRequestPath }
          count
        }
      }
    }
  }`;
  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfApiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });
    const json = (await res.json()) as {
      data?: {
        viewer: {
          zones: {
            httpRequestsAdaptiveGroups: { dimensions: { clientRequestPath: string }; count: number }[];
          }[];
        };
      };
      errors?: { message: string }[];
    };
    if (json.errors?.length) {
      console.warn("[getTopPosts] CF GraphQL errors:", json.errors);
      return [];
    }
    const raw = json.data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups ?? [];
    const filtered = raw
      .filter((item) => {
        const p = item.dimensions.clientRequestPath;
        return (
          p.length > 2 &&
          !p.includes(".") &&
          !p.includes("wp-") &&
          !p.includes("admin") &&
          !p.startsWith("/feed") &&
          !p.startsWith("/sitemap") &&
          !p.startsWith("/xmlrpc") &&
          p !== "/"
        );
      })
      .slice(0, limit)
      .map((item) => ({ path: item.dimensions.clientRequestPath, count: item.count }));
    return filtered;
  } catch (err) {
    console.warn("[getTopPosts] fetch error:", err);
    return [];
  }
}

export interface CountryTraffic {
  country: string;
  requests: number;
}

/** Get top countries by request count from CF Analytics (last 23h). */
export async function getCountryTraffic(limit = 10): Promise<CountryTraffic[]> {
  const { ENV } = await import("./_core/env");
  const cfApiToken = ENV.cfApiToken;
  const cfZoneId = ENV.cfZoneId;
  const dateISO = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString();
  const query = `{
    viewer {
      zones(filter: { zoneTag: "${cfZoneId}" }) {
        httpRequestsAdaptiveGroups(
          limit: ${limit},
          filter: { datetime_gt: "${dateISO}" },
          orderBy: [count_DESC]
        ) {
          dimensions { clientCountryName }
          count
        }
      }
    }
  }`;
  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfApiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });
    const json = (await res.json()) as {
      data?: {
        viewer: {
          zones: {
            httpRequestsAdaptiveGroups: { dimensions: { clientCountryName: string }; count: number }[];
          }[];
        };
      };
      errors?: { message: string }[];
    };
    if (json.errors?.length) {
      console.warn("[getCountryTraffic] CF GraphQL errors:", json.errors);
      return [];
    }
    const raw = json.data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups ?? [];
    return raw.map((item) => ({
      country: item.dimensions.clientCountryName,
      requests: item.count,
    }));
  } catch (err) {
    console.warn("[getCountryTraffic] fetch error:", err);
    return [];
  }
}

// ============================================================
// V4.1: Performance Analytics Patch
// ============================================================

export interface SpikeData404 {
  /** Total requests in the last 1h */
  totalRequests: number;
  /** 404 requests in the last 1h */
  count404: number;
  /** 404 rate as a fraction (0–1) */
  rate404: number;
  /** Whether the rate exceeds the 5% threshold */
  isSpike: boolean;
  /** Top 10 404 URLs by hit count */
  top404Urls: { url: string; hits: number }[];
}

/**
 * 404 Spike Detection — query CF GraphQL for 404 rate vs total traffic in the last 1h.
 * Returns isSpike=true when 404 rate > 5% of total traffic.
 */
export async function get404SpikeData(): Promise<SpikeData404> {
  const empty: SpikeData404 = { totalRequests: 0, count404: 0, rate404: 0, isSpike: false, top404Urls: [] };
  if (!ENV.cfApiToken || !ENV.cfZoneId) return empty;

  const now = Date.now();
  const since = new Date(now - 60 * 60 * 1000).toISOString();
  const until = new Date(now).toISOString();

  const query = `{
    viewer {
      zones(filter: { zoneTag: "${ENV.cfZoneId}" }) {
        total: httpRequestsAdaptiveGroups(
          limit: 1
          filter: { datetime_geq: "${since}", datetime_leq: "${until}" }
        ) {
          count
        }
        errors404: httpRequestsAdaptiveGroups(
          limit: 10
          orderBy: [count_DESC]
          filter: { datetime_geq: "${since}", datetime_leq: "${until}", edgeResponseStatus: 404 }
        ) {
          count
          dimensions { clientRequestPath }
        }
      }
    }
  }`;

  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: { Authorization: `Bearer ${ENV.cfApiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const json = (await res.json()) as {
      data?: {
        viewer: {
          zones: {
            total: { count: number }[];
            errors404: { count: number; dimensions: { clientRequestPath: string } }[];
          }[];
        };
      };
      errors?: { message: string }[];
    };
    if (json.errors?.length) {
      console.warn("[get404SpikeData] CF GraphQL errors:", json.errors);
      return empty;
    }
    const zone = json.data?.viewer?.zones?.[0];
    if (!zone) return empty;

    const totalRequests = zone.total.reduce((s, r) => s + r.count, 0);
    const count404 = zone.errors404.reduce((s, r) => s + r.count, 0);
    const rate404 = totalRequests > 0 ? count404 / totalRequests : 0;
    const isSpike = rate404 > 0.05;

    const urlMap = new Map<string, number>();
    for (const item of zone.errors404) {
      const path = item.dimensions.clientRequestPath;
      urlMap.set(path, (urlMap.get(path) ?? 0) + item.count);
    }
    const top404Urls = Array.from(urlMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([url, hits]) => ({ url, hits }));

    return { totalRequests, count404, rate404, isSpike, top404Urls };
  } catch (err) {
    console.warn("[get404SpikeData] fetch error:", err);
    return empty;
  }
}

export interface CacheEfficiencyData {
  /** Cache hit ratio for last 6h (0–1), excluding fbclid requests */
  cacheHitRate: number;
  /** Total requests in last 6h */
  totalRequests: number;
  /** Cached requests in last 6h */
  cachedRequests: number;
  /** Estimated fbclid request count (MISS/BYPASS with ?fbclid= in path) */
  fbclidRequests: number;
  /** Cache hit rate if fbclid requests were excluded (estimated) */
  adjustedCacheHitRate: number;
  /** Whether target of 85% is met (after fbclid adjustment) */
  meetsTarget: boolean;
}

/**
 * Cache Efficiency Audit — query CF GraphQL for cache hit ratio in the last 6h.
 * Separates fbclid-driven MISS/BYPASS traffic from organic cache performance.
 */
export async function getCacheEfficiencyData(): Promise<CacheEfficiencyData> {
  const empty: CacheEfficiencyData = {
    cacheHitRate: 0,
    totalRequests: 0,
    cachedRequests: 0,
    fbclidRequests: 0,
    adjustedCacheHitRate: 0,
    meetsTarget: false,
  };
  if (!ENV.cfApiToken || !ENV.cfZoneId) return empty;

  const now = Date.now();
  const since = new Date(now - 6 * 60 * 60 * 1000).toISOString();
  const until = new Date(now).toISOString();

  const query = `{
    viewer {
      zones(filter: { zoneTag: "${ENV.cfZoneId}" }) {
        allRequests: httpRequestsAdaptiveGroups(
          limit: 1
          filter: { datetime_geq: "${since}", datetime_leq: "${until}" }
        ) {
          count
          sum { cachedRequests }
        }
        fbclidMiss: httpRequestsAdaptiveGroups(
          limit: 1
          filter: {
            datetime_geq: "${since}",
            datetime_leq: "${until}",
            clientRequestQuery_contains: "fbclid",
            cacheStatus_neq: "hit"
          }
        ) {
          count
        }
      }
    }
  }`;

  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: { Authorization: `Bearer ${ENV.cfApiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const json = (await res.json()) as {
      data?: {
        viewer: {
          zones: {
            allRequests: { count: number; sum: { cachedRequests: number } }[];
            fbclidMiss: { count: number }[];
          }[];
        };
      };
      errors?: { message: string }[];
    };
    if (json.errors?.length) {
      console.warn("[getCacheEfficiencyData] CF GraphQL errors:", json.errors);
      // Fallback: try simpler query without fbclid filter (not all CF plans support clientRequestQuery)
      return await getCacheEfficiencyDataSimple();
    }
    const zone = json.data?.viewer?.zones?.[0];
    if (!zone) return empty;

    const totalRequests = zone.allRequests.reduce((s, r) => s + r.count, 0);
    const cachedRequests = zone.allRequests.reduce((s, r) => s + (r.sum?.cachedRequests ?? 0), 0);
    const fbclidRequests = zone.fbclidMiss.reduce((s, r) => s + r.count, 0);

    const cacheHitRate = totalRequests > 0 ? cachedRequests / totalRequests : 0;
    const adjustedTotal = Math.max(totalRequests - fbclidRequests, 1);
    const adjustedCacheHitRate = adjustedTotal > 0 ? Math.min(cachedRequests / adjustedTotal, 1) : 0;
    const meetsTarget = adjustedCacheHitRate >= 0.85;

    return { cacheHitRate, totalRequests, cachedRequests, fbclidRequests, adjustedCacheHitRate, meetsTarget };
  } catch (err) {
    console.warn("[getCacheEfficiencyData] fetch error:", err);
    return empty;
  }
}

/** Fallback: simpler cache efficiency query without fbclid filter */
async function getCacheEfficiencyDataSimple(): Promise<CacheEfficiencyData> {
  const empty: CacheEfficiencyData = {
    cacheHitRate: 0,
    totalRequests: 0,
    cachedRequests: 0,
    fbclidRequests: 0,
    adjustedCacheHitRate: 0,
    meetsTarget: false,
  };
  if (!ENV.cfApiToken || !ENV.cfZoneId) return empty;

  const now = Date.now();
  const since = new Date(now - 6 * 60 * 60 * 1000).toISOString();
  const until = new Date(now).toISOString();

  const query = `{
    viewer {
      zones(filter: { zoneTag: "${ENV.cfZoneId}" }) {
        allRequests: httpRequestsAdaptiveGroups(
          limit: 1
          filter: { datetime_geq: "${since}", datetime_leq: "${until}" }
        ) {
          count
          sum { cachedRequests }
        }
      }
    }
  }`;

  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: { Authorization: `Bearer ${ENV.cfApiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const json = (await res.json()) as {
      data?: {
        viewer: { zones: { allRequests: { count: number; sum: { cachedRequests: number } }[] }[] };
      };
      errors?: { message: string }[];
    };
    if (json.errors?.length) return empty;
    const zone = json.data?.viewer?.zones?.[0];
    if (!zone) return empty;

    const totalRequests = zone.allRequests.reduce((s, r) => s + r.count, 0);
    const cachedRequests = zone.allRequests.reduce((s, r) => s + (r.sum?.cachedRequests ?? 0), 0);
    const cacheHitRate = totalRequests > 0 ? cachedRequests / totalRequests : 0;

    return {
      cacheHitRate,
      totalRequests,
      cachedRequests,
      fbclidRequests: 0,
      adjustedCacheHitRate: cacheHitRate,
      meetsTarget: cacheHitRate >= 0.85,
    };
  } catch {
    return empty;
  }
}

export interface FBTrafficValidation {
  /** Total requests with fbclid query param in last 24h */
  fbclidTotal: number;
  /** Successful fbclid requests (2xx) */
  fbclidSuccess: number;
  /** Failed fbclid requests (4xx + 5xx) */
  fbclidFailure: number;
  /** Success rate (0–1) */
  successRate: number;
  /** Whether success rate is below 95% (warning threshold) */
  hasIssue: boolean;
}

/**
 * FB Traffic Validation — verify fbclid requests success vs failure rate.
 * Uses CF httpRequestsAdaptiveGroups with clientRequestQuery filter.
 * Falls back to a simplified query if the filter is not supported.
 */
export async function getFBTrafficValidation(): Promise<FBTrafficValidation> {
  const empty: FBTrafficValidation = {
    fbclidTotal: 0,
    fbclidSuccess: 0,
    fbclidFailure: 0,
    successRate: 1,
    hasIssue: false,
  };
  if (!ENV.cfApiToken || !ENV.cfZoneId) return empty;

  const now = Date.now();
  const since = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const until = new Date(now).toISOString();

  // Try to get fbclid-specific data via CF GraphQL
  // Note: clientRequestQuery_contains is only available on some CF plans
  const query = `{
    viewer {
      zones(filter: { zoneTag: "${ENV.cfZoneId}" }) {
        fbclidAll: httpRequestsAdaptiveGroups(
          limit: 1
          filter: {
            datetime_geq: "${since}",
            datetime_leq: "${until}",
            clientRequestQuery_contains: "fbclid"
          }
        ) {
          count
        }
        fbclidSuccess: httpRequestsAdaptiveGroups(
          limit: 1
          filter: {
            datetime_geq: "${since}",
            datetime_leq: "${until}",
            clientRequestQuery_contains: "fbclid",
            edgeResponseStatus_lt: 400
          }
        ) {
          count
        }
        fbclidFailure: httpRequestsAdaptiveGroups(
          limit: 1
          filter: {
            datetime_geq: "${since}",
            datetime_leq: "${until}",
            clientRequestQuery_contains: "fbclid",
            edgeResponseStatus_geq: 400
          }
        ) {
          count
        }
      }
    }
  }`;

  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: { Authorization: `Bearer ${ENV.cfApiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const json = (await res.json()) as {
      data?: {
        viewer: {
          zones: {
            fbclidAll: { count: number }[];
            fbclidSuccess: { count: number }[];
            fbclidFailure: { count: number }[];
          }[];
        };
      };
      errors?: { message: string }[];
    };
    if (json.errors?.length) {
      console.warn("[getFBTrafficValidation] CF GraphQL errors (plan may not support clientRequestQuery filter):", json.errors);
      // Return empty with a note — not a critical failure
      return { ...empty, fbclidTotal: -1 }; // -1 signals "not supported"
    }
    const zone = json.data?.viewer?.zones?.[0];
    if (!zone) return empty;

    const fbclidTotal = zone.fbclidAll.reduce((s, r) => s + r.count, 0);
    const fbclidSuccess = zone.fbclidSuccess.reduce((s, r) => s + r.count, 0);
    const fbclidFailure = zone.fbclidFailure.reduce((s, r) => s + r.count, 0);
    const successRate = fbclidTotal > 0 ? fbclidSuccess / fbclidTotal : 1;
    const hasIssue = fbclidTotal > 0 && successRate < 0.95;

    return { fbclidTotal, fbclidSuccess, fbclidFailure, successRate, hasIssue };
  } catch (err) {
    console.warn("[getFBTrafficValidation] fetch error:", err);
    return empty;
  }
}

// ─── V5.1: Cache MISS Pattern Analysis ───────────────────────────────────────
/**
 * Identify top URLs with CF cache MISS status in the last 6h.
 * These are URLs that bypass the edge cache and hit the origin server,
 * causing TTFB peaks. Uses CF GraphQL httpRequestsAdaptiveGroups.
 */
export interface CacheMissPattern {
  topMissUrls: Array<{ url: string; missCount: number }>;
  totalMissRequests: number;
  totalRequests: number;
  missRate: number;
  hasHighMissRate: boolean; // true if missRate > 20%
}

export async function getCacheMissPatterns(): Promise<CacheMissPattern> {
  const empty: CacheMissPattern = {
    topMissUrls: [],
    totalMissRequests: 0,
    totalRequests: 0,
    missRate: 0,
    hasHighMissRate: false,
  };
  if (!ENV.cfApiToken || !ENV.cfZoneId) return empty;

  const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const until = new Date().toISOString();

  const query = `{
    viewer {
      zones(filter: { zoneTag: "${ENV.cfZoneId}" }) {
        missGroups: httpRequestsAdaptiveGroups(
          filter: { datetime_geq: "${since}", datetime_leq: "${until}", cacheStatus: "miss" }
          limit: 10
          orderBy: [count_DESC]
        ) {
          count
          dimensions { clientRequestPath }
        }
        allGroups: httpRequestsAdaptiveGroups(
          filter: { datetime_geq: "${since}", datetime_leq: "${until}" }
          limit: 1
        ) {
          count
        }
      }
    }
  }`;

  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: { Authorization: `Bearer ${ENV.cfApiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const json = (await res.json()) as {
      data?: {
        viewer: {
          zones: {
            missGroups: { count: number; dimensions: { clientRequestPath: string } }[];
            allGroups: { count: number }[];
          }[];
        };
      };
      errors?: { message: string }[];
    };
    if (json.errors?.length) {
      console.warn("[getCacheMissPatterns] CF GraphQL errors:", json.errors);
      return empty;
    }
    const zone = json.data?.viewer?.zones?.[0];
    if (!zone) return empty;

    const totalRequests = zone.allGroups.reduce((s, r) => s + r.count, 0);
    const totalMissRequests = zone.missGroups.reduce((s, r) => s + r.count, 0);
    const topMissUrls = zone.missGroups.map((g) => ({
      url: g.dimensions.clientRequestPath,
      missCount: g.count,
    }));
    const missRate = totalRequests > 0 ? totalMissRequests / totalRequests : 0;
    const hasHighMissRate = missRate > 0.2; // > 20% MISS rate is concerning

    return { topMissUrls, totalMissRequests, totalRequests, missRate, hasHighMissRate };
  } catch (err) {
    console.warn("[getCacheMissPatterns] fetch error:", err);
    return empty;
  }
}

// ─── V8.0: Advanced Watchdog Traffic Spike + Brute Force Detection ──────────
export interface TrendingTrafficSpike {
  url: string;
  views: number;
  fullUrl: string;
}

export interface TrendingTrafficSpikeResult {
  threshold: number;
  windowMinutes: number;
  spikes: TrendingTrafficSpike[];
}

function isLikelyNewsArticlePath(path: string): boolean {
  if (!path || path === "/") return false;
  if (path.startsWith("/wp-") || path.startsWith("/api/") || path.startsWith("/.netlify/")) return false;
  if (/\.(?:css|js|json|xml|jpg|jpeg|png|gif|webp|svg|ico|woff2?|ttf|map)$/i.test(path)) return false;
  return path.split("/").filter(Boolean).length >= 2;
}

export async function getTrendingTrafficSpikes(threshold = 500): Promise<TrendingTrafficSpikeResult> {
  const empty: TrendingTrafficSpikeResult = { threshold, windowMinutes: 60, spikes: [] };
  if (!ENV.cfApiToken || !ENV.cfZoneId) return empty;

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const until = new Date().toISOString();
  const query = `{
    viewer {
      zones(filter: { zoneTag: "${ENV.cfZoneId}" }) {
        articleGroups: httpRequestsAdaptiveGroups(
          limit: 50
          orderBy: [count_DESC]
          filter: { datetime_geq: "${since}", datetime_leq: "${until}", edgeResponseStatus_lt: 400 }
        ) {
          count
          dimensions { clientRequestPath }
        }
      }
    }
  }`;

  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: { Authorization: `Bearer ${ENV.cfApiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const json = (await res.json()) as {
      data?: { viewer?: { zones?: { articleGroups?: { count: number; dimensions?: { clientRequestPath?: string } }[] }[] } };
      errors?: { message: string }[];
    };
    if (json.errors?.length) {
      console.warn("[getTrendingTrafficSpikes] CF GraphQL errors:", json.errors);
      return empty;
    }
    const groups = json.data?.viewer?.zones?.[0]?.articleGroups ?? [];
    const spikes = groups
      .map((g) => ({ url: g.dimensions?.clientRequestPath ?? "", views: g.count }))
      .filter((item) => item.views >= threshold && isLikelyNewsArticlePath(item.url))
      .slice(0, 10)
      .map((item) => ({ ...item, fullUrl: `${ENV.wpSiteUrl.replace(/\/$/, "")}${item.url}` }));
    return { ...empty, spikes };
  } catch (err) {
    console.warn("[getTrendingTrafficSpikes] fetch error:", err);
    return empty;
  }
}

export interface BruteForceOffender {
  ip: string;
  attempts: number;
  topPath: string;
}

export interface BruteForceWatchdogResult {
  threshold: number;
  windowMinutes: number;
  offenders: BruteForceOffender[];
}

export async function getBruteForceLoginAttempts(threshold = 20): Promise<BruteForceWatchdogResult> {
  const empty: BruteForceWatchdogResult = { threshold, windowMinutes: 15, offenders: [] };
  if (!ENV.cfApiToken || !ENV.cfZoneId) return empty;

  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const until = new Date().toISOString();
  const query = `{
    viewer {
      zones(filter: { zoneTag: "${ENV.cfZoneId}" }) {
        wpLogin: httpRequestsAdaptiveGroups(
          limit: 50
          orderBy: [count_DESC]
          filter: { datetime_geq: "${since}", datetime_leq: "${until}", edgeResponseStatus_geq: 400, clientRequestPath: "/wp-login.php" }
        ) {
          count
          dimensions { clientIP clientRequestPath }
        }
        wpAdmin: httpRequestsAdaptiveGroups(
          limit: 50
          orderBy: [count_DESC]
          filter: { datetime_geq: "${since}", datetime_leq: "${until}", edgeResponseStatus_geq: 400, clientRequestPath_contains: "/wp-admin/" }
        ) {
          count
          dimensions { clientIP clientRequestPath }
        }
      }
    }
  }`;

  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: { Authorization: `Bearer ${ENV.cfApiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const json = (await res.json()) as {
      data?: {
        viewer?: {
          zones?: {
            wpLogin?: { count: number; dimensions?: { clientIP?: string; clientRequestPath?: string } }[];
            wpAdmin?: { count: number; dimensions?: { clientIP?: string; clientRequestPath?: string } }[];
          }[];
        };
      };
      errors?: { message: string }[];
    };
    if (json.errors?.length) {
      console.warn("[getBruteForceLoginAttempts] CF GraphQL errors:", json.errors);
      return empty;
    }

    const combined = [...(json.data?.viewer?.zones?.[0]?.wpLogin ?? []), ...(json.data?.viewer?.zones?.[0]?.wpAdmin ?? [])];
    const byIp = new Map<string, BruteForceOffender>();
    for (const item of combined) {
      const ip = item.dimensions?.clientIP ?? "";
      if (!ip) continue;
      const current = byIp.get(ip) ?? { ip, attempts: 0, topPath: item.dimensions?.clientRequestPath ?? "/wp-login.php" };
      current.attempts += item.count;
      byIp.set(ip, current);
    }
    const offenders = Array.from(byIp.values())
      .filter((item) => item.attempts >= threshold)
      .sort((a, b) => b.attempts - a.attempts)
      .slice(0, 10);
    return { ...empty, offenders };
  } catch (err) {
    console.warn("[getBruteForceLoginAttempts] fetch error:", err);
    return empty;
  }
}
