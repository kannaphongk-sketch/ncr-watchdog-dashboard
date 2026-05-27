/**
 * NCR Watchdog Debug: Force-scan recent comments and log classification decisions
 * Mirrors runEthicalResponder() logic with verbose output
 */

const FB_API_BASE = "https://graph.facebook.com/v19.0";
const token = process.env.FB_PAGE_ACCESS_TOKEN;
const pageId = process.env.FB_PAGE_ID;

// ── Toxic keywords (mirrors facebook.ts) ─────────────────────────────────────
const TOXIC_KEYWORDS = [
  "หยาบคาย", "สแปมพนัน", "ดราม่าผิดกฎหมาย",
  "ไอ้สัตว์", "มึง", "อีสัตว์", "ไอ้บ้า", "อีบ้า",
  "พนัน", "บาคาร่า", "สล็อต", "ยาเสพติด",
  "คลิกลิงก์", "กดลิงก์", "รับเงิน", "ทำเงิน",
  "click here", "free money", "earn fast", "casino",
];

// ── Sensitive keywords (mirrors facebook.ts) ─────────────────────────────────
const SENSITIVE_KEYWORDS = [
  "ม.112", "หมิ่นประมาท", "ฟ้องร้อง", "ดำเนินคดี",
  "ข่าวปลอม", "เท็จ", "โกหก", "แก้ไขข่าว",
  "ขอโทษ", "ชดเชย", "เรียกร้อง",
  "ยุยงปลุกปั่น", "ความมั่นคง", "กษัตริย์",
];

// ── Info-request keywords ─────────────────────────────────────────────────────
const INFO_KEYWORDS = [
  "ทำไม", "อย่างไร", "เมื่อไร", "ที่ไหน", "ใคร", "อะไร",
  "ขอข้อมูล", "รายละเอียด", "อธิบาย", "ช่วยบอก",
  "why", "how", "when", "where", "what", "who",
];

// ── Appreciation keywords ─────────────────────────────────────────────────────
const APPRECIATION_KEYWORDS = [
  "ขอบคุณ", "ดีมาก", "เยี่ยม", "ยอดเยี่ยม", "ชอบ", "สุดยอด",
  "👍", "❤️", "🙏", "😊", "👏",
  "thank", "great", "excellent", "good job",
];

function isToxic(msg) {
  const lower = msg.toLowerCase();
  return TOXIC_KEYWORDS.some(k => lower.includes(k.toLowerCase()));
}

function isRisky(msg) {
  const lower = msg.toLowerCase();
  return SENSITIVE_KEYWORDS.some(k => lower.includes(k.toLowerCase()));
}

function classify(msg) {
  if (isToxic(msg)) return { scenario: "spam", reason: "toxic/spam keyword matched" };
  if (isRisky(msg)) return { scenario: "sensitive", reason: "sensitive keyword matched" };
  const lower = msg.toLowerCase();
  const hasInfo = INFO_KEYWORDS.some(k => lower.includes(k.toLowerCase()));
  const hasAppreciation = APPRECIATION_KEYWORDS.some(k => lower.includes(k.toLowerCase()));
  if (hasAppreciation && !hasInfo) return { scenario: "appreciation", reason: "appreciation keyword matched" };
  if (hasInfo && !hasAppreciation) return { scenario: "info_request", reason: "info-request keyword matched" };
  return { scenario: "ambiguous", reason: "no clear keyword match — Safety Valve: skip" };
}

async function fetchPosts(limit = 5) {
  const url = `${FB_API_BASE}/${pageId}/posts?fields=id,message,permalink_url,created_time&limit=${limit}&access_token=${token}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
  const data = await r.json();
  if (data.error) throw new Error(`FB Posts API: ${JSON.stringify(data.error)}`);
  return data.data || [];
}

async function fetchComments(postId, limit = 20) {
  const url = `${FB_API_BASE}/${postId}/comments?fields=id,message,from,created_time&limit=${limit}&access_token=${token}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
  const data = await r.json();
  if (data.error) throw new Error(`FB Comments API: ${JSON.stringify(data.error)}`);
  return data.data || [];
}

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  NCR Watchdog — Ethical Responder Debug Scan");
  console.log("═══════════════════════════════════════════════════════\n");

  if (!token || !pageId) {
    console.error("❌ FATAL: FB_PAGE_ACCESS_TOKEN or FB_PAGE_ID not set");
    process.exit(1);
  }
  console.log(`✅ FB credentials loaded (Page ID: ${pageId})\n`);

  // Step 1: Fetch recent posts
  console.log("── Step 1: Fetching recent posts ──────────────────────");
  let posts;
  try {
    posts = await fetchPosts(5);
    console.log(`   Found ${posts.length} posts\n`);
  } catch (err) {
    console.error(`❌ FB Posts fetch failed: ${err.message}`);
    process.exit(1);
  }

  if (!posts.length) {
    console.log("⚠️  No posts returned from FB API. Possible causes:");
    console.log("   - Page token lacks pages_read_engagement permission");
    console.log("   - Page has no recent posts");
    process.exit(0);
  }

  // Step 2: Scan comments on each post
  let totalChecked = 0;
  const decisionLog = [];

  for (const post of posts) {
    const postPreview = (post.message || "(no text)").substring(0, 60);
    console.log(`── Post: ${post.id}`);
    console.log(`   Preview: ${postPreview}`);
    console.log(`   URL: ${post.permalink_url || "(no permalink)"}`);

    let comments;
    try {
      comments = await fetchComments(post.id, 20);
    } catch (err) {
      console.log(`   ❌ Comments fetch failed: ${err.message}`);
      console.log(`   Possible causes: token lacks pages_read_engagement or user_posts permission\n`);
      decisionLog.push({ postId: post.id, error: err.message });
      continue;
    }

    if (!comments.length) {
      console.log(`   ℹ️  No comments on this post\n`);
      continue;
    }

    console.log(`   Found ${comments.length} comments:`);
    for (const c of comments) {
      totalChecked++;
      const { scenario, reason } = classify(c.message || "");
      const emoji = {
        appreciation: "👍",
        info_request: "❓",
        sensitive: "⚠️",
        spam: "🚫",
        ambiguous: "⏭️",
      }[scenario] || "❓";

      console.log(`   ${emoji} [${scenario.toUpperCase()}] "${(c.message || "").substring(0, 70)}"`);
      console.log(`       Reason: ${reason}`);
      console.log(`       Comment ID: ${c.id}`);

      decisionLog.push({
        postId: post.id,
        commentId: c.id,
        message: (c.message || "").substring(0, 100),
        scenario,
        reason,
        action: scenario === "appreciation" ? "like + template reply"
               : scenario === "info_request" ? "Gemini fact-based reply (V4.0)"
               : scenario === "sensitive" ? "Gemini crisis draft → Telegram (no auto-reply)"
               : scenario === "spam" ? "hide comment"
               : "skip (Safety Valve)",
      });
    }
    console.log();
  }

  // Step 3: Summary
  console.log("═══════════════════════════════════════════════════════");
  console.log("  DECISION LOG SUMMARY");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`Total comments scanned: ${totalChecked}`);

  const counts = { appreciation: 0, info_request: 0, sensitive: 0, spam: 0, ambiguous: 0 };
  for (const d of decisionLog) {
    if (d.scenario) counts[d.scenario] = (counts[d.scenario] || 0) + 1;
  }

  console.log(`  👍 appreciation  → like + reply:           ${counts.appreciation}`);
  console.log(`  ❓ info_request  → Gemini fact reply:       ${counts.info_request}`);
  console.log(`  ⚠️  sensitive     → crisis draft (Telegram): ${counts.sensitive}`);
  console.log(`  🚫 spam          → hide:                    ${counts.spam}`);
  console.log(`  ⏭️  ambiguous     → skip (Safety Valve):     ${counts.ambiguous}`);

  // Step 4: Diagnose why comments might not be getting replied to
  console.log("\n── Diagnosis: Why might replies be missing? ───────────");

  const skippedCount = counts.ambiguous + counts.sensitive;
  const totalReplied = counts.appreciation + counts.info_request;

  if (totalChecked === 0) {
    console.log("⚠️  No comments were fetched. Check:");
    console.log("   1. FB_PAGE_ACCESS_TOKEN has pages_read_engagement permission");
    console.log("   2. FB_PAGE_ID is correct");
    console.log("   3. Token has not expired (Page tokens expire after ~60 days)");
  } else {
    if (counts.ambiguous > 0) {
      console.log(`⏭️  ${counts.ambiguous} comment(s) classified as AMBIGUOUS → Safety Valve skips them.`);
      console.log("   This is intentional — the system does not reply to unclear comments.");
    }
    if (counts.sensitive > 0) {
      console.log(`⚠️  ${counts.sensitive} comment(s) classified as SENSITIVE → flagged to Telegram, NO auto-reply.`);
      console.log("   This is intentional — human review required.");
    }
    if (counts.spam > 0) {
      console.log(`🚫 ${counts.spam} comment(s) classified as SPAM → hidden, no reply.`);
    }
    if (totalReplied === 0 && totalChecked > 0) {
      console.log("\n🔍 FINDING: No comments qualify for auto-reply in this scan.");
      console.log("   All comments fall into ambiguous/sensitive/spam categories.");
      console.log("   The Ethical Responder is working correctly — Safety Valve is active.");
    }
    if (counts.info_request > 0) {
      console.log(`\n❓ ${counts.info_request} info_request comment(s) will use Gemini V4.0 fact-based reply.`);
      console.log("   Note: Gemini replies require GEMINI_API_KEY and WP article to be fetchable.");
      console.log(`   GEMINI_API_KEY set: ${process.env.GEMINI_API_KEY ? "YES" : "NO ← THIS WILL CAUSE SKIP"}`);
    }
    if (counts.appreciation > 0) {
      console.log(`\n👍 ${counts.appreciation} appreciation comment(s) will receive like + template reply.`);
      console.log("   Note: Requires pages_manage_engagement permission on the token.");
    }
  }

  // Step 5: Token permission check
  console.log("\n── Token Permission Check ─────────────────────────────");
  try {
    const debugUrl = `https://graph.facebook.com/v19.0/debug_token?input_token=${token}&access_token=${token}`;
    const r = await fetch(debugUrl, { signal: AbortSignal.timeout(8000) });
    const d = await r.json();
    if (d.data) {
      const td = d.data;
      console.log(`   Token type: ${td.type}`);
      console.log(`   App ID: ${td.app_id}`);
      console.log(`   Valid: ${td.is_valid}`);
      console.log(`   Expires: ${td.expires_at ? new Date(td.expires_at * 1000).toISOString() : "never (page token)"}`);
      const scopes = td.scopes || [];
      console.log(`   Scopes: ${scopes.join(", ") || "(none returned)"}`);
      const required = ["pages_read_engagement", "pages_manage_engagement", "pages_manage_comments"];
      for (const s of required) {
        const has = scopes.includes(s);
        console.log(`   ${has ? "✅" : "❌"} ${s}`);
      }
    } else if (d.error) {
      console.log(`   ❌ Token debug failed: ${JSON.stringify(d.error)}`);
    }
  } catch (err) {
    console.log(`   ❌ Token debug request failed: ${err.message}`);
  }

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  Debug scan complete.");
  console.log("═══════════════════════════════════════════════════════");
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
