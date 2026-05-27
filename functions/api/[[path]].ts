import type { CloudflareFunctionEnv } from "../lib/cloudflare-utils";
import { applyCors, corsHeaders, proxyToBackend } from "../lib/cloudflare-utils";

function apiPath(params: Record<string, string | string[]>): string {
  const rawPath = params.path;
  if (Array.isArray(rawPath)) return rawPath.map(segment => encodeURIComponent(segment)).join("/");
  return rawPath ? encodeURIComponent(rawPath) : "";
}

export const onRequest: PagesFunction<CloudflareFunctionEnv> = async context => {
  if (context.request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(context.request, context.env) });
  }

  try {
    const suffix = apiPath(context.params);
    return proxyToBackend(context, `/api${suffix ? `/${suffix}` : ""}`);
  } catch (error) {
    return applyCors(
      new Response(JSON.stringify({ error: "Backend fetch failed", detail: error instanceof Error ? error.message : String(error) }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }),
      context.request,
      context.env
    );
  }
};
