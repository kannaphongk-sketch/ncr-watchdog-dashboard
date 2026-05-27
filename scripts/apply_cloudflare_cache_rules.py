#!/usr/bin/env python3.11
"""Safely merge NCR Watchdog Cloudflare Cache Rules into a zone ruleset.

This script is intentionally conservative:
- Dry-run is the default. Use --apply to make changes.
- Existing rules are fetched and backed up before any write.
- Only rules marked with NCR-managed refs/descriptions are replaced.
- All unrelated existing Cloudflare rules are preserved in their existing order.
- The API token value is never printed.

Required environment variables:
  CLOUDFLARE_API_TOKEN   Cloudflare API token with Cache Rules edit permissions.
  CLOUDFLARE_ZONE_ID     Target Cloudflare zone ID.

Optional environment variables:
  NCR_CF_TARGET_HOST     Hostname to match. Defaults to gorgeous-treacle-ebe178.netlify.app.
  NCR_CF_BACKUP_DIR      Backup/output directory. Defaults to ./cloudflare_backups.
"""
from __future__ import annotations

import argparse
import copy
import datetime as dt
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests

API_BASE = "https://api.cloudflare.com/client/v4"
PHASE = "http_request_cache_settings"
DEFAULT_TARGET_HOST = "gorgeous-treacle-ebe178.netlify.app"
MANAGED_REFS = {
    "ncr-watchdog-api-bypass",
    "ncr-watchdog-static-cache-everything",
}
MANAGED_DESCRIPTIONS = {
    "NCR Watchdog API Bypass",
    "NCR Watchdog Static Cache Everything",
}


def now_stamp() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise SystemExit(f"Missing required environment variable: {name}")
    return value


def cf_request(method: str, path: str, token: str, payload: Optional[Dict[str, Any]] = None) -> Tuple[int, Dict[str, Any]]:
    url = f"{API_BASE}{path}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    response = requests.request(method, url, headers=headers, json=payload, timeout=45)
    try:
        data = response.json()
    except ValueError:
        data = {"success": False, "errors": [{"message": response.text[:500]}], "messages": []}
    return response.status_code, data


def assert_success(status: int, data: Dict[str, Any], context: str, allow_404: bool = False) -> Optional[Dict[str, Any]]:
    if allow_404 and status == 404:
        return None
    if not data.get("success"):
        errors = data.get("errors") or []
        messages = "; ".join(str(e.get("message", e)) for e in errors) or f"HTTP {status}"
        raise RuntimeError(f"Cloudflare API failed during {context}: {messages}")
    return data.get("result")


def get_entrypoint_ruleset(zone_id: str, token: str) -> Optional[Dict[str, Any]]:
    status, data = cf_request("GET", f"/zones/{zone_id}/rulesets/phases/{PHASE}/entrypoint", token)
    result = assert_success(status, data, "fetch cache phase entrypoint", allow_404=True)
    return result


def create_entrypoint_payload(rules: List[Dict[str, Any]]) -> Dict[str, Any]:
    return {
        "name": "NCR Watchdog dashboard cache policy",
        "description": "Zone-level cache settings entry point managed safely by NCR Watchdog automation.",
        "kind": "zone",
        "phase": PHASE,
        "rules": rules,
    }


def normalize_rule_for_put(rule: Dict[str, Any]) -> Dict[str, Any]:
    """Remove response-only metadata that Cloudflare does not require in update payloads."""
    allowed_keys = {
        "action",
        "action_parameters",
        "description",
        "enabled",
        "expression",
        "logging",
        "ref",
    }
    normalized = {k: copy.deepcopy(v) for k, v in rule.items() if k in allowed_keys}
    if "enabled" not in normalized:
        normalized["enabled"] = True
    return normalized


def target_rules(target_host: str) -> List[Dict[str, Any]]:
    api_expression = f'(http.host eq "{target_host}" and starts_with(http.request.uri.path, "/api/"))'
    static_expression = (
        f'(http.host eq "{target_host}" and '
        'not starts_with(http.request.uri.path, "/api/") and '
        'http.request.method in {"GET" "HEAD"})'
    )
    return [
        {
            "ref": "ncr-watchdog-api-bypass",
            "description": "NCR Watchdog API Bypass",
            "expression": api_expression,
            "action": "set_cache_settings",
            "action_parameters": {"cache": False},
            "enabled": True,
        },
        {
            "ref": "ncr-watchdog-static-cache-everything",
            "description": "NCR Watchdog Static Cache Everything",
            "expression": static_expression,
            "action": "set_cache_settings",
            "action_parameters": {
                "cache": True,
                "edge_ttl": {"mode": "respect_origin"},
                "browser_ttl": {"mode": "respect_origin"},
            },
            "enabled": True,
        },
    ]


def is_managed_rule(rule: Dict[str, Any]) -> bool:
    return rule.get("ref") in MANAGED_REFS or rule.get("description") in MANAGED_DESCRIPTIONS


def has_overlap(rule: Dict[str, Any], target_host: str) -> bool:
    expr = str(rule.get("expression", ""))
    desc = str(rule.get("description", ""))
    if is_managed_rule(rule):
        return False
    host_hit = target_host in expr
    api_hit = "/api/" in expr or "starts_with(http.request.uri.path" in expr
    cache_action = rule.get("action") == "set_cache_settings"
    cache_params = rule.get("action_parameters", {}) if isinstance(rule.get("action_parameters"), dict) else {}
    broad_cache = cache_params.get("cache") is True and (host_hit or "true" == expr.strip())
    return bool(cache_action and (host_hit or api_hit or broad_cache or "cache" in desc.lower()))


def merge_rules(existing_rules: List[Dict[str, Any]], target_host: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], int]:
    preserved = [normalize_rule_for_put(rule) for rule in existing_rules if not is_managed_rule(rule)]
    removed_count = len(existing_rules) - len(preserved)
    managed = target_rules(target_host)
    merged = managed + preserved
    overlaps = [rule for rule in preserved if has_overlap(rule, target_host)]
    return merged, overlaps, removed_count


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, sort_keys=False) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Safely merge NCR Watchdog Cloudflare Cache Rules.")
    parser.add_argument("--apply", action="store_true", help="Apply changes to Cloudflare. Default is dry-run only.")
    parser.add_argument("--target-host", default=os.environ.get("NCR_CF_TARGET_HOST", DEFAULT_TARGET_HOST), help="Hostname for cache-rule expressions.")
    args = parser.parse_args()

    token = require_env("CLOUDFLARE_API_TOKEN")
    zone_id = require_env("CLOUDFLARE_ZONE_ID")
    target_host = args.target_host.strip()
    if not target_host or "/" in target_host:
        raise SystemExit("--target-host must be a bare hostname, for example dashboard.example.com")

    backup_dir = Path(os.environ.get("NCR_CF_BACKUP_DIR", "cloudflare_backups"))
    stamp = now_stamp()

    print("NCR Watchdog Cloudflare Cache Rules merge")
    print("=========================================")
    print(f"Mode: {'APPLY' if args.apply else 'DRY RUN'}")
    print(f"Phase: {PHASE}")
    print(f"Target host: {target_host}")
    print("API token: [redacted]")

    existing = get_entrypoint_ruleset(zone_id, token)
    if existing is None:
        existing_rules: List[Dict[str, Any]] = []
        print("Existing cache phase entrypoint: not found; a new zone ruleset would be created.")
    else:
        existing_rules = existing.get("rules") or []
        print(f"Existing cache phase entrypoint: found ruleset {existing.get('id')} version {existing.get('version')}")
        print(f"Existing rule count: {len(existing_rules)}")

    backup_path = backup_dir / f"cache_rules_backup_{stamp}.json"
    write_json(backup_path, existing or {"missing_entrypoint": True, "rules": []})
    print(f"Backup written: {backup_path}")

    merged_rules, overlaps, removed_count = merge_rules(existing_rules, target_host)
    planned_payload = create_entrypoint_payload(merged_rules)
    planned_path = backup_dir / f"cache_rules_planned_{stamp}.json"
    write_json(planned_path, planned_payload)

    print(f"Managed NCR rules replaced/removed before merge: {removed_count}")
    print(f"Planned total rule count: {len(merged_rules)}")
    print(f"Planned payload written: {planned_path}")

    if overlaps:
        overlap_path = backup_dir / f"cache_rules_overlap_review_{stamp}.json"
        write_json(overlap_path, overlaps)
        print("Potential overlapping existing cache rules were detected and preserved.")
        print(f"Overlap review file: {overlap_path}")
        for rule in overlaps:
            print(f"- Preserved overlap candidate: {rule.get('description', '[no description]')} :: {rule.get('expression', '')}")
    else:
        print("No obvious overlapping existing cache rules detected among preserved rules.")

    print("Planned NCR managed rules:")
    for rule in target_rules(target_host):
        print(f"- {rule['description']} :: {rule['expression']} :: cache={rule['action_parameters'].get('cache')}")

    if not args.apply:
        print("Dry run complete. No Cloudflare changes were made. Re-run with --apply to update the zone entrypoint.")
        return 0

    status, data = cf_request("PUT", f"/zones/{zone_id}/rulesets/phases/{PHASE}/entrypoint", token, planned_payload)
    result = assert_success(status, data, "update cache phase entrypoint")
    result_path = backup_dir / f"cache_rules_apply_result_{stamp}.json"
    write_json(result_path, result)
    print(f"Apply complete. Result written: {result_path}")
    print(f"Updated ruleset: {result.get('id')} version {result.get('version')}")
    print(f"Updated rule count: {len(result.get('rules') or [])}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
