import { describe, it, expect } from "vitest";

describe("Cloudflare 404 Analytics", () => {
  it("should fetch 404 count from Cloudflare GraphQL API", async () => {
    const cfApiToken = process.env.CF_API_TOKEN ?? "";
    const cfZoneId = process.env.CF_ZONE_ID ?? "";

    expect(cfApiToken).not.toBe("");
    expect(cfZoneId).not.toBe("");

    const now = Date.now();
    const since = new Date(now - 23 * 60 * 60 * 1000 - 59 * 60 * 1000).toISOString();
    const until = new Date(now).toISOString();

    const query = `
      query {
        viewer {
          zones(filter: { zoneTag: "${cfZoneId}" }) {
            httpRequestsAdaptiveGroups(
              limit: 5
              filter: { datetime_geq: "${since}", datetime_leq: "${until}", edgeResponseStatus: 404 }
            ) {
              count
            }
          }
        }
      }
    `;

    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfApiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });

    expect(res.status).toBe(200);

    const data = (await res.json()) as {
      data?: { viewer?: { zones?: { httpRequestsAdaptiveGroups?: { count: number }[] }[] } };
      errors?: unknown[];
    };

    // Should not have errors (CF returns null when no errors, not undefined)
    expect(data.errors == null || (Array.isArray(data.errors) && data.errors.length === 0)).toBe(true);
    // Should have zones data
    expect(data.data?.viewer?.zones).toBeDefined();
    const groups = data.data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups ?? [];
    expect(Array.isArray(groups)).toBe(true);
    // count404 should be a non-negative number
    const count404 = groups.reduce((acc, g) => acc + (g.count ?? 0), 0);
    expect(count404).toBeGreaterThanOrEqual(0);
  }, 15000);
});
