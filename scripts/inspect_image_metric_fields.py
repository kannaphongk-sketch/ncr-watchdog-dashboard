#!/usr/bin/env python3.11
"""Safely inspect WordPress Sentinel image optimization field names and values.

This script prints only non-secret image-related fields from the production tRPC
response and, if local env values are available, from the direct WordPress
Sentinel endpoint. It intentionally avoids printing any credentials.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from typing import Any
import urllib.parse

import requests

SITE = "https://gorgeous-treacle-ebe178.netlify.app"
IMAGE_KEY_RE = re.compile(r"(image|img|optim|ewww|media|attachment|webp|compress)", re.I)


def trpc_get(path: str) -> Any:
    payload = json.dumps({"0": {"json": None}}, separators=(",", ":"))
    url = f"{SITE}/api/trpc/{path}?batch=1&input={urllib.parse.quote(payload)}"
    res = requests.get(url, timeout=30, headers={"Accept": "application/json", "User-Agent": "NCR-Watchdog-ImageMetricInspector/1.0"})
    res.raise_for_status()
    envelope = res.json()
    item = envelope[0]
    if "error" in item:
        raise RuntimeError(item["error"].get("message", str(item["error"])))
    result = item.get("result", {}).get("data")
    return result.get("json", result) if isinstance(result, dict) else result


def load_netlify_env() -> dict[str, str]:
    env: dict[str, str] = {}
    try:
        proc = subprocess.run(
            ["pnpm", "--package=netlify-cli", "dlx", "netlify", "env:list", "--plain"],
            check=True,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            timeout=60,
        )
    except Exception:
        return env
    for line in proc.stdout.splitlines():
        line = line.strip()
        if not line or line.startswith("?") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip().strip('"')
    return env


def image_subset(data: dict[str, Any]) -> dict[str, Any]:
    return {k: data.get(k) for k in sorted(data) if IMAGE_KEY_RE.search(k)}


def main() -> int:
    print("== Production tRPC normalized image fields ==")
    data = trpc_get("wpSentinel.getV6Data")
    for key in ["optimizedImages", "totalImages", "imageOptimizationPct"]:
        print(f"{key}: {data.get(key)!r}")

    raw = data.get("rawResponse") if isinstance(data, dict) else None
    if isinstance(raw, dict):
        print("\n== Production tRPC rawResponse image-like keys ==")
        subset = image_subset(raw)
        if subset:
            for key, value in subset.items():
                print(f"{key}: {value!r}")
        else:
            print("No image-like keys found in rawResponse")

    env = load_netlify_env()
    secret = env.get("NCR_API_SECRET") or os.environ.get("NCR_API_SECRET")
    sentinel_url = env.get("WP_SENTINEL_URL") or os.environ.get("WP_SENTINEL_URL")
    if secret and sentinel_url:
        print("\n== Direct WordPress Sentinel image-like keys ==")
        res = requests.get(
            sentinel_url,
            params={"secret": secret, "v": "image-metric-inspect"},
            headers={"User-Agent": "NCR-Watchdog-ImageMetricInspector/1.0", "NCR-Secret": secret, "Cache-Control": "no-cache"},
            timeout=30,
        )
        print(f"direct_status: {res.status_code}")
        if res.ok and res.headers.get("content-type", "").lower().startswith("application/json"):
            direct = res.json()
            if isinstance(direct, dict):
                subset = image_subset(direct)
                if subset:
                    for key, value in subset.items():
                        print(f"{key}: {value!r}")
                else:
                    print("No image-like keys found in direct response")
        else:
            print("Direct response was not JSON or was not successful")
    else:
        print("\nDirect WordPress Sentinel inspection skipped: local env unavailable")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
