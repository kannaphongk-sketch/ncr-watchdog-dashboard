import { runGoogleIndexMonitor } from "../../server/googleIndexing";
import { sendTelegramMessage, buildGoogleIndexingReport } from "../../server/telegram";

export default async () => {
  try {
    const result = await runGoogleIndexMonitor();
    const hasAttentionItems = result.results.some((item) => item.verdict !== "indexed");

    if (result.skipped || hasAttentionItems) {
      await sendTelegramMessage(buildGoogleIndexingReport(result));
    }

    return Response.json({
      ok: true,
      skipped: result.skipped,
      checked: result.results.length,
      attention: result.results.filter((item) => item.verdict !== "indexed").length,
    });
  } catch (err) {
    const message = (err as Error).message;
    await sendTelegramMessage(`🔎 <b>NCR Google Index Monitor</b>\n━━━━━━━━━━━━━━━━━━━━━━\nFailed: <code>${message}</code>`);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
};
