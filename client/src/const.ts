export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

const readViteEnv = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

// Generate login URL at runtime so redirect URI reflects the current origin.
// Missing Cloudflare/Vite OAuth values must never throw during render or query-error handling.
export const getLoginUrl = () => {
  if (typeof window === "undefined") return "/";

  const oauthPortalUrl = readViteEnv(import.meta.env.VITE_OAUTH_PORTAL_URL).replace(/\/$/, "");
  const appId = readViteEnv(import.meta.env.VITE_APP_ID);

  if (!oauthPortalUrl || !appId) {
    console.warn("[auth] VITE_OAUTH_PORTAL_URL or VITE_APP_ID is not configured; staying on the dashboard.");
    return "/";
  }

  try {
    const redirectUri = `${window.location.origin}/api/oauth/callback`;
    const state = btoa(redirectUri);
    const url = new URL("/app-auth", oauthPortalUrl);
    url.searchParams.set("appId", appId);
    url.searchParams.set("redirectUri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("type", "signIn");
    return url.toString();
  } catch (error) {
    console.warn("[auth] Invalid VITE_OAUTH_PORTAL_URL; staying on the dashboard.", error);
    return "/";
  }
};
