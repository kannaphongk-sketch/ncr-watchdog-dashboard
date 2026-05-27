import { createSign } from "node:crypto";
import { ENV } from "./_core/env";

export interface GoogleIndexInspectionResult {
  url: string;
  verdict: "indexed" | "not_indexed" | "unknown" | "skipped";
  coverageState?: string;
  robotsTxtState?: string;
  indexingState?: string;
  lastCrawlTime?: string;
  pageFetchState?: string;
  message?: string;
}

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const INSPECTION_URL = "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect";
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

const base64Url = (value: string | Buffer) =>
  Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

function buildJwt(): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: ENV.googleClientEmail,
    scope: SCOPE,
    aud: TOKEN_URL,
    exp: now + 3600,
    iat: now,
  };
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claim))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(ENV.googlePrivateKey);
  return `${unsigned}.${base64Url(signature)}`;
}

async function getAccessToken(): Promise<string> {
  const jwt = buildJwt();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  const data = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description ?? data.error ?? `Google token request failed (${res.status})`);
  }
  return data.access_token;
}

export function getGoogleIndexMonitorUrls(): string[] {
  const configured = process.env.GOOGLE_INDEX_MONITOR_URLS ?? process.env.GSC_MONITOR_URLS ?? "";
  const urls = configured
    .split(/[\n,]/)
    .map((url) => url.trim())
    .filter(Boolean);
  if (urls.length > 0) return urls;
  return [ENV.targetSite, `${ENV.targetSite}/feed/`, `${ENV.targetSite}/sitemap_index.xml`];
}

function classifyCoverage(coverageState?: string): GoogleIndexInspectionResult["verdict"] {
  if (!coverageState) return "unknown";
  const normalized = coverageState.toLowerCase();
  if (normalized.includes("submitted and indexed") || normalized.includes("indexed")) return "indexed";
  if (normalized.includes("not indexed") || normalized.includes("blocked") || normalized.includes("excluded") || normalized.includes("error")) return "not_indexed";
  return "unknown";
}

export async function inspectGoogleIndexUrl(url: string, accessToken: string): Promise<GoogleIndexInspectionResult> {
  const res = await fetch(INSPECTION_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ inspectionUrl: url, siteUrl: ENV.googleSearchConsoleSiteUrl }),
  });
  const data = (await res.json()) as {
    inspectionResult?: {
      indexStatusResult?: {
        coverageState?: string;
        robotsTxtState?: string;
        indexingState?: string;
        lastCrawlTime?: string;
        pageFetchState?: string;
      };
    };
    error?: { message?: string };
  };
  if (!res.ok) {
    return { url, verdict: "unknown", message: data.error?.message ?? `Inspection failed (${res.status})` };
  }
  const indexStatus = data.inspectionResult?.indexStatusResult;
  return {
    url,
    verdict: classifyCoverage(indexStatus?.coverageState),
    coverageState: indexStatus?.coverageState,
    robotsTxtState: indexStatus?.robotsTxtState,
    indexingState: indexStatus?.indexingState,
    lastCrawlTime: indexStatus?.lastCrawlTime,
    pageFetchState: indexStatus?.pageFetchState,
  };
}

export async function runGoogleIndexMonitor(): Promise<{ skipped: boolean; reason?: string; results: GoogleIndexInspectionResult[] }> {
  if (!ENV.googleClientEmail || !ENV.googlePrivateKey || !ENV.googleSearchConsoleSiteUrl) {
    return { skipped: true, reason: "Google Search Console credentials are not configured", results: [] };
  }
  const urls = getGoogleIndexMonitorUrls().slice(0, 10);
  if (urls.length === 0) {
    return { skipped: true, reason: "No Google indexing monitor URLs configured", results: [] };
  }
  const accessToken = await getAccessToken();
  const results: GoogleIndexInspectionResult[] = [];
  for (const url of urls) {
    results.push(await inspectGoogleIndexUrl(url, accessToken));
  }
  return { skipped: false, results };
}
