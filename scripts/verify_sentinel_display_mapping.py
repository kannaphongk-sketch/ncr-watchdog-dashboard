#!/usr/bin/env python3.11
"""Verify the deployed WordPress Sentinel display mapping through production tRPC.

This script does not read or print any secret values. It confirms that the deployed
serverless function normalizes compact Sentinel status values into dashboard-safe
labels.
"""
from __future__ import annotations

import json
import sys
import urllib.parse
from typing import Any

import requests

BASE_URL = "https://gorgeous-treacle-ebe178.netlify.app"
TIMEOUT = 30


def trpc_get(procedure: str) -> Any:
    payload = json.dumps({"0": {"json": None}}, separators=(",", ":"))
    url = f"{BASE_URL}/api/trpc/{procedure}?batch=1&input={urllib.parse.quote(payload)}"
    response = requests.get(url, timeout=TIMEOUT, headers={"Accept": "application/json"})
    response.raise_for_status()
    envelope = response.json()
    if not isinstance(envelope, list) or not envelope:
        raise RuntimeError(f"Unexpected tRPC envelope type: {type(envelope).__name__}")
    item = envelope[0]
    if "error" in item:
        raise RuntimeError(item["error"].get("message", str(item["error"])))
    result = item.get("result", {}).get("data")
    if isinstance(result, dict) and "json" in result:
        return result["json"]
    return result


def main() -> int:
    data = trpc_get("wpSentinel.getV6Data")
    expected = {
        "wpHealth": "Stable",
        "wpStatus": "Full-Autonomous Mode",
        "healthAlert": False,
        "statusCritical": False,
        "operatingMode": "Autonomous Caretaker Active",
    }
    print("Production Sentinel mapping verification")
    print("=======================================")
    failures: list[str] = []
    for key, expected_value in expected.items():
        actual = data.get(key) if isinstance(data, dict) else None
        ok = actual == expected_value
        print(f"{'PASS' if ok else 'FAIL'}\t{key}\tactual={actual!r}\texpected={expected_value!r}")
        if not ok:
            failures.append(key)
    for numeric_key in ["dbLatencyMs", "memoryUsageMb", "optimizedImages", "totalImages"]:
        actual = data.get(numeric_key) if isinstance(data, dict) else None
        print(f"INFO\t{numeric_key}\tactual={actual!r}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
