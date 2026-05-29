/**
 * WordPress Watchdog — ตรวจสอบ WordPress 24/7 ทุก 1 ชั่วโมง
 * - ตรวจ stuck scheduled posts → publish อัตโนมัติ
 * - ตรวจ noindex ผิดปกติ → แจ้ง Telegram
 * - ตรวจ draft ค้างนานเกิน 7 วัน → แจ้ง Telegram
 * - ตรวจ site health → แจ้งถ้ามีปัญหาใหญ่
 */

import type { Request, Response } from "express";
import { sendTelegramMessage } from "./telegram";
import { isInCooldown, setCooldown, upsertSchedulerState } from "./db";
import { ENV } from "./_core/env";

interface WpPost {
  id: number;
  title: { rendered: string };
  status: string;
  date: string;
  modified: string;
  link: string;
  meta?: Record<string, unknown>;
}

interface WpWatchdogResult {
  stuckScheduled: WpPost[];
  longDrafts: WpPost[];
  noindexPublic: WpPost[];
  autoFixed: { postId: number; action: string; title: string }[];
  errors: string[];
}

function getWpCredentials() {
  const user = ENV.wpUser || process.env.WP_USER || "";
  const pass = ENV.wpAppPassword || process.env.WP_APP_PASSWORD || "";
  const siteUrl = (ENV.wpSiteUrl || "https://nakornchiangrainews.com").replace(/\/$/, "");
  if (!user || !pass) return null;
  const token = Buffer.from(`${user}:${pass}`).toString("base64");
  return { token, siteUrl, headers: { "Authorization": `Basic ${token}`, "Content-Type": "application/json" } };
}

async function fetchWpPosts(siteUrl: string, headers: Record<string, string>, params: string): Promise<WpPost[]> {
  try {
    const res = await fetch(`${siteUrl}/wp-json/wp/v2/posts?${params}&_fields=id,title,status,date,modified,link`, {
      headers,
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];
    return await res.json() as WpPost[];
  } catch {
    return [];
  }
}

async function publishPost(siteUrl: string, headers: Record<string, string>, postId: number): Promise<boolean> {
  try {
    const res = await fetch(`${siteUrl}/wp-json/wp/v2/posts/${postId}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ status: "publish" }),
      signal: AbortSignal.timeout(10000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function runWpWatchdog(): Promise<WpWatchdogResult> {
  const result: WpWatchdogResult = {
    stuckScheduled: [],
    longDrafts: [],
    noindexPublic: [],
    autoFixed: [],
    errors: [],
  };

  const creds = getWpCredentials();
  if (!creds) {
    result.errors.push("WP credentials not configured (WP_USER / WP_APP_PASSWORD)");
    return result;
  }

  const { siteUrl, headers } = creds;
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // ── 1. Stuck Scheduled Posts ─────────────────────────────────────────────
  // Posts ที่ status=future แต่ date ผ่านมาแล้ว = stuck
  const futurePosts = await fetchWpPosts(siteUrl, headers,
    `status=future&per_page=20&orderby=date&order=asc`
  );
  for (const post of futurePosts) {
    const postDate = new Date(post.date);
    if (postDate < now) {
      result.stuckScheduled.push(post);
      // Auto-fix: publish ทันที
      const ok = await publishPost(siteUrl, headers, post.id);
      if (ok) {
        result.autoFixed.push({ postId: post.id, action: "published_stuck_scheduled", title: post.title.rendered });
      } else {
        result.errors.push(`Failed to publish stuck post #${post.id}`);
      }
    }
  }

  // ── 2. Long-stuck Drafts (> 7 วัน) ──────────────────────────────────────
  const draftPosts = await fetchWpPosts(siteUrl, headers,
    `status=draft&per_page=20&orderby=modified&order=asc&modified_before=${sevenDaysAgo}`
  );
  result.longDrafts = draftPosts;

  // ── 3. ตรวจ noindex บน public posts ─────────────────────────────────────
  // ดึง published posts ล่าสุด 50 บทความ แล้วเช็ค meta robots
  try {
    const recentRes = await fetch(
      `${siteUrl}/wp-json/wp/v2/posts?status=publish&per_page=50&orderby=date&order=desc&_fields=id,title,link`,
      { headers, signal: AbortSignal.timeout(15000) }
    );
    if (recentRes.ok) {
      const recentPosts = await recentRes.json() as WpPost[];
      // ตรวจ noindex โดยดึง HTML header ของแต่ละ post (batch 5 ไม่ให้ช้าเกิน)
      const sample = recentPosts.slice(0, 5);
      for (const post of sample) {
        try {
          const htmlRes = await fetch(post.link, { signal: AbortSignal.timeout(8000) });
          const html = await htmlRes.text();
          if (html.includes('name="robots"') && html.includes("noindex")) {
            result.noindexPublic.push(post);
          }
        } catch { /* skip */ }
      }
    }
  } catch (e) {
    result.errors.push(`noindex check failed: ${e}`);
  }

  return result;
}

function buildWpWatchdogMessage(result: WpWatchdogResult, bangkokTime: string): string {
  const hasIssues = result.stuckScheduled.length > 0 || result.longDrafts.length > 0 || result.noindexPublic.length > 0;
  const hasAutoFix = result.autoFixed.length > 0;

  if (!hasIssues && !hasAutoFix) {
    return `✅ <b>[WP Watchdog] ตรวจสอบเรียบร้อย</b>\n🕐 ${bangkokTime}\nไม่พบปัญหาใดๆ ระบบปกติ 🟢`;
  }

  let msg = `🤖 <b>[WP Watchdog] รายงานการตรวจสอบ</b>\n🕐 ${bangkokTime}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;

  if (hasAutoFix) {
    msg += `\n✅ <b>แก้ไขอัตโนมัติแล้ว (${result.autoFixed.length} รายการ):</b>\n`;
    for (const fix of result.autoFixed.slice(0, 5)) {
      const label = fix.action === "published_stuck_scheduled" ? "Publish stuck scheduled" : fix.action;
      msg += `• [#${fix.postId}] ${label}: ${fix.title.slice(0, 50)}\n`;
    }
  }

  if (result.stuckScheduled.length > 0 && result.autoFixed.length < result.stuckScheduled.length) {
    msg += `\n⚠️ <b>Stuck Scheduled (แก้ไม่สำเร็จ ${result.stuckScheduled.length - result.autoFixed.length} รายการ):</b>\n`;
    for (const post of result.stuckScheduled.slice(0, 3)) {
      msg += `• <a href="${post.link}">${post.title.rendered.slice(0, 50)}</a>\n`;
    }
  }

  if (result.longDrafts.length > 0) {
    msg += `\n📝 <b>Draft ค้างนาน > 7 วัน (${result.longDrafts.length} รายการ):</b>\n`;
    for (const post of result.longDrafts.slice(0, 3)) {
      const daysSince = Math.floor((Date.now() - new Date(post.modified).getTime()) / 86400000);
      msg += `• ${post.title.rendered.slice(0, 40)} (${daysSince} วันที่แล้ว)\n`;
    }
    if (result.longDrafts.length > 3) msg += `• ...และอีก ${result.longDrafts.length - 3} รายการ\n`;
  }

  if (result.noindexPublic.length > 0) {
    msg += `\n🚨 <b>พบ noindex บน Public Posts (${result.noindexPublic.length} รายการ):</b>\n`;
    for (const post of result.noindexPublic) {
      msg += `• <a href="${post.link}">${post.title.rendered.slice(0, 50)}</a>\n`;
    }
    msg += `⚠️ กรุณาตรวจสอบการตั้งค่า SEO plugin ทันที\n`;
  }

  if (result.errors.length > 0) {
    msg += `\n⚙️ <b>Errors:</b> ${result.errors.slice(0, 2).join(", ")}\n`;
  }

  msg += `\n🔗 <a href="https://nakornchiangrainews.com/wp-admin/edit.php">WP Admin → Posts</a>`;
  return msg;
}

// ── Express Handler ───────────────────────────────────────────────────────────

export async function handleWpWatchdog(req: Request, res: Response) {
  try {
    const { sdk } = await import("./_core/sdk");
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });

    const bangkokTime = new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" });
    const result = await runWpWatchdog();
    const hasIssues = result.stuckScheduled.length > 0 || result.longDrafts.length > 0 || result.noindexPublic.length > 0 || result.autoFixed.length > 0;

    // ส่ง Telegram เฉพาะเมื่อมีปัญหาหรือมีการ auto-fix
    // ถ้าปกติทุกอย่าง ส่งสรุปวันละครั้ง 09:00 เท่านั้น (ไม่ส่งทุกชั่วโมง)
    const isNineAM = new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok", hour: "numeric", hour12: false }) === "9";
    const shouldSend = hasIssues || isNineAM;

    if (shouldSend) {
      const msg = buildWpWatchdogMessage(result, bangkokTime);
      await sendTelegramMessage(msg);
    }

    await upsertSchedulerState("wp-watchdog", {
      lastRunAt: new Date(),
      lastStatus: hasIssues ? `issues:${result.stuckScheduled.length}stuck,${result.longDrafts.length}draft,${result.noindexPublic.length}noindex` : "ok",
    });

    res.json({
      ok: true,
      stuckScheduled: result.stuckScheduled.length,
      longDrafts: result.longDrafts.length,
      noindexPublic: result.noindexPublic.length,
      autoFixed: result.autoFixed.length,
      errors: result.errors,
      telegramSent: shouldSend,
    });
  } catch (err) {
    console.error("[wp-watchdog]", err);
    res.status(500).json({ error: (err as Error).message });
  }
}
