/**
 * Google Search Console Integration
 * ตรวจสอบ indexing status และ crawl errors ทุก 1 ชั่วโมง
 * ใช้ Service Account JWT สำหรับ authentication
 */

import type { Request, Response } from "express";
import { sendTelegramMessage } from "./telegram";
import { isInCooldown, setCooldown, upsertSchedulerState } from "./db";
import { ENV } from "./_core/env";

const GSC_SITE_URL = "https://nakornchiangrainews.com/";
const GSC_API_BASE = "https://searchconsole.googleapis.com/webmasters/v3";

// ── JWT Helper (Sign without external library) ──────────────────────────────

async function getGoogleAccessToken(): Promise<string | null> {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || ENV.googleServiceAccountKey || "";
  if (!keyJson) return null;

  try {
    const key = typeof keyJson === "string" ? JSON.parse(keyJson) : keyJson;
    const now = Math.floor(Date.now() / 1000);

    // Build JWT header and payload
    const header = { alg: "RS256", typ: "JWT" };
    const payload = {
      iss: key.client_email,
      scope: "https://www.googleapis.com/auth/webmasters.readonly",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    };

    const encode = (obj: object) =>
      Buffer.from(JSON.stringify(obj)).toString("base64url");

    const headerB64 = encode(header);
    const payloadB64 = encode(payload);
    const signingInput = `${headerB64}.${payloadB64}`;

    // Import private key for signing
    const privateKeyPem = key.private_key as string;
    const pemBody = privateKeyPem
      .replace("-----BEGIN PRIVATE KEY-----", "")
      .replace("-----END PRIVATE KEY-----", "")
      .replace(/\s/g, "");

    const binaryKey = Buffer.from(pemBody, "base64");
    const cryptoKey = await crypto.subtle.importKey(
      "pkcs8",
      binaryKey,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      Buffer.from(signingInput)
    );

    const signatureB64 = Buffer.from(signature).toString("base64url");
    const jwt = `${signingInput}.${signatureB64}`;

    // Exchange JWT for access token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.warn("[gsc] token exchange failed:", err);
      return null;
    }

    const tokenData = await tokenRes.json() as { access_token?: string };
    return tokenData.access_token ?? null;
  } catch (err) {
    console.warn("[gsc] getAccessToken error:", err);
    return null;
  }
}

// ── GSC API Helpers ──────────────────────────────────────────────────────────

interface GscInspectResult {
  url: string;
  verdict: string; // "PASS" | "FAIL" | "NEUTRAL"
  indexingState: string; // "INDEXING_ALLOWED" | "BLOCKED_BY_META_TAG" | etc.
  robotsTxtState: string;
  coverageState: string;
}

async function inspectUrl(token: string, url: string): Promise<GscInspectResult | null> {
  try {
    const res = await fetch(`https://searchconsole.googleapis.com/v1/urlInspection/index:inspect`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inspectionUrl: url,
        siteUrl: GSC_SITE_URL,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return null;
    const data = await res.json() as any;
    const result = data?.inspectionResult?.indexStatusResult;
    if (!result) return null;

    return {
      url,
      verdict: result.verdict ?? "NEUTRAL",
      indexingState: result.indexingState ?? "UNKNOWN",
      robotsTxtState: result.robotsTxtState ?? "UNKNOWN",
      coverageState: result.coverageState ?? "UNKNOWN",
    };
  } catch {
    return null;
  }
}

async function getSitemapUrls(token: string): Promise<string[]> {
  try {
    const res = await fetch(`${GSC_API_BASE}/sites/${encodeURIComponent(GSC_SITE_URL)}/sitemaps`, {
      headers: { "Authorization": `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json() as any;
    const sitemaps = data?.sitemap ?? [];
    // ดึง URL จาก sitemap แรก (ถ้ามี contents)
    const urls: string[] = [];
    for (const sitemap of sitemaps.slice(0, 3)) {
      for (const content of (sitemap.contents ?? []).slice(0, 20)) {
        if (content.type === "WEB") {
          // ดึงตัวอย่าง URL จาก WordPress REST API แทน
        }
      }
    }
    return urls;
  } catch {
    return [];
  }
}

async function getRecentWpPostUrls(): Promise<string[]> {
  try {
    const res = await fetch(
      "https://nakornchiangrainews.com/wp-json/wp/v2/posts?per_page=10&status=publish&_fields=link",
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return [];
    const posts = await res.json() as { link: string }[];
    return posts.map(p => p.link).filter(Boolean);
  } catch {
    return [];
  }
}

// ── Main Watchdog Logic ──────────────────────────────────────────────────────

interface GscWatchdogResult {
  checked: number;
  noindexIssues: GscInspectResult[];
  crawlErrors: GscInspectResult[];
  errors: string[];
}

async function runGscWatchdog(): Promise<GscWatchdogResult> {
  const result: GscWatchdogResult = {
    checked: 0,
    noindexIssues: [],
    crawlErrors: [],
    errors: [],
  };

  const token = await getGoogleAccessToken();
  if (!token) {
    result.errors.push("ไม่สามารถรับ Google Access Token ได้ — ตรวจสอบ GOOGLE_SERVICE_ACCOUNT_KEY");
    return result;
  }

  // ดึง URL ล่าสุดจาก WordPress
  const urls = await getRecentWpPostUrls();
  if (urls.length === 0) {
    result.errors.push("ไม่พบ URL จาก WordPress API");
    return result;
  }

  // ตรวจสอบแค่ 5 URL ต่อรอบ (ป้องกัน rate limit)
  const urlsToCheck = urls.slice(0, 5);
  result.checked = urlsToCheck.length;

  for (const url of urlsToCheck) {
    const inspection = await inspectUrl(token, url);
    if (!inspection) continue;

    // ตรวจ noindex
    if (
      inspection.indexingState === "BLOCKED_BY_META_TAG" ||
      inspection.indexingState === "BLOCKED_BY_HTTP_HEADER" ||
      inspection.verdict === "FAIL"
    ) {
      result.noindexIssues.push(inspection);
    }

    // ตรวจ crawl errors
    if (inspection.coverageState?.includes("Error") || inspection.coverageState?.includes("Excluded")) {
      result.crawlErrors.push(inspection);
    }

    // Delay เล็กน้อยป้องกัน rate limit
    await new Promise(r => setTimeout(r, 500));
  }

  return result;
}

function buildGscReport(result: GscWatchdogResult, bangkokTime: string): string | null {
  const hasIssues = result.noindexIssues.length > 0 || result.crawlErrors.length > 0;

  if (!hasIssues && result.errors.length === 0) return null; // ไม่ส่งถ้าปกติ

  let msg = `🔍 <b>[Google Search Console Alert]</b>\n🕐 ${bangkokTime}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `📊 ตรวจสอบ ${result.checked} URLs\n\n`;

  if (result.noindexIssues.length > 0) {
    msg += `🚨 <b>พบ noindex บน ${result.noindexIssues.length} บทความ:</b>\n`;
    for (const issue of result.noindexIssues.slice(0, 5)) {
      msg += `• <a href="${issue.url}">${issue.url.replace("https://nakornchiangrainews.com", "")}</a>\n`;
      msg += `  → ${issue.indexingState}\n`;
    }
    msg += `\n⚠️ กรุณาตรวจสอบ SEO plugin และ WordPress settings\n`;
  }

  if (result.crawlErrors.length > 0) {
    msg += `\n❌ <b>Crawl Errors (${result.crawlErrors.length} URLs):</b>\n`;
    for (const err of result.crawlErrors.slice(0, 3)) {
      msg += `• <a href="${err.url}">${err.url.replace("https://nakornchiangrainews.com", "")}</a>\n`;
      msg += `  → ${err.coverageState}\n`;
    }
  }

  if (result.errors.length > 0) {
    msg += `\n⚙️ <b>System Errors:</b> ${result.errors.slice(0, 2).join(", ")}\n`;
  }

  msg += `\n🔗 <a href="https://search.google.com/search-console">Google Search Console</a>`;
  return msg;
}

// ── Express Handler ───────────────────────────────────────────────────────────

export async function handleGscWatchdog(req: Request, res: Response) {
  try {
    const { sdk } = await import("./_core/sdk");
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });

    const bangkokTime = new Date().toLocaleString("th-TH", {
      timeZone: "Asia/Bangkok",
      hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short"
    });

    const result = await runGscWatchdog();
    const hasIssues = result.noindexIssues.length > 0 || result.crawlErrors.length > 0;

    // ส่ง Telegram เฉพาะเมื่อมีปัญหา (มี cooldown 4 ชั่วโมงป้องกัน spam)
    if (hasIssues) {
      const inCooldown = await isInCooldown("gsc_issues");
      if (!inCooldown) {
        const msg = buildGscReport(result, bangkokTime);
        if (msg) {
          await sendTelegramMessage(msg);
          await setCooldown("gsc_issues", 240); // 4 ชั่วโมง
        }
      }
    }

    await upsertSchedulerState("gsc-watchdog", {
      lastRunAt: new Date(),
      lastStatus: hasIssues
        ? `issues:${result.noindexIssues.length}noindex,${result.crawlErrors.length}errors`
        : "ok",
    });

    res.json({
      ok: true,
      checked: result.checked,
      noindexIssues: result.noindexIssues.length,
      crawlErrors: result.crawlErrors.length,
      errors: result.errors,
    });
  } catch (err) {
    console.error("[gsc-watchdog]", err);
    res.status(500).json({ error: (err as Error).message });
  }
}
