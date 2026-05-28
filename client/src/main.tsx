import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;
  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;
  if (!isUnauthorized) return;
  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const DEFAULT_API_BASE_URL = "";

const readViteEnv = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const normalizeApiBaseUrl = (value: unknown): string => {
  const rawValue = readViteEnv(value).replace(/\/$/, "");
  if (!rawValue) return DEFAULT_API_BASE_URL;
  if (/manus|nkcr-watchdog-dashboard-center\.kannaphong-k\.workers\.dev|ncr-watchdog-backend\.kannaphong-k\.workers\.dev/i.test(rawValue)) return DEFAULT_API_BASE_URL;
  try {
    const base = typeof window !== "undefined" ? window.location.origin : "https://ncr-watchdog-dashboard.pages.dev";
    const url = new URL(rawValue, base);
    if (!["http:", "https:"].includes(url.protocol)) return DEFAULT_API_BASE_URL;
    const currentProtocol = typeof window !== "undefined" ? window.location.protocol : "https:";
    if (currentProtocol === "https:" && url.protocol === "http:") return DEFAULT_API_BASE_URL;
    return url.origin === base ? DEFAULT_API_BASE_URL : url.href.replace(/\/$/, "");
  } catch (error) {
    console.warn("[api] Invalid VITE_API_BASE_URL; falling back to same-origin /api.", error);
    return DEFAULT_API_BASE_URL;
  }
};

const apiBaseUrl = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
const trpcUrl = apiBaseUrl ? new URL("/api/trpc", apiBaseUrl).toString() : "/api/trpc";
const isCrossOriginApi = Boolean(
  apiBaseUrl && typeof window !== "undefined" && new URL(apiBaseUrl, window.location.origin).origin !== window.location.origin
);

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: trpcUrl,
      async fetch(input, init) {
        const headers = new Headers(init?.headers);
        headers.set("Accept", "application/json");
        if (!headers.has("Content-Type") && init?.body) headers.set("Content-Type", "application/json");
        const response = await globalThis.fetch(input, {
          ...(init ?? {}),
          headers,
          mode: isCrossOriginApi ? "cors" : "same-origin",
          credentials: isCrossOriginApi ? "omit" : "include",
        });
        return response;
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
