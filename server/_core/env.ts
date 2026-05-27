const REQUIRED_TELEGRAM_IDS = ["8855631169", "8674647124", "8216202664"];
const EXACT_TELEGRAM_IDS = REQUIRED_TELEGRAM_IDS.join(",");

function firstNonEmptyEnv(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return "";
}

function normalizeTelegramIds(value?: string): string {
  const ids = new Set<string>();
  for (const requiredId of REQUIRED_TELEGRAM_IDS) ids.add(requiredId);
  for (const rawId of (value || "").split(",")) {
    const chatId = rawId.trim();
    if (chatId) ids.add(chatId);
  }
  return Array.from(ids).join(",");
}

export const ENV = {
  cfApiToken: firstNonEmptyEnv("CLOUDFLARE_API_TOKEN", "CF_API_TOKEN", "CLOUDFLARE_TOKEN"),
  cfZoneId: firstNonEmptyEnv("CLOUDFLARE_ZONE_ID", "CF_ZONE_ID"),
  tgBotToken: firstNonEmptyEnv(
    "TELEGRAM_BOT_TOKEN",
    "TG_BOT_TOKEN",
    "TELEGRAM_TOKEN",
    "TG_TOKEN",
    "BOT_TOKEN",
    "NCR_TELEGRAM_BOT_TOKEN",
    "NCR_WATCHDOG_TELEGRAM_BOT_TOKEN"
  ),
  tgChatId: normalizeTelegramIds(firstNonEmptyEnv("TELEGRAM_CHAT_IDS", "TELEGRAM_CHAT_ID", "TG_CHAT_IDS", "TG_CHAT_ID", "TELEGRAM_RECIPIENT_IDS")),
  tgAuthorizedChatIds: normalizeTelegramIds(firstNonEmptyEnv("TELEGRAM_AUTHORIZED_CHAT_IDS", "TG_AUTHORIZED_CHAT_IDS", "TELEGRAM_CHAT_IDS", "TELEGRAM_CHAT_ID")),
  dashboardUrl: process.env.DASHBOARD_URL ?? process.env.FRONTEND_URL ?? "https://29bfa18a.ncr-dashboard.pages.dev",
  targetSite: "https://nakornchiangrainews.com",
  ttfbThresholdMs: 500,
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  wpSiteUrl: process.env.WP_SITE_URL ?? "https://nakornchiangrainews.com",
  wpSentinelUrl: process.env.WP_SENTINEL_URL ?? "https://nakornchiangrainews.com/wp-json/ncr/v3/monitor",
  ncrApiSecret: process.env.NCR_API_SECRET ?? "",
  wpUser: process.env.WP_USER ?? "",
  wpAppPassword: process.env.WP_APP_PASSWORD ?? "",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  googleClientEmail: process.env.GOOGLE_CLIENT_EMAIL ?? process.env.GSC_CLIENT_EMAIL ?? "",
  googlePrivateKey: (process.env.GOOGLE_PRIVATE_KEY ?? process.env.GSC_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
  googleSearchConsoleSiteUrl: process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL ?? process.env.GSC_SITE_URL ?? "https://nakornchiangrainews.com/",
};
