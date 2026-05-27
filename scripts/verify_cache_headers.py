#!/usr/bin/env python3
"""Verify production cache headers for NCR Watchdog Netlify deployment."""
from __future__ import annotations

import json
import pathlib
import sys
import urllib.error
import urllib.request
from typing import Dict, List, Optional

BASE_URL = "https://gorgeous-treacle-ebe178.netlify.app"
ROOT = pathlib.Path(__file__).resolve().parents[1]
DIST_ASSETS = ROOT / "dist" / "public" / "assets"
RAW_OUT = ROOT / "cache_header_verification_raw.txt"
JSON_OUT = ROOT / "cache_header_verification.json"

INTERESTING_HEADERS = [
    "cache-control",
    "cdn-cache-control",
    "surrogate-control",
    "pragma",
    "expires",
    "age",
    "etag",
    "content-type",
    "x-nf-request-id",
    "server",
]


def latest_asset_path(pattern: str) -> str:
    matches = sorted(DIST_ASSETS.glob(pattern), key=lambda p: p.stat().st_mtime, reverse=True)
    if not matches:
        raise FileNotFoundError(f"No built asset matching {pattern} found in {DIST_ASSETS}")
    return "/assets/" + matches[0].name


def request_headers(label: str, url: str, method: str = "GET", body: Optional[bytes] = None) -> Dict[str, object]:
    req = urllib.request.Request(url=url, method=method)
    if body is not None:
        req.add_header("content-type", "application/json")
        req.data = body
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            headers = {k.lower(): v for k, v in resp.headers.items()}
            status = resp.status
            reason = resp.reason
            sample = resp.read(512).decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        headers = {k.lower(): v for k, v in exc.headers.items()}
        status = exc.code
        reason = exc.reason
        sample = exc.read(512).decode("utf-8", errors="replace")
    selected = {name: headers.get(name) for name in INTERESTING_HEADERS if headers.get(name) is not None}
    return {
        "label": label,
        "url": url,
        "method": method,
        "status": status,
        "reason": reason,
        "headers": selected,
        "body_sample": sample[:200],
    }


def main() -> int:
    asset_path = latest_asset_path("index-*.js")
    api_url = BASE_URL + "/api/trpc/wpSentinel.getV6Data?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%7D%7D"
    checks: List[Dict[str, object]] = [
        request_headers("Root page", BASE_URL + "/"),
        request_headers("Hashed JavaScript asset", BASE_URL + asset_path),
        request_headers("Dynamic tRPC API", api_url, method="GET"),
    ]

    lines: List[str] = []
    for check in checks:
        lines.append(f"## {check['label']}")
        lines.append(f"URL: {check['url']}")
        lines.append(f"Method: {check['method']}")
        lines.append(f"Status: {check['status']} {check['reason']}")
        headers = check["headers"]
        assert isinstance(headers, dict)
        for name in INTERESTING_HEADERS:
            if name in headers:
                lines.append(f"{name}: {headers[name]}")
        lines.append("")

    RAW_OUT.write_text("\n".join(lines), encoding="utf-8")
    JSON_OUT.write_text(json.dumps(checks, indent=2), encoding="utf-8")
    print("\n".join(lines))

    failures = []
    root_cache = str(checks[0]["headers"].get("cache-control", "")).lower()  # type: ignore[index, union-attr]
    asset_cache = str(checks[1]["headers"].get("cache-control", "")).lower()  # type: ignore[index, union-attr]
    api_cache = str(checks[2]["headers"].get("cache-control", "")).lower()  # type: ignore[index, union-attr]

    if "max-age=0" not in root_cache and "no-cache" not in root_cache and "must-revalidate" not in root_cache:
        failures.append(f"Root page cache-control was unexpected: {root_cache!r}")
    if "max-age=31536000" not in asset_cache or "immutable" not in asset_cache:
        failures.append(f"Hashed asset cache-control was unexpected: {asset_cache!r}")
    if "no-store" not in api_cache or "no-cache" not in api_cache or "must-revalidate" not in api_cache:
        failures.append(f"Dynamic API cache-control was unexpected: {api_cache!r}")

    if failures:
        print("Verification failures:", file=sys.stderr)
        for failure in failures:
            print(f"- {failure}", file=sys.stderr)
        return 1
    print("Cache header verification passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
