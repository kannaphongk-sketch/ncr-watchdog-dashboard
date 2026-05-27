#!/usr/bin/env python3
from __future__ import annotations

import json
import requests

BASE_URL = "https://gorgeous-treacle-ebe178.netlify.app"
procedure = "monitor.runCheck"
url = f"{BASE_URL}/api/trpc/{procedure}?batch=1"
payload = {"0": {"json": None}}

response = requests.post(
    url,
    data=json.dumps(payload, separators=(",", ":")),
    headers={"Content-Type": "application/json", "Accept": "application/json"},
    timeout=60,
)
ok = response.status_code == 200
detail = f"HTTP {response.status_code}"
try:
    body = response.json()
    if isinstance(body, list) and body:
        item = body[0]
        if "error" in item:
            ok = False
            detail += "; tRPC error=" + str(item.get("error", {}).get("message", item.get("error")))[:200]
        else:
            result = item.get("result", {}).get("data")
            if isinstance(result, dict) and "json" in result:
                result = result["json"]
            if isinstance(result, dict):
                detail += "; result_keys=" + ",".join(sorted(result.keys()))
                check = result.get("check") if isinstance(result.get("check"), dict) else result
                if isinstance(check, dict):
                    fields = []
                    for k in ["httpCode", "ttfbMs", "cacheStatus", "cfRay", "isUp"]:
                        if k in check:
                            fields.append(f"{k}={check[k]}")
                    if fields:
                        detail += "; " + ",".join(fields)
            else:
                detail += "; result_type=" + type(result).__name__
    else:
        ok = False
        detail += "; unexpected_envelope"
except Exception as exc:
    ok = False
    detail += "; invalid_json=" + str(exc)

print(("PASS" if ok else "FAIL") + "\tRun Check Now tRPC mutation\t" + detail)
raise SystemExit(0 if ok else 1)
