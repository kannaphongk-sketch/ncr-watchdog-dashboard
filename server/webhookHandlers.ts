/**
 * Webhook handlers for NCR Watchdog
 *
 * Protocol 3: Cache Warming
 * WordPress publishes a new post → sends a POST to /api/webhook/wp-publish
 * → we do ONE silent GET to the new URL to prime Cloudflare Edge Cache
 * → send Telegram notification
 */

import type { Request, Response } from "express";
import { ENV } from "./_core/env";
import { sendTelegramMessage, buildCacheWarmedAlert } from "./telegram";

/** Shared secret to authenticate WordPress webhook calls */
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? ENV.cookieSecret ?? "";

/**
 * POST /api/webhook/wp-publish
 *
 * Expected body (from WordPress publish action hook):
 * {
 *   "secret": "<WEBHOOK_SECRET>",
 *   "url": "https://nakornchiangrainews.com/2026/05/some-post-slug/"
 * }
 *
 * WordPress side: use a simple plugin or functions.php hook that fires on
 * `transition_post_status` (new_status === 'publish') and sends this payload.
 */
export async function handleWpPublish(req: Request, res: Response) {
  try {
    const { secret, url } = req.body as { secret?: string; url?: string };

    // Validate secret
    if (!WEBHOOK_SECRET || secret !== WEBHOOK_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Validate URL — must be on the target domain
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "Missing url" });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({ error: "Invalid url" });
    }

    const allowedHosts = ["nakornchiangrainews.com", "www.nakornchiangrainews.com"];
    if (!allowedHosts.includes(parsedUrl.hostname)) {
      return res.status(400).json({ error: "URL not allowed" });
    }

    // Protocol 3: ONE silent GET request to warm Cloudflare Edge Cache
    let warmed = false;
    try {
      const warmRes = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": "NCRWatchdog/1.0 CacheWarmer (+https://nakornchiangrainews.com)",
          "Cache-Control": "no-cache", // bypass any stale cache on first hit
        },
        signal: AbortSignal.timeout(15_000), // 15s timeout
      });
      warmed = warmRes.ok;
      console.log(`[protocol3-cache-warm] GET ${url} → ${warmRes.status}`);
    } catch (fetchErr) {
      console.warn("[protocol3-cache-warm] fetch failed:", fetchErr);
    }

    // Notify Telegram regardless of warm success (post is live)
    const msg = buildCacheWarmedAlert(url);
    await sendTelegramMessage(msg);

    res.json({ ok: true, url, warmed });
  } catch (err) {
    console.error("[webhook:wp-publish]", err);
    res.status(500).json({ error: (err as Error).message });
  }
}
