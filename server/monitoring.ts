import https from "node:https";
import { ENV } from "./_core/env";

export interface SiteCheckResult {
  httpCode: number;
  ttfbMs: number;
  cacheStatus: string;
  cfRay: string;
  cacheControl?: string;
  vary?: string;
  setCookieHeader?: string;
  isUp: boolean;
  error?: string;
  memory_usage?: number;
  disk_free?: number;
}

/**
 * Performs a secure request to the Sentinel V31 API.
 * Syncs with nakornchiangrainews.com via the NCR_API_SECRET.
 */
export async function checkSite(): Promise<SiteCheckResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    const sentinelUrl = new URL(ENV.wpSentinelUrl || `${ENV.wpSiteUrl.replace(/\/$/, "")}/wp-json/ncr/v3/monitor`);
    sentinelUrl.searchParams.set("secret", ENV.ncrApiSecret);

    const options = {
      hostname: sentinelUrl.hostname,
      port: 443,
      path: `${sentinelUrl.pathname}${sentinelUrl.search}`,
      method: "HEAD",
      timeout: 10000,
      headers: {
        "User-Agent": "NCR-Watchdog-Sentinel-V31",
        "NCR-Secret": ENV.ncrApiSecret,
      },
    };

    const req = https.request(options, (res) => {
      res.resume();

      res.on("end", () => {
        const ttfbMs = Date.now() - startTime;
        const httpCode = res.statusCode ?? 0;
        const cacheStatus = (res.headers["cf-cache-status"] as string) || "UNKNOWN";
        const cfRay = (res.headers["cf-ray"] as string) || "";

        resolve({
          httpCode,
          ttfbMs,
          cacheStatus: cacheStatus.toUpperCase(),
          cfRay,
          cacheControl: (res.headers["cache-control"] as string) || "",
          vary: (res.headers["vary"] as string) || "",
          setCookieHeader: Array.isArray(res.headers["set-cookie"]) ? res.headers["set-cookie"].join("; ") : String(res.headers["set-cookie"] ?? ""),
          isUp: httpCode === 200,
          memory_usage: 0,
          disk_free: 0,
        });
      });
    });

    req.on("error", (err) => {
      resolve({
        httpCode: 0,
        ttfbMs: Date.now() - startTime,
        cacheStatus: "ERROR",
        cfRay: "",
        isUp: false,
        error: err.message,
      });
    });

    req.on("timeout", () => {
      req.destroy(new Error("Watchdog HEAD request timed out"));
    });

    req.end();
  });
}
