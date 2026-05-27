/**
 * NCR Watchdog V3.2 — Facebook/Meta Integration
 *
 * 1. Ethics Comment Moderation — auto-hide toxic/spam comments
 * 2. Viral Scout — alert when post engagement > 5% of reach
 * 3. Ad Governance — daily spend vs results report + CPC alert
 * 4. Ethical Responder V4.0 — Gemini-powered fact-based replies + crisis drafts
 */
import {
  generateFactBasedReply,
  draftCrisisResponse,
  buildCrisisDraftAlert,
} from "./gemini";
import { sendTelegramMessage } from "./telegram";

const FB_API_BASE = "https://graph.facebook.com/v19.0";
const PAGE_ID = process.env.FB_PAGE_ID ?? "";
const PAGE_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN ?? "";
const AD_ACCOUNT_ID = process.env.FB_AD_ACCOUNT_ID ?? "";

// ─── Toxic keyword list (V3.2 policy) ────────────────────────────────────────
export const TOXIC_KEYWORDS: string[] = [
  // Thai profanity / spam / gambling
  "หยาบคาย", "สแปมพนัน", "ดราม่าผิดกฎหมาย",
  "ไอ้สัตว์", "มึง", "อีสัตว์", "ไอ้บ้า", "อีบ้า",
  "พนัน", "บาคาร่า", "สล็อต", "ยาเสพติด",
  "คลิกลิงก์", "กดลิงก์", "รับเงิน", "ทำเงิน",
  // English spam
  "click here", "free money", "earn fast", "casino",
];

// ─── Ethics: Comment Moderation ──────────────────────────────────────────────

export interface FBComment {
  id: string;
  message: string;
  from?: { id: string; name: string };
  created_time: string;
}

export interface FBPost {
  id: string;
  message?: string;
  created_time: string;
  permalink_url?: string;
}

export interface ModerationResult {
  checked: number;
  hidden: number;
  hiddenIds: string[];
  risky: number;
  riskyIds: string[];
}

/**
 * Checks if a comment message contains toxic/spam keywords.
 */
export function isToxicComment(message: string): boolean {
  const lower = message.toLowerCase();
  return TOXIC_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()));
}

/**
 * Checks if a comment is politically risky (requires human review).
 * Returns true for sensitive political / legal topics.
 */
export function isRiskyComment(message: string): boolean {
  const riskyTerms = [
    "ล้มเจ้า", "ปฏิวัติ", "รัฐประหาร", "ม.112",
    "overthrow", "coup", "sedition",
  ];
  const lower = message.toLowerCase();
  return riskyTerms.some(t => lower.includes(t.toLowerCase()));
}

/**
 * Fetch recent comments for a given post.
 */
export async function fetchPostComments(postId: string, limit = 50): Promise<FBComment[]> {
  const url = `${FB_API_BASE}/${postId}/comments?fields=id,message,from,created_time&limit=${limit}&access_token=${PAGE_TOKEN}`;
  const res = await fetch(url);
  const data = await res.json() as { data?: FBComment[]; error?: { message: string } };
  if (data.error) throw new Error(`FB comments error: ${data.error.message}`);
  return data.data ?? [];
}

/**
 * Hide a comment by ID (sets `is_hidden=true`).
 */
export async function hideComment(commentId: string): Promise<boolean> {
  const url = `${FB_API_BASE}/${commentId}?access_token=${PAGE_TOKEN}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_hidden: true }),
  });
  const data = await res.json() as { success?: boolean; error?: { message: string } };
  if (data.error) {
    console.error(`[FB] Failed to hide comment ${commentId}:`, data.error.message);
    return false;
  }
  return data.success === true;
}

/**
 * Fetch recent posts from the Page (last N posts).
 */
export async function fetchRecentPosts(limit = 10): Promise<FBPost[]> {
  const url = `${FB_API_BASE}/${PAGE_ID}/posts?fields=id,message,created_time,permalink_url&limit=${limit}&access_token=${PAGE_TOKEN}`;
  const res = await fetch(url);
  const data = await res.json() as { data?: FBPost[]; error?: { message: string } };
  if (data.error) throw new Error(`FB posts error: ${data.error.message}`);
  return data.data ?? [];
}

/**
 * Run Ethics Comment Moderation on recent posts.
 * - Hides toxic/spam comments immediately
 * - Flags risky comments for human review (returns riskyIds)
 */
export async function runCommentModeration(postsToCheck = 5): Promise<ModerationResult> {
  const result: ModerationResult = { checked: 0, hidden: 0, hiddenIds: [], risky: 0, riskyIds: [] };

  const posts = await fetchRecentPosts(postsToCheck);
  for (const post of posts) {
    const comments = await fetchPostComments(post.id, 50);
    for (const comment of comments) {
      result.checked++;
      if (isToxicComment(comment.message)) {
        const ok = await hideComment(comment.id);
        if (ok) {
          result.hidden++;
          result.hiddenIds.push(comment.id);
        }
      } else if (isRiskyComment(comment.message)) {
        result.risky++;
        result.riskyIds.push(comment.id);
      }
    }
  }
  return result;
}

// ─── Viral Scout ─────────────────────────────────────────────────────────────

export interface PostInsights {
  postId: string;
  message?: string;
  permalink?: string;
  reach: number;
  reactions: number;
  comments: number;
  shares: number;
  engagement: number;
  engagementRate: number; // percentage
}

/**
 * Fetch engagement insights for a single post.
 */
export async function fetchPostInsights(postId: string, permalink?: string): Promise<PostInsights | null> {
  try {
    const insightsUrl = `${FB_API_BASE}/${postId}/insights?metric=post_impressions_unique,post_reactions_by_type_total&access_token=${PAGE_TOKEN}`;
    const engUrl = `${FB_API_BASE}/${postId}?fields=reactions.summary(true),comments.summary(true),shares&access_token=${PAGE_TOKEN}`;

    const [insightsRes, engRes] = await Promise.all([
      fetch(insightsUrl).then(r => r.json()) as Promise<{ data?: Array<{ name: string; values: Array<{ value: number | Record<string, number> }> }>; error?: { message: string } }>,
      fetch(engUrl).then(r => r.json()) as Promise<{ reactions?: { summary: { total_count: number } }; comments?: { summary: { total_count: number } }; shares?: { count: number }; error?: { message: string } }>,
    ]);

    if (insightsRes.error || engRes.error) return null;

    const reachMetric = insightsRes.data?.find(m => m.name === "post_impressions_unique");
    const reach = (reachMetric?.values?.[0]?.value as number) ?? 0;

    const reactions = engRes.reactions?.summary?.total_count ?? 0;
    const comments = engRes.comments?.summary?.total_count ?? 0;
    const shares = engRes.shares?.count ?? 0;
    const engagement = reactions + comments + shares;
    const engagementRate = reach > 0 ? (engagement / reach) * 100 : 0;

    return { postId, permalink, reach, reactions, comments, shares, engagement, engagementRate };
  } catch {
    return null;
  }
}

export interface ViralPost {
  postId: string;
  message?: string;
  permalink?: string;
  engagementRate: number;
  reach: number;
  engagement: number;
}

/**
 * Scan recent posts for viral content (engagement rate > threshold).
 */
export async function runViralScout(threshold = 5, postsToCheck = 10): Promise<ViralPost[]> {
  const posts = await fetchRecentPosts(postsToCheck);
  const viral: ViralPost[] = [];

  for (const post of posts) {
    const insights = await fetchPostInsights(post.id, post.permalink_url);
    if (insights && insights.engagementRate >= threshold) {
      viral.push({
        postId: post.id,
        message: post.message?.substring(0, 100),
        permalink: post.permalink_url,
        engagementRate: Math.round(insights.engagementRate * 10) / 10,
        reach: insights.reach,
        engagement: insights.engagement,
      });
    }
  }
  return viral;
}

// ─── Ad Governance ───────────────────────────────────────────────────────────

export interface AdCampaignStats {
  campaignId: string;
  campaignName: string;
  spend: number;
  impressions: number;
  clicks: number;
  cpc: number;
  cpm: number;
  ctr: number;
}

export interface AdGovernanceReport {
  date: string;
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  avgCpc: number;
  campaigns: AdCampaignStats[];
  highCpcCampaigns: AdCampaignStats[];
}

/**
 * Fetch today's ad spend and performance from the Ad Account.
 */
export async function fetchAdReport(cpcThreshold = 5): Promise<AdGovernanceReport> {
  const today = new Date().toISOString().split("T")[0];
  const url = `${FB_API_BASE}/act_${AD_ACCOUNT_ID}/campaigns?fields=id,name,insights{spend,impressions,clicks,cpc,cpm,ctr}&time_range={"since":"${today}","until":"${today}"}&access_token=${PAGE_TOKEN}`;

  const res = await fetch(url);
  const data = await res.json() as {
    data?: Array<{
      id: string;
      name: string;
      insights?: { data?: Array<{ spend: string; impressions: string; clicks: string; cpc: string; cpm: string; ctr: string }> };
    }>;
    error?: { message: string };
  };

  if (data.error) throw new Error(`FB Ads error: ${data.error.message}`);

  const campaigns: AdCampaignStats[] = [];
  for (const campaign of data.data ?? []) {
    const ins = campaign.insights?.data?.[0];
    if (!ins) continue;
    campaigns.push({
      campaignId: campaign.id,
      campaignName: campaign.name,
      spend: parseFloat(ins.spend ?? "0"),
      impressions: parseInt(ins.impressions ?? "0"),
      clicks: parseInt(ins.clicks ?? "0"),
      cpc: parseFloat(ins.cpc ?? "0"),
      cpm: parseFloat(ins.cpm ?? "0"),
      ctr: parseFloat(ins.ctr ?? "0"),
    });
  }

  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  const totalImpressions = campaigns.reduce((s, c) => s + c.impressions, 0);
  const totalClicks = campaigns.reduce((s, c) => s + c.clicks, 0);
  const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
  const highCpcCampaigns = campaigns.filter(c => c.cpc > cpcThreshold);

  return { date: today, totalSpend, totalImpressions, totalClicks, avgCpc, campaigns, highCpcCampaigns };
}

// ─── Telegram message builders ────────────────────────────────────────────────

export function buildModerationReport(result: ModerationResult): string {
  let msg = `🛡️ <b>[NCR] Ethics Moderation Report</b>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `📋 Comments checked: <b>${result.checked}</b>\n`;
  msg += `🚫 Auto-hidden (toxic/spam): <b>${result.hidden}</b>\n`;
  msg += `⚠️ Flagged for review (risky): <b>${result.risky}</b>\n`;
  if (result.risky > 0) {
    msg += `\n🔍 <b>Risky comments need human review!</b>\n`;
    msg += `Please review in Facebook Page Manager.\n`;
  }
  msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🤖 Safety Lock: AI will NOT comment on sensitive topics.`;
  return msg;
}

export function buildViralAlert(posts: ViralPost[]): string {
  let msg = `🔥 <b>[NCR] Viral Scout Alert!</b>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `📈 ${posts.length} viral post(s) detected (Engagement > 5% of Reach)\n\n`;
  for (const post of posts) {
    msg += `🚀 <b>${post.engagementRate}% engagement rate</b>\n`;
    if (post.message) msg += `📝 "${post.message}..."\n`;
    msg += `👁️ Reach: <b>${post.reach.toLocaleString()}</b> | Engagement: <b>${post.engagement.toLocaleString()}</b>\n`;
    if (post.permalink) msg += `🔗 <a href="${post.permalink}">ดูโพสต์</a>\n`;
    msg += `\n`;
  }
  msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `⚡ Boost this post now to maximize reach!`;
  return msg;
}

export function buildAdGovernanceReport(report: AdGovernanceReport): string {
  let msg = `💰 <b>[NCR] Ad Governance Report</b>\n`;
  msg += `📅 ${report.date}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `💵 Total Spend: <b>฿${report.totalSpend.toFixed(2)}</b>\n`;
  msg += `👁️ Impressions: <b>${report.totalImpressions.toLocaleString()}</b>\n`;
  msg += `🖱️ Clicks: <b>${report.totalClicks.toLocaleString()}</b>\n`;
  msg += `📊 Avg CPC: <b>฿${report.avgCpc.toFixed(2)}</b>\n`;
  if (report.campaigns.length > 0) {
    msg += `\n📋 <b>Campaigns (${report.campaigns.length}):</b>\n`;
    for (const c of report.campaigns.slice(0, 5)) {
      msg += `• ${c.campaignName}: ฿${c.spend.toFixed(2)} | CPC ฿${c.cpc.toFixed(2)} | CTR ${c.ctr.toFixed(2)}%\n`;
    }
  }
  if (report.highCpcCampaigns.length > 0) {
    msg += `\n🚨 <b>High CPC Alert!</b> ${report.highCpcCampaigns.length} campaign(s) above threshold:\n`;
    for (const c of report.highCpcCampaigns) {
      msg += `⚠️ ${c.campaignName}: CPC <b>฿${c.cpc.toFixed(2)}</b>\n`;
    }
  }
  msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🛡️ NCR Ad Governance Active`;
  return msg;
}

// ─── V3.3: Ethical Responder ─────────────────────────────────────────────────

// Trigger keywords for each scenario
export const APPRECIATION_TRIGGERS = [
  "ขอบคุณ", "ติดตาม", "ข่าวดี", "เยี่ยม", "สุดยอด", "ดีมาก", "เก่งมาก",
  "👍", "❤️", "🙏", "😊", "🔥", "👏", "ชอบ", "แชร์", "เด็ด",
];

export const INFO_REQUEST_TRIGGERS = [
  "ที่ไหน", "เมื่อไหร่", "อย่างไร", "ขอรายละเอียด", "ข้อมูลเพิ่มเติม",
  "ติดต่อ", "สอบถาม", "รายละเอียด", "เวลา", "สถานที่", "ราคา", "how", "where", "when",
];

export const SENSITIVE_TRIGGERS = [
  "การเมืองรุนแรง", "ล้มเจ้า", "ปฏิวัติ", "รัฐประหาร", "ม.112",
  "ด่า", "욕", "ประเด็นเปราะบาง", "fake news", "ข่าวปลอม",
  "ดราม่า", "โจมตี", "ใส่ร้าย", "overthrow", "coup", "sedition",
];

export const REPLY_TEMPLATES = [
  "ขอบคุณที่ติดตามนครเชียงรายนิวส์ครับ/ค่ะ 🙏",
  "ขอบคุณสำหรับกำลังใจและคำแนะนำครับ 😊",
  "ขอบคุณที่ร่วมติดตามข่าวสารกับเราครับ ❤️",
  "ยินดีที่ได้รับใช้ผู้อ่านทุกท่านครับ 🙏",
  "ขอบคุณมากครับ ติดตามข่าวสารดีๆ จากเราได้ตลอดนะครับ 📰",
];

export type CommentScenario =
  | "appreciation"
  | "info_request"
  | "sensitive"
  | "spam"
  | "ambiguous";

/**
 * Classify a comment into one of the 5 ethical scenarios.
 * Safety Valve: ambiguous = no action.
 */
export function classifyComment(message: string): CommentScenario {
  // Priority 1: spam/toxic (already handled in V3.2 but keep consistent)
  if (isToxicComment(message)) return "spam";

  // Priority 2: sensitive (safety lock — must check before appreciation)
  if (SENSITIVE_TRIGGERS.some(t => message.toLowerCase().includes(t.toLowerCase()))) {
    return "sensitive";
  }

  // Priority 3: appreciation
  const hasAppreciation = APPRECIATION_TRIGGERS.some(t =>
    message.toLowerCase().includes(t.toLowerCase())
  );
  if (hasAppreciation) return "appreciation";

  // Priority 4: information request
  const hasInfoRequest = INFO_REQUEST_TRIGGERS.some(t =>
    message.toLowerCase().includes(t.toLowerCase())
  );
  if (hasInfoRequest) return "info_request";

  // Default: ambiguous — Safety Valve says do nothing
  return "ambiguous";
}

/**
 * Pick a random reply template.
 */
export function pickReplyTemplate(): string {
  return REPLY_TEMPLATES[Math.floor(Math.random() * REPLY_TEMPLATES.length)];
}

/**
 * Like a comment (create a reaction).
 */
export async function likeComment(commentId: string): Promise<boolean> {
  const url = `${FB_API_BASE}/${commentId}/likes?access_token=${PAGE_TOKEN}`;
  const res = await fetch(url, { method: "POST" });
  const data = await res.json() as { success?: boolean; error?: { message: string } };
  if (data.error) {
    console.error(`[FB] Failed to like comment ${commentId}:`, data.error.message);
    return false;
  }
  return data.success === true;
}

/**
 * Reply to a comment with a given message.
 */
export async function replyToComment(commentId: string, message: string): Promise<boolean> {
  const url = `${FB_API_BASE}/${commentId}/comments?access_token=${PAGE_TOKEN}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  const data = await res.json() as { id?: string; error?: { message: string } };
  if (data.error) {
    console.error(`[FB] Failed to reply to comment ${commentId}:`, data.error.message);
    return false;
  }
  return !!data.id;
}

export interface EthicalResponderResult {
  checked: number;
  liked: number;
  replied: number;
  flagged: number;   // sensitive → sent to Telegram for human review
  hidden: number;    // spam → hidden
  skipped: number;   // ambiguous → no action
}

/**
 * Run the V3.3 Ethical Responder on recent posts.
 * Returns a summary of actions taken.
 */
export async function runEthicalResponder(
  postsToCheck = 5,
  onSensitiveFlag?: (commentId: string, message: string) => Promise<void>
): Promise<EthicalResponderResult> {
  const result: EthicalResponderResult = {
    checked: 0, liked: 0, replied: 0, flagged: 0, hidden: 0, skipped: 0,
  };
  const posts = await fetchRecentPosts(postsToCheck);
  for (const post of posts) {
    const comments = await fetchPostComments(post.id, 50);
    for (const comment of comments) {
      result.checked++;
      const scenario = classifyComment(comment.message);
      switch (scenario) {
        case "appreciation":
          // Like + random template reply
          await likeComment(comment.id);
          result.liked++;
          const template = pickReplyTemplate();
          const replied = await replyToComment(comment.id, template);
          if (replied) result.replied++;
          break;
        case "info_request": {
          // V4.0: Gemini Fact-Based Reply — fetch WP article and ask Gemini
          const postUrl = post.permalink_url ?? "";
          if (postUrl) {
            try {
              const wpPost = await fetchWPPostByUrl(postUrl);
              if (wpPost) {
                const articleText = stripHtml(wpPost.content.rendered);
                const geminiReply = await generateFactBasedReply(
                  comment.message,
                  wpPost.title.rendered,
                  articleText
                );
                if (geminiReply) {
                  const factReplied = await replyToComment(comment.id, geminiReply);
                  if (factReplied) {
                    result.replied++;
                    break;
                  }
                }
              }
            } catch (err) {
              console.error("[V4.0] Gemini fact reply error:", err);
            }
          }
          // Fallback: skip if no article or no fact found
          result.skipped++;
          break;
        }

        case "sensitive": {
          // V4.0: Crisis Draft Assistant — generate AI draft + send to Telegram
          result.flagged++;
          const postTitle = post.message?.substring(0, 80) ?? "(ไม่ระบุหัวข้อ)";
          try {
            const draft = await draftCrisisResponse(comment.message, postTitle);
            const crisisAlert = buildCrisisDraftAlert(comment.message, postTitle, draft);
            await sendTelegramMessage(crisisAlert);
          } catch (err) {
            console.error("[V4.0] Crisis draft error:", err);
            // Fallback: use legacy onSensitiveFlag callback
            if (onSensitiveFlag) {
              await onSensitiveFlag(comment.id, comment.message);
            }
          }
          break;
        }

        case "spam":
          // Hide immediately (extends V3.2)
          await hideComment(comment.id);
          result.hidden++;
          break;

        case "ambiguous":
        default:
          // Safety Valve: do nothing
          result.skipped++;
          break;
      }
    }
  }

  return result;
}

export function buildEthicalResponderReport(result: EthicalResponderResult): string {
  let msg = `🤖 <b>[NCR] Ethical Responder V3.3</b>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `📋 Comments checked: <b>${result.checked}</b>\n`;
  msg += `👍 Auto-liked: <b>${result.liked}</b>\n`;
  msg += `💬 Auto-replied: <b>${result.replied}</b>\n`;
  msg += `🚫 Spam hidden: <b>${result.hidden}</b>\n`;
  msg += `⚠️ Flagged for review: <b>${result.flagged}</b>\n`;
  msg += `⏭️ Skipped (ambiguous): <b>${result.skipped}</b>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🔒 Safety Lock: AI ไม่ตอบประเด็นเปราะบาง`;
  return msg;
}

export function buildSensitiveFlagAlert(commentId: string, message: string): string {
  const preview = message.length > 100 ? message.substring(0, 100) + "..." : message;
  return `⚠️ <b>[NCR] Sensitive Comment — Human Review Required</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🔍 Comment ID: <code>${commentId}</code>\n` +
    `💬 Content: "${preview}"\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🛡️ AI has NOT responded. บก. กรุณาตัดสินใจครับ`;
}

// ─── V3.4: Article Fact Extraction ───────────────────────────────────────────

const WP_API_BASE = "https://nakornchiangrainews.com/wp-json/wp/v2";

export interface WPPost {
  id: number;
  title: { rendered: string };
  content: { rendered: string };
  link: string;
  date: string;
}

/**
 * Fetch a WordPress post by its URL slug or full URL.
 * Returns null if not found.
 */
export async function fetchWPPostByUrl(postUrl: string): Promise<WPPost | null> {
  try {
    // Extract slug from URL: https://nakornchiangrainews.com/some-slug/
    const urlObj = new URL(postUrl);
    const slug = urlObj.pathname.replace(/^\/|\/$/g, "").split("/").pop() ?? "";
    if (!slug) return null;

    const res = await fetch(
      `${WP_API_BASE}/posts?slug=${encodeURIComponent(slug)}&_fields=id,title,content,link,date`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const posts = await res.json() as WPPost[];
    return posts.length > 0 ? posts[0] : null;
  } catch {
    return null;
  }
}

/**
 * Strip HTML tags and normalize whitespace from WP content.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Use LLM to extract a fact-based answer to a question from article content.
 * Returns null if the answer cannot be found in the article (Fact-Based Only rule).
 */
export async function extractFactFromArticle(
  articleTitle: string,
  articleContent: string,
  question: string
): Promise<string | null> {
  try {
    const { invokeLLM } = await import("./_core/llm");
    const contentPreview = articleContent.substring(0, 2000);

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `คุณเป็นผู้ช่วยตอบคำถามจากบทความข่าว นครเชียงรายนิวส์
กฎเหล็ก: ตอบได้เฉพาะข้อมูลที่มีอยู่ในบทความเท่านั้น ห้ามคาดเดาหรือเพิ่มเติมข้อมูลที่ไม่มีในบทความ
ถ้าไม่พบคำตอบในบทความ ให้ตอบว่า "NOT_FOUND" เท่านั้น
ตอบสั้นๆ ไม่เกิน 2 ประโยค ใช้ภาษาไทยที่สุภาพและเป็นกันเอง`,
        },
        {
          role: "user",
          content: `บทความ: "${articleTitle}"\n\nเนื้อหา: ${contentPreview}\n\nคำถาม: ${question}`,
        },
      ],
    });

    const answer = (response.choices?.[0]?.message?.content as string ?? "").trim();
    if (!answer || answer === "NOT_FOUND" || answer.includes("NOT_FOUND")) {
      return null;
    }
    return answer;
  } catch (err) {
    console.error("[V3.4] extractFactFromArticle error:", err);
    return null;
  }
}

/**
 * Build a fact-based reply message for a comment.
 */
export function buildFactReply(answer: string): string {
  return `${answer}\n\n(ข้อมูลจากบทความนครเชียงรายนิวส์ 📰)`;
}

export function buildFactNotFoundReply(): string {
  return "ขออภัยครับ ไม่พบข้อมูลที่ตรงกับคำถามในบทความนี้ สามารถอ่านรายละเอียดเพิ่มเติมได้ที่ลิงก์บทความครับ 🙏";
}

// ============================================================
// V4.0: getRecentPageComments — for Public Mood Scanner
// ============================================================
export async function getRecentPageComments(
  limit = 100
): Promise<Array<{ message: string; likeCount: number }>> {
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  const pageId = process.env.FB_PAGE_ID;
  if (!token || !pageId) return [];

  try {
    // Get recent posts
    const postsUrl = `https://graph.facebook.com/v19.0/${pageId}/posts?fields=id&limit=20&access_token=${token}`;
    const postsRes = await fetch(postsUrl, { signal: AbortSignal.timeout(8000) });
    if (!postsRes.ok) return [];
    const postsData = (await postsRes.json()) as any;
    const posts: any[] = postsData?.data ?? [];

    const allComments: Array<{ message: string; likeCount: number }> = [];
    for (const post of posts.slice(0, 10)) {
      if (allComments.length >= limit) break;
      const commentsUrl = `https://graph.facebook.com/v19.0/${post.id}/comments?fields=message,like_count&limit=20&access_token=${token}`;
      const commentsRes = await fetch(commentsUrl, { signal: AbortSignal.timeout(6000) });
      if (!commentsRes.ok) continue;
      const commentsData = (await commentsRes.json()) as any;
      const comments: any[] = commentsData?.data ?? [];
      for (const c of comments) {
        if (c.message) {
          allComments.push({ message: c.message, likeCount: c.like_count ?? 0 });
        }
      }
    }
    return allComments.slice(0, limit);
  } catch (err) {
    console.error("[FB] getRecentPageComments error:", err);
    return [];
  }
}
