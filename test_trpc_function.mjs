import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import trpcFunction from '/tmp/trpc-function.cjs';
const { handler } = trpcFunction;

const fetchViaHandler = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  const headers = Object.fromEntries(new Headers(init.headers ?? {}).entries());
  const bodyValue = init.body == null ? null : typeof init.body === 'string' ? init.body : Buffer.from(await new Response(init.body).arrayBuffer()).toString('utf8');
  const response = await handler({
    path: url.pathname,
    rawUrl: url.toString(),
    rawQuery: url.search.startsWith('?') ? url.search.slice(1) : '',
    httpMethod: init.method ?? 'GET',
    headers: { host: 'gorgeous-treacle-ebe178.netlify.app', 'x-forwarded-proto': 'https', ...headers },
    queryStringParameters: Object.fromEntries(url.searchParams.entries()),
    body: bodyValue,
    isBase64Encoded: false,
  });
  return new Response(response.body, { status: response.statusCode, headers: response.headers });
};

const client = createTRPCProxyClient({
  links: [
    httpBatchLink({
      url: 'https://gorgeous-treacle-ebe178.netlify.app/api/trpc',
      transformer: superjson,
      fetch: fetchViaHandler,
    }),
  ],
});

const result = await client.wpSentinel.getV6Data.query();
console.log(JSON.stringify({ ok: true, status: result?.status, hasMemory: Boolean(result?.memory), keys: Object.keys(result ?? {}).slice(0, 20) }, null, 2));
