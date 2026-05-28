export const onRequest: PagesFunction<{
  TELEGRAM_CHAT_IDS?: string;
  BACKEND_ORIGIN?: string;
  CLOUDFLARE_ZONE_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
}> = async (context) => {
  const url = new URL(context.request.url);
  const isBatch = url.searchParams.get("batch") === "1";

  const trpcPrefix = "/api/trpc/";
  const trpcIndex = url.pathname.indexOf(trpcPrefix);

  if (trpcIndex === -1) {
    return fallbackProxy(context, url);
  }

  const pathStr = url.pathname.substring(trpcIndex + trpcPrefix.length);
  const requestedEndpoints = pathStr
    .split(",")
    .map((endpoint) => endpoint.trim())
    .filter(Boolean);

  const safeString = (value: unknown, fallback = "-") =>
    String(value ?? fallback);

  const jsonResponse = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
    });

  const emptyDataResponse = () => ({
    result: {
      data: [],
    },
  });

  const generateMockResponse = async (endpoint = "") => {
    if (endpoint.includes("monitor.cfAnalytics")) {
      const zoneId = context.env.CLOUDFLARE_ZONE_ID;
      const apiToken = context.env.CLOUDFLARE_API_TOKEN;

      if (!zoneId || !apiToken) {
        return {
          result: {
            data: {
              cacheHitRatio: "0",
              history: [],
              status: "missing_config",
            },
          },
        };
      }

      try {
        const since = new Date(Date.now() - 86_400_000).toISOString();

        const body = JSON.stringify({
          query: `
            query GetCache($zoneTag: String!, $since: DateTime!) {
              viewer {
                zones(filter: { zoneTag: $zoneTag }) {
                  httpRequests1hGroups(
                    limit: 24,
                    filter: { datetime_gt: $since }
                  ) {
                    sum {
                      requests
                      cachedRequests
                    }
                  }
                }
              }
            }
          `,
          variables: {
            zoneTag: zoneId,
            since,
          },
        });

        const response = await fetch(
          "https://api.cloudflare.com/client/v4/graphql",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiToken}`,
              "Content-Type": "application/json",
            },
            body,
          }
        );

        if (!response.ok) {
          return {
            result: {
              data: {
                cacheHitRatio: "0",
                history: [],
                status: "cloudflare_error",
              },
            },
          };
        }

        const cfData: any = await response.json();

        const stats =
          cfData?.data?.viewer?.zones?.[0]?.httpRequests1hGroups ?? [];

        const total = stats.reduce(
          (acc: number, item: any) =>
            acc + Number(item?.sum?.requests ?? 0),
          0
        );

        const cached = stats.reduce(
          (acc: number, item: any) =>
            acc + Number(item?.sum?.cachedRequests ?? 0),
          0
        );

        const ratio = total > 0 ? Math.round((cached / total) * 100) : 0;

        return {
          result: {
            data: {
              cacheHitRatio: safeString(ratio, "0"),
              history: Array.isArray(stats) ? stats : [],
              status: "success",
            },
          },
        };
      } catch {
        return {
          result: {
            data: {
              cacheHitRatio: "0",
              history: [],
              status: "failed",
            },
          },
        };
      }
    }

    if (endpoint.includes("monitor.telegramConfig")) {
      return {
        result: {
          data: {
            recipients: safeString(
              context.env.TELEGRAM_CHAT_IDS,
              "8674647124"
            ),
            status: "connected",
          },
        },
      };
    }

    return emptyDataResponse();
  };

  if (isBatch) {
    const results = await Promise.all(
      requestedEndpoints.map((endpoint) => generateMockResponse(endpoint))
    );

    return jsonResponse(results);
  }

  const result = await generateMockResponse(requestedEndpoints[0]);

  return jsonResponse(result);
};

async function fallbackProxy(context: any, url: URL) {
  const backendOrigin =
    context.env.BACKEND_ORIGIN ||
    "https://ncr-watchdog-backend.kannaphong-k.workers.dev";

  try {
    const targetUrl = new URL(url.pathname + url.search, backendOrigin);

    return await fetch(new Request(targetUrl.toString(), context.request));
  } catch {
    return new Response(
      JSON.stringify({
        result: {
          data: [],
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
      }
    );
  }
}
