/**
 * NCR Virtual CIO V4.0 — Gemini AI Intelligence Modules
 * Uses gemini-2.0-flash via REST API
 *
 * V4.1 addition: Quota Guard
 * All Gemini calls go through callGemini() which:
 *  - Checks the DB cooldown before calling the API
 *  - On 429: sets a 60-min cooldown + sends ONE Telegram warning
 *  - On success after cooldown: resets the warning flag
 */

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent";

// Cooldown keys stored in the alert_cooldown table
export const QUOTA_COOLDOWN_KEY = "gemini_quota_exhausted";
export const QUOTA_WARNING_KEY = "gemini_quota_warning_sent";
export const QUOTA_COOLDOWN_MINUTES = 60;

// ============================================================
// Core Gemini helper (raw — no guard, exported for tests)
// ============================================================
export async function callGeminiRaw(
  prompt: string,
  temperature = 0.7
): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");

  const r = await fetch(`${GEMINI_API_URL}?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature, maxOutputTokens: 1024 },
    }),
    signal: AbortSignal.timeout(20000),
  });

  const data = (await r.json()) as any;
  if (!r.ok) {
    const httpStatus = r.status;
    const msg = data?.error?.message ?? `HTTP ${httpStatus}`;
    const err = new Error(`Gemini API error: ${msg}`) as any;
    err.status = httpStatus;
    throw err;
  }
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

// ============================================================
// Quota Guard — wraps callGeminiRaw with 429 cooldown logic.
// State is persisted in DB via setCooldown / isInCooldown.
// On 429: locks for 60 min, sends ONE Telegram warning.
// On success after cooldown: resets warning flag.
// ============================================================
export async function callGemini(
  prompt: string,
  temperature = 0.7,
  fallback = ""
): Promise<string> {
  // Lazy-import DB helpers to avoid circular deps at module load time
  const { isInCooldown, setCooldown } = await import("./db");

  // If quota is exhausted, skip the API call and return fallback
  const inCooldown = await isInCooldown(QUOTA_COOLDOWN_KEY);
  if (inCooldown) {
    console.log("[gemini] Quota Guard active — skipping AI call to save credits.");
    return fallback;
  }

  try {
    const result = await callGeminiRaw(prompt, temperature);
    // Success: reset the warning-sent flag so next 429 fires a fresh warning
    await setCooldown(QUOTA_WARNING_KEY, 0);
    return result;
  } catch (err: any) {
    if (err.status === 429) {
      // Lock Gemini calls for 60 minutes
      await setCooldown(QUOTA_COOLDOWN_KEY, QUOTA_COOLDOWN_MINUTES);

      // Send ONE Telegram warning (guarded by warning_sent cooldown)
      const warningSent = await isInCooldown(QUOTA_WARNING_KEY);
      if (!warningSent) {
        try {
          const { sendTelegramMessage } = await import("./telegram");
          await sendTelegramMessage(
            "🚨 <b>[Manager Warning] โควตา AI (Gemini) เต็มชั่วคราวครับท่าน บก.</b>\n" +
            "ระบบจะเข้าสู่โหมด 'ประหยัดพลังงาน' 60 นาที โดยจะส่งเฉพาะรายงานตัวเลขดิบ (Text Only) " +
            "เพื่อไม่ให้ระบบ Ghost และจะกลับมาใช้ AI ปกติในอีก 1 ชม. ครับ"
          );
          // Set warning_sent cooldown for 60 min to prevent duplicate warnings
          await setCooldown(QUOTA_WARNING_KEY, QUOTA_COOLDOWN_MINUTES);
        } catch (tgErr) {
          console.warn("[gemini] Failed to send quota warning to Telegram:", tgErr);
        }
      }

      console.warn("[gemini] 429 Quota exceeded — entering 60-min cooldown.");
      return fallback;
    }
    // Re-throw non-quota errors
    throw err;
  }
}

// ============================================================
// Module 1: Viral Post Generator (AIDA Framework)
// ============================================================
export interface ViralCaptionResult {
  caption: string;
  postUrl: string;
  postTitle: string;
}

export async function generateViralCaption(
  postTitle: string,
  postExcerpt: string,
  postUrl: string
): Promise<ViralCaptionResult> {
  const prompt = `คุณเป็น Social Media Manager มืออาชีพของสำนักข่าว "นครเชียงรายนิวส์"

บทความ: "${postTitle}"
สรุปย่อ: "${postExcerpt.substring(0, 400)}"
ลิงก์: ${postUrl}

สร้าง Facebook Caption ภาษาไทยโดยใช้ AIDA Framework:
- Attention: ประโยคเปิดที่ดึงดูดความสนใจ (ใช้คำถามหรือข้อเท็จจริงที่น่าตกใจ)
- Interest: อธิบายสาระสำคัญของข่าว 2-3 ประโยค
- Desire: เหตุผลที่ผู้อ่านควรสนใจ
- Action: CTA ให้คลิกอ่านต่อ

ข้อกำหนด:
- ความยาวรวม 100-150 คำ
- ใช้ emoji 2-3 ตัวที่เหมาะสม
- ลงท้ายด้วย "อ่านต่อ: ${postUrl}"
- ห้ามใช้ clickbait หรือข้อมูลเกินจริง
- ตอบเฉพาะ caption เท่านั้น ไม่ต้องอธิบายเพิ่มเติม`;

  const caption = await callGemini(prompt, 0.8, "[ไม่สามารถสร้าง Caption ได้ในขณะนี้ — โควตา AI เต็ม]");
  return { caption: caption.trim(), postUrl, postTitle };
}

// ============================================================
// Module 2: Public Mood Scanner (Weekly Sentiment Analysis)
// ============================================================
export interface MoodScanResult {
  overallSentiment: "positive" | "neutral" | "negative" | "mixed";
  positivePercent: number;
  negativePercent: number;
  neutralPercent: number;
  emergingTopics: string[];
  dramaAlert: boolean;
  summary: string;
}

export async function analyzePublicMood(
  comments: Array<{ message: string; likeCount: number }>
): Promise<MoodScanResult> {
  if (comments.length === 0) {
    return {
      overallSentiment: "neutral",
      positivePercent: 0,
      negativePercent: 0,
      neutralPercent: 100,
      emergingTopics: [],
      dramaAlert: false,
      summary: "ไม่มีความคิดเห็นในช่วงนี้",
    };
  }

  const commentSample = comments
    .slice(0, 50)
    .map((c, i) => `${i + 1}. "${c.message.substring(0, 100)}"`)
    .join("\n");

  const prompt = `วิเคราะห์ sentiment ของความคิดเห็นบน Facebook Page "นครเชียงรายนิวส์" จำนวน ${comments.length} ความคิดเห็น (ตัวอย่าง 50 ความคิดเห็น):

${commentSample}

ตอบในรูปแบบ JSON เท่านั้น (ไม่มี markdown):
{
  "overallSentiment": "positive|neutral|negative|mixed",
  "positivePercent": <0-100>,
  "negativePercent": <0-100>,
  "neutralPercent": <0-100>,
  "emergingTopics": ["หัวข้อ1", "หัวข้อ2", "หัวข้อ3"],
  "dramaAlert": <true|false>,
  "summary": "สรุปภาษาไทย 2-3 ประโยค"
}`;

  const raw = await callGemini(prompt, 0.3, "");
  if (!raw) {
    // Quota guard returned fallback — return neutral result
    return {
      overallSentiment: "neutral",
      positivePercent: 0,
      negativePercent: 0,
      neutralPercent: 100,
      emergingTopics: [],
      dramaAlert: false,
      summary: "ไม่สามารถวิเคราะห์ได้ในขณะนี้ — โควตา AI เต็ม",
    };
  }
  try {
    // Strip markdown code blocks if present
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned) as MoodScanResult;
  } catch {
    return {
      overallSentiment: "neutral",
      positivePercent: 33,
      negativePercent: 33,
      neutralPercent: 34,
      emergingTopics: [],
      dramaAlert: false,
      summary: raw.substring(0, 200),
    };
  }
}

export function buildMoodScanReport(result: MoodScanResult, commentCount: number): string {
  const sentimentEmoji =
    result.overallSentiment === "positive" ? "😊" :
    result.overallSentiment === "negative" ? "😠" :
    result.overallSentiment === "mixed" ? "🤔" : "😐";

  const dramaLine = result.dramaAlert
    ? "\n⚠️ <b>ตรวจพบดราม่าที่กำลังเกิดขึ้น!</b> กรุณาตรวจสอบด่วน"
    : "";

  const topics = result.emergingTopics.length > 0
    ? `\n📌 <b>หัวข้อที่กำลังมา:</b> ${result.emergingTopics.join(", ")}`
    : "";

  return `🎭 <b>[NCR] Public Mood Scanner รายสัปดาห์</b>

${sentimentEmoji} <b>Sentiment รวม:</b> ${result.overallSentiment.toUpperCase()}
📊 <b>สัดส่วน:</b> 😊 ${result.positivePercent}% | 😐 ${result.neutralPercent}% | 😠 ${result.negativePercent}%
💬 <b>ความคิดเห็นที่วิเคราะห์:</b> ${commentCount} ความคิดเห็น${topics}${dramaLine}

📝 <b>สรุป:</b>
${result.summary}`;
}

// ============================================================
// Module 3: Crisis Draft Assistant
// ============================================================
export interface CrisisDraftResult {
  draftResponse: string;
  riskLevel: "high" | "critical";
  recommendedAction: string;
}

export async function draftCrisisResponse(
  comment: string,
  postTitle: string
): Promise<CrisisDraftResult> {
  const prompt = `คุณเป็นที่ปรึกษาด้านการสื่อสารวิกฤตของสำนักข่าว "นครเชียงรายนิวส์"

บทความที่เกี่ยวข้อง: "${postTitle}"
ความคิดเห็นที่มีความเสี่ยงสูง: "${comment}"

ร่างคำตอบมืออาชีพสำหรับ บก. พิจารณา โดย:
1. ยอมรับความกังวลของผู้อ่านด้วยความเคารพ
2. ให้ข้อมูลที่ถูกต้องตามหลักจริยธรรมสื่อ
3. ไม่ตอบโต้หรือเพิ่มความขัดแย้ง
4. ความยาวไม่เกิน 3 ประโยค

ตอบในรูปแบบ JSON (ไม่มี markdown):
{
  "draftResponse": "คำตอบร่างภาษาไทย",
  "riskLevel": "high|critical",
  "recommendedAction": "คำแนะนำสั้นๆ สำหรับ บก."
}`;

  const raw = await callGemini(prompt, 0.4, "");
  if (!raw) {
    return {
      draftResponse: "[ไม่สามารถร่างคำตอบได้ในขณะนี้ — โควตา AI เต็ม กรุณาร่างด้วยตนเอง]",
      riskLevel: "high",
      recommendedAction: "โควตา AI เต็ม — กรุณาตรวจสอบและร่างคำตอบด้วยตนเอง",
    };
  }
  try {
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned) as CrisisDraftResult;
  } catch {
    return {
      draftResponse: raw.substring(0, 300),
      riskLevel: "high",
      recommendedAction: "กรุณาตรวจสอบและปรับแก้ก่อนตอบ",
    };
  }
}

export function buildCrisisDraftAlert(
  comment: string,
  postTitle: string,
  draft: CrisisDraftResult
): string {
  const riskEmoji = draft.riskLevel === "critical" ? "🚨" : "⚠️";
  return `${riskEmoji} <b>[NCR Crisis Assistant] ต้องการการพิจารณา</b>

📰 <b>บทความ:</b> ${postTitle}
💬 <b>Comment เสี่ยง:</b>
"${comment.substring(0, 200)}"

✍️ <b>ร่างคำตอบ (AI Draft):</b>
<i>${draft.draftResponse}</i>

📋 <b>คำแนะนำ:</b> ${draft.recommendedAction}

⚡ <b>กรุณาอนุมัติหรือแก้ไขก่อนตอบ</b>`;
}

// ============================================================
// Module 4: Gemini-powered Fact-Based Reply (upgrade for Ethical Responder)
// ============================================================
export async function generateFactBasedReply(
  comment: string,
  articleTitle: string,
  articleContent: string
): Promise<string | null> {
  const prompt = `คุณเป็นผู้ช่วยตอบความคิดเห็นของสำนักข่าว "นครเชียงรายนิวส์"

บทความ: "${articleTitle}"
เนื้อหาบทความ (ย่อ): "${articleContent.substring(0, 600)}"
ความคิดเห็นที่ถามข้อมูล: "${comment}"

ตอบคำถามโดยอิงข้อเท็จจริงจากบทความเท่านั้น:
- ถ้าบทความมีข้อมูลที่ตอบได้ → ตอบสั้นๆ 1-2 ประโยค ภาษาไทย สุภาพ
- ถ้าบทความไม่มีข้อมูลเพียงพอ → ตอบว่า "SKIP" เท่านั้น

ห้ามเดาหรือเพิ่มข้อมูลที่ไม่มีในบทความ`;

  const reply = await callGemini(prompt, 0.3, "SKIP");
  const trimmed = reply.trim();
  if (trimmed === "SKIP" || trimmed.toUpperCase().includes("SKIP")) return null;
  return trimmed;
}
