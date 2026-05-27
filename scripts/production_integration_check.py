#!/usr/bin/env python3
"""Safe production integration checks for NCR Watchdog.

This script intentionally avoids printing secret values. It verifies:
- Netlify production dashboard availability
- tRPC query access through the deployed serverless function
- WordPress Sentinel direct authenticated request
- Cloudflare API token and zone access
- Telegram bot token and chat access without sending messages
"""
from __future__ import annotations

import json
import subprocess
import sys
import time
import urllib.parse
from dataclasses import dataclass
from typing import Any

import requests

BASE_URL = "https://gorgeous-treacle-ebe178.netlify.app"
TIMEOUT = 25


@dataclass
class Check:
    name: str
    ok: bool
    detail: str


def netlify_env() -> dict[str, str]:
    cmd = [
        "pnpm",
        "--package=netlify-cli@latest",
        "dlx",
        "netlify",
        "env:list",
        "--context",
        "production",
        "--plain",
    ]
    proc = subprocess.run(cmd, cwd="/home/ubuntu/netlify_source", text=True, capture_output=True, timeout=90)
    if proc.returncode != 0:
        raise RuntimeError(f"Unable to read Netlify env names/values safely: exit={proc.returncode}")
    env: dict[str, str] = {}
    for line in proc.stdout.splitlines():
        if "=" in line and not line.startswith("["):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    return env


def summarize_json(obj: Any) -> str:
    if isinstance(obj, dict):
        keys = sorted(obj.keys())[:10]
        return "keys=" + ",".join(keys)
    if isinstance(obj, list):
        return f"list_len={len(obj)}"
    return type(obj).__name__


def trpc_get(procedure: str) -> tuple[bool, str, Any | None]:
    # tRPC httpBatchLink format for a query with undefined input.
    input_payload = json.dumps({"0": {"json": None}}, separators=(",", ":"))
    url = f"{BASE_URL}/api/trpc/{procedure}?batch=1&input={urllib.parse.quote(input_payload)}"
    r = requests.get(url, timeout=TIMEOUT, headers={"Accept": "application/json"})
    if r.status_code != 200:
        return False, f"HTTP {r.status_code}: {r.text[:180]}", None
    try:
        data = r.json()
    except Exception as exc:
        return False, f"Invalid JSON: {exc}; body={r.text[:180]}", None
    if not isinstance(data, list) or not data:
        return False, f"Unexpected tRPC envelope: {summarize_json(data)}", data
    item = data[0]
    if "error" in item:
        msg = item.get("error", {}).get("message", str(item.get("error")))
        return False, f"tRPC error: {msg}", data
    result = item.get("result", {}).get("data")
    if isinstance(result, dict) and "json" in result:
        result = result["json"]
    return True, summarize_json(result), result


def main() -> int:
    checks: list[Check] = []
    env = netlify_env()

    required = {
        "CF_API_TOKEN",
        "CF_ZONE_ID",
        "DASHBOARD_URL",
        "NCR_API_SECRET",
        "NODE_VERSION",
        "TG_BOT_TOKEN",
        "TG_CHAT_ID",
        "WP_SITE_URL",
        "WP_SENTINEL_URL",
    }
    missing = sorted(required - set(env))
    checks.append(Check("Netlify production env names", not missing, "missing=" + (",".join(missing) if missing else "none")))

    t0 = time.time()
    try:
        r = requests.get(BASE_URL, timeout=TIMEOUT, headers={"Accept": "text/html"})
        ms = round((time.time() - t0) * 1000)
        checks.append(Check("Dashboard homepage", r.status_code == 200 and "NCR" in r.text[:500000], f"HTTP {r.status_code}, {ms}ms"))
    except Exception as exc:
        checks.append(Check("Dashboard homepage", False, f"request failed: {exc}"))

    for proc in [
        "monitor.quickStatus",
        "monitor.securityLevel",
        "monitor.cfAnalytics",
        "wpSentinel.getV6Data",
        "wpSentinel.getLatencyTimeline",
    ]:
        try:
            ok, detail, _ = trpc_get(proc)
            checks.append(Check(f"tRPC {proc}", ok, detail))
        except Exception as exc:
            checks.append(Check(f"tRPC {proc}", False, f"request failed: {exc}"))

    try:
        wp_url = env.get("WP_SENTINEL_URL") or env.get("WP_SITE_URL", "").rstrip("/") + "/wp-json/ncr/v3/monitor"
        r = requests.get(
            wp_url,
            params={"secret": env.get("NCR_API_SECRET", ""), "v": str(int(time.time()))},
            headers={"NCR-Secret": env.get("NCR_API_SECRET", ""), "Accept": "application/json"},
            timeout=TIMEOUT,
        )
        ok = r.status_code == 200
        detail = f"HTTP {r.status_code}"
        try:
            js = r.json()
            detail += "; " + summarize_json(js)
            ok = ok and (js.get("isUp") is True or "wp_health" in js or "health" in js or "memory_usage" in js)
        except Exception:
            detail += f"; body={r.text[:120]}"
        checks.append(Check("WordPress Sentinel direct auth", ok, detail))
    except Exception as exc:
        checks.append(Check("WordPress Sentinel direct auth", False, f"request failed: {exc}"))

    try:
        headers = {"Authorization": f"Bearer {env.get('CF_API_TOKEN','')}", "Content-Type": "application/json"}
        r1 = requests.get("https://api.cloudflare.com/client/v4/user/tokens/verify", headers=headers, timeout=TIMEOUT)
        verify = r1.json() if r1.text else {}
        ok1 = r1.status_code == 200 and verify.get("success") is True
        zone_id = env.get("CF_ZONE_ID", "")
        r2 = requests.get(f"https://api.cloudflare.com/client/v4/zones/{zone_id}", headers=headers, timeout=TIMEOUT)
        zone = r2.json() if r2.text else {}
        ok2 = r2.status_code == 200 and zone.get("success") is True
        zone_name = zone.get("result", {}).get("name", "unknown") if isinstance(zone, dict) else "unknown"
        checks.append(Check("Cloudflare token and zone", ok1 and ok2, f"token_ok={ok1}; zone_ok={ok2}; zone={zone_name}"))
    except Exception as exc:
        checks.append(Check("Cloudflare token and zone", False, f"request failed: {exc}"))

    try:
        token = env.get("TG_BOT_TOKEN", "")
        chat_id = env.get("TG_CHAT_ID", "")
        r1 = requests.get(f"https://api.telegram.org/bot{token}/getMe", timeout=TIMEOUT)
        bot = r1.json() if r1.text else {}
        ok1 = r1.status_code == 200 and bot.get("ok") is True
        r2 = requests.get(f"https://api.telegram.org/bot{token}/getChat", params={"chat_id": chat_id}, timeout=TIMEOUT)
        chat = r2.json() if r2.text else {}
        ok2 = r2.status_code == 200 and chat.get("ok") is True
        chat_type = chat.get("result", {}).get("type", "unknown") if isinstance(chat, dict) else "unknown"
        checks.append(Check("Telegram bot and chat access", ok1 and ok2, f"bot_ok={ok1}; chat_ok={ok2}; chat_type={chat_type}"))
    except Exception as exc:
        checks.append(Check("Telegram bot and chat access", False, f"request failed: {exc}"))

    print("Production integration check results")
    print("=" * 36)
    for c in checks:
        print(f"{'PASS' if c.ok else 'FAIL'}\t{c.name}\t{c.detail}")
    failed = [c for c in checks if not c.ok]
    print(f"summary: passed={len(checks)-len(failed)} failed={len(failed)} total={len(checks)}")
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())
