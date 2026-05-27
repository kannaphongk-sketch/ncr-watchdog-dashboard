#!/usr/bin/env python3
from __future__ import annotations

import json
import requests

BASE_URL = "https://gorgeous-treacle-ebe178.netlify.app"
procedure = "monitor.sendTestReport"
url = f"{BASE_URL}/api/trpc/{procedure}?batch=1"
payload = {"0": {"json": None}}

try:
    response = requests.post(
        url,
        data=json.dumps(payload, separators=(",", ":")),
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        timeout=40,
    )
    ok = response.status_code == 200
    detail = f"HTTP {response.status_code}"
    try:
        body = response.json()
        if isinstance(body, list) and body:
            item = body[0]
            if "error" in item:
                ok = False
                detail += "; tRPC error=" + str(item.get("error", {}).get("message", item.get("error")))[:180]
            else:
                result = item.get("result", {}).get("data")
                if isinstance(result, dict) and "json" in result:
                    result = result["json"]
                detail += "; result_keys=" + ",".join(sorted(result.keys())) if isinstance(result, dict) else "; result_type=" + type(result).__name__
        else:
            ok = False
            detail += "; unexpected_envelope"
    except Exception as exc:
        ok = False
        detail += "; invalid_json=" + str(exc)
    print(("PASS" if ok else "FAIL") + "\tTelegram tRPC sendTestReport\t" + detail)
    raise SystemExit(0 if ok else 1)
except Exception as exc:
    print("FAIL\tTelegram tRPC sendTestReport\trequest failed: " + str(exc))
    raise SystemExit(1)
