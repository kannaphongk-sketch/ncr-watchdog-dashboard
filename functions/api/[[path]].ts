interface Env {
  BACKEND_ORIGIN?: string;
}

const DEFAULT_BACKEND_ORIGIN = "http://35.196.168.113:3000";

export const onRequest: PagesFunction<Env> = async context => {
  const backendOrigin = (context.env.BACKEND_ORIGIN || DEFAULT_BACKEND_ORIGIN).replace(/\/$/, "");
  const incomingUrl = new URL(context.request.url);
  const targetUrl = new URL(incomingUrl.pathname + incomingUrl.search, backendOrigin);

  const requestHeaders = new Headers(context.request.headers);
  requestHeaders.set("Host", targetUrl.host);
  requestHeaders.set("X-Forwarded-Host", incomingUrl.host);
  requestHeaders.set("X-Forwarded-Proto", incomingUrl.protocol.replace(":", ""));

  const proxiedRequest = new Request(targetUrl.toString(), {
    method: context.request.method,
    headers: requestHeaders,
    body: ["GET", "HEAD"].includes(context.request.method) ? undefined : context.request.body,
    redirect: "manual",
  });

  const response = await fetch(proxiedRequest);
  const responseHeaders = new Headers(response.headers);
  responseHeaders.set("Access-Control-Allow-Origin", incomingUrl.origin);
  responseHeaders.set("Access-Control-Allow-Credentials", "true");
  responseHeaders.set("Vary", "Origin");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
};
