# Cloudflare Rulesets API Findings for NCR Watchdog Cache Rule Deployment

**Date:** 2026-05-27 GMT+7  
**Author:** Manus AI

Cloudflare documentation confirms that Cache Rules are deployed through the Rulesets API into the zone-level `http_request_cache_settings` phase entry point. Cache rules use the `set_cache_settings` action and define behavior in `action_parameters`.

The key safety requirement is that `PUT` updates must include every rule that should remain in the ruleset. Cloudflare explicitly notes that examples replacing `rules` with a single rule will delete existing rules if copied directly. Therefore, the deployment script must first fetch the current entry point ruleset, preserve all non-target rules, remove or replace only NCR-managed rules, and then submit the full merged list.

Important API endpoints identified from Cloudflare documentation:

| Purpose | Endpoint |
|---|---|
| List zone rulesets | `GET /zones/{zone_id}/rulesets` |
| Get zone cache phase entry point | `GET /zones/{zone_id}/rulesets/phases/http_request_cache_settings/entrypoint` |
| Create zone ruleset if missing | `POST /zones/{zone_id}/rulesets` with `kind: zone`, `phase: http_request_cache_settings` |
| Update zone entry point ruleset | `PUT /zones/{zone_id}/rulesets/phases/http_request_cache_settings/entrypoint` |
| Update existing zone ruleset by ID | `PUT /zones/{zone_id}/rulesets/{ruleset_id}` |

Relevant documentation states that API tokens used to manage Cache Rules need permissions such as `Zone > Cache Rules > Edit`, and the update documentation explains that each update must include the complete desired rules list.

References:

[1]: https://developers.cloudflare.com/cache/how-to/cache-rules/create-api/ "Create a cache rule via API - Cloudflare Docs"  
[2]: https://developers.cloudflare.com/ruleset-engine/rulesets-api/view/ "List and view rulesets - Cloudflare Docs"  
[3]: https://developers.cloudflare.com/ruleset-engine/rulesets-api/update/ "Update and deploy rulesets - Cloudflare Docs"
