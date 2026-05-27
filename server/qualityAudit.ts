/**
 * Quality Audit — V3.0 Weekly Scan
 * Checks: Broken Links, SEO Missing Tags, Oversized Images
 */

const SITE_URL = "https://nakornchiangrainews.com";

// Sample of key pages to audit
const AUDIT_PAGES = [
  "/",
  "/category/news/",
  "/category/lifestyle/",
  "/category/sport/",
  "/category/entertainment/",
  "/category/local/",
  "/category/politics/",
];

export interface AuditIssue {
  auditType: "broken-links" | "seo" | "images";
  url: string;
  issue: string;
  severity: "critical" | "warning" | "info";
}

/**
 * Fetch a page and return its HTML text. Returns null on error.
 */
async function fetchPage(path: string): Promise<string | null> {
  try {
    const res = await fetch(`${SITE_URL}${path}`, {
      headers: { "User-Agent": "NCR-Watchdog/3.0 QualityAudit" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * Check for broken internal links on a page (links returning 404).
 */
async function checkBrokenLinks(pagePath: string, html: string): Promise<AuditIssue[]> {
  const issues: AuditIssue[] = [];
  // Extract href links
  const hrefRegex = /href="(\/[^"#?]+)"/g;
  const links = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = hrefRegex.exec(html)) !== null) {
    const href = m[1];
    // Skip asset files
    if (href.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|webp)$/i)) continue;
    links.add(href);
  }
  // Check up to 10 links per page to stay within credit limits
  const sample = Array.from(links).slice(0, 10);
  for (const link of sample) {
    try {
      const res = await fetch(`${SITE_URL}${link}`, {
        method: "HEAD",
        headers: { "User-Agent": "NCR-Watchdog/3.0 QualityAudit" },
        signal: AbortSignal.timeout(8000),
      });
      if (res.status === 404) {
        issues.push({
          auditType: "broken-links",
          url: link,
          issue: `404 Not Found (found on ${pagePath})`,
          severity: "warning",
        });
      }
    } catch {
      // Network error — skip
    }
  }
  return issues;
}

/**
 * Check for SEO issues: missing title, meta description, og:title, h1.
 */
function checkSEO(pagePath: string, html: string): AuditIssue[] {
  const issues: AuditIssue[] = [];

  // Title tag
  if (!/<title[^>]*>[^<]{5,}<\/title>/i.test(html)) {
    issues.push({ auditType: "seo", url: pagePath, issue: "Missing or empty <title> tag", severity: "critical" });
  }

  // Meta description
  if (!/<meta[^>]+name=["']description["'][^>]+content=["'][^"']{10,}["']/i.test(html)) {
    issues.push({ auditType: "seo", url: pagePath, issue: "Missing or short meta description", severity: "warning" });
  }

  // og:title
  if (!/<meta[^>]+property=["']og:title["'][^>]+content=["'][^"']{3,}["']/i.test(html)) {
    issues.push({ auditType: "seo", url: pagePath, issue: "Missing og:title meta tag", severity: "info" });
  }

  // H1 tag
  if (!/<h1[^>]*>[^<]{3,}<\/h1>/i.test(html)) {
    issues.push({ auditType: "seo", url: pagePath, issue: "Missing or empty <h1> tag", severity: "warning" });
  }

  return issues;
}

/**
 * Check for oversized images (> 500KB based on Content-Length header).
 */
async function checkOversizedImages(pagePath: string, html: string): Promise<AuditIssue[]> {
  const issues: AuditIssue[] = [];
  const imgRegex = /src=["'](https?:\/\/nakornchiangrainews\.com\/[^"']+\.(?:jpg|jpeg|png|gif|webp))["']/gi;
  const imgs = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = imgRegex.exec(html)) !== null) {
    imgs.add(m[1]);
  }
  // Check up to 5 images per page
  const sample = Array.from(imgs).slice(0, 5);
  for (const imgUrl of sample) {
    try {
      const res = await fetch(imgUrl, {
        method: "HEAD",
        headers: { "User-Agent": "NCR-Watchdog/3.0 QualityAudit" },
        signal: AbortSignal.timeout(8000),
      });
      const contentLength = res.headers.get("content-length");
      if (contentLength) {
        const sizeKB = parseInt(contentLength) / 1024;
        if (sizeKB > 500) {
          issues.push({
            auditType: "images",
            url: imgUrl,
            issue: `Oversized image: ${Math.round(sizeKB)}KB (found on ${pagePath})`,
            severity: sizeKB > 1000 ? "critical" : "warning",
          });
        }
      }
    } catch {
      // Skip
    }
  }
  return issues;
}

/**
 * Run the full weekly quality audit across all key pages.
 * Returns all issues found.
 */
export async function runQualityAudit(): Promise<AuditIssue[]> {
  const allIssues: AuditIssue[] = [];

  for (const pagePath of AUDIT_PAGES) {
    const html = await fetchPage(pagePath);
    if (!html) {
      allIssues.push({
        auditType: "broken-links",
        url: pagePath,
        issue: "Page failed to load (network error or non-200 status)",
        severity: "critical",
      });
      continue;
    }

    // Run all 3 checks in parallel
    const [brokenLinkIssues, seoIssues, imageIssues] = await Promise.all([
      checkBrokenLinks(pagePath, html),
      Promise.resolve(checkSEO(pagePath, html)),
      checkOversizedImages(pagePath, html),
    ]);

    allIssues.push(...brokenLinkIssues, ...seoIssues, ...imageIssues);
  }

  return allIssues;
}

/**
 * Build a Telegram summary message for the quality audit results.
 */
export function buildQualityAuditReport(issues: AuditIssue[], dashboardUrl: string): string {
  const critical = issues.filter((i) => i.severity === "critical");
  const warnings = issues.filter((i) => i.severity === "warning");
  const infos = issues.filter((i) => i.severity === "info");

  const brokenCount = issues.filter((i) => i.auditType === "broken-links").length;
  const seoCount = issues.filter((i) => i.auditType === "seo").length;
  const imageCount = issues.filter((i) => i.auditType === "images").length;

  let msg = `🔍 <b>[NCR] Quality Audit รายสัปดาห์</b>\n`;
  msg += `📅 ${new Date().toLocaleDateString("th-TH", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Bangkok" })}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;

  if (issues.length === 0) {
    msg += `✅ <b>ไม่พบปัญหา!</b> เว็บไซต์อยู่ในสภาพดี\n`;
  } else {
    msg += `📊 พบปัญหาทั้งหมด <b>${issues.length}</b> รายการ:\n`;
    msg += `🔗 Broken Links: <b>${brokenCount}</b>\n`;
    msg += `🏷️ SEO Issues: <b>${seoCount}</b>\n`;
    msg += `🖼️ Oversized Images: <b>${imageCount}</b>\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;

    if (critical.length > 0) {
      msg += `\n🚨 <b>Critical (${critical.length}):</b>\n`;
      critical.slice(0, 5).forEach((i) => {
        msg += `• <code>${i.url}</code>\n  ${i.issue}\n`;
      });
    }

    if (warnings.length > 0) {
      msg += `\n⚠️ <b>Warnings (${warnings.length}):</b>\n`;
      warnings.slice(0, 5).forEach((i) => {
        msg += `• <code>${i.url}</code>: ${i.issue}\n`;
      });
    }

    if (infos.length > 0) {
      msg += `\n💡 <b>Info (${infos.length}):</b>\n`;
      infos.slice(0, 3).forEach((i) => {
        msg += `• <code>${i.url}</code>: ${i.issue}\n`;
      });
    }
  }

  msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🔗 <a href="${dashboardUrl}">ดู Dashboard</a>`;
  return msg;
}
