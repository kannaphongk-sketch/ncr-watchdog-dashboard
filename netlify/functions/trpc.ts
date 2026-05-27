import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "../../server/routers";
import type { TrpcContext } from "../../server/_core/context";

const endpoint = "/api/trpc";

const noStoreHeaders = {
  "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
  "cdn-cache-control": "no-store",
  "netlify-cdn-cache-control": "no-store",
  pragma: "no-cache",
  expires: "0",
} as const;

type NetlifyEvent = {
  path: string;
  rawUrl?: string;
  httpMethod: string;
  headers: Record<string, string | undefined>;
  multiValueHeaders?: Record<string, string[] | undefined>;
  queryStringParameters?: Record<string, string | undefined> | null;
  rawQuery?: string;
  body?: string | null;
  isBase64Encoded?: boolean;
};

const buildQuery = (event: NetlifyEvent) => {
  if (event.rawQuery) return event.rawQuery;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(event.queryStringParameters ?? {})) {
    if (value !== undefined) params.set(key, value);
  }
  return params.toString();
};

const getProcedurePath = (eventPath: string) => {
  return eventPath
    .replace(/^\/api\/trpc\/?/, "")
    .replace(/^\/\.netlify\/functions\/trpc\/?/, "")
    .replace(/^\//, "");
};

const toRequest = (event: NetlifyEvent) => {
  const host = event.headers.host ?? "gorgeous-treacle-ebe178.netlify.app";
  const proto = event.headers["x-forwarded-proto"] ?? "https";
  const procedurePath = getProcedurePath(event.path);
  const query = buildQuery(event);
  const url = `${proto}://${host}${endpoint}${procedurePath ? `/${procedurePath}` : ""}${query ? `?${query}` : ""}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(event.headers ?? {})) {
    if (value !== undefined) headers.set(key, value);
  }

  const method = event.httpMethod ?? "GET";
  const hasBody = !["GET", "HEAD"].includes(method.toUpperCase()) && event.body != null;
  const body = hasBody
    ? event.isBase64Encoded
      ? Buffer.from(event.body ?? "", "base64")
      : event.body
    : undefined;

  return new Request(url, { method, headers, body });
};

const makeContext = async (): Promise<TrpcContext> => {
  const req = {
    headers: {},
    cookies: {},
    protocol: "https",
  } as unknown as TrpcContext["req"];
  const res = {
    cookie: () => undefined,
    clearCookie: () => undefined,
    setHeader: () => undefined,
    getHeader: () => undefined,
  } as unknown as TrpcContext["res"];

  return { req, res, user: null };
};

export const handler = async (event: NetlifyEvent) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET,POST,OPTIONS",
        "access-control-allow-headers": "content-type,authorization,x-trpc-source",
        ...noStoreHeaders,
      },
      body: "",
    };
  }

  const response = await fetchRequestHandler({
    endpoint,
    req: toRequest(event),
    router: appRouter,
    createContext: makeContext,
  });

  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  return {
    statusCode: response.status,
    headers: {
      ...headers,
      ...noStoreHeaders,
    },
    body: await response.text(),
  };
};
