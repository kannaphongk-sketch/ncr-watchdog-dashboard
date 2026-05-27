#!/usr/bin/env python3
import json
import subprocess
from pathlib import Path
from typing import Any

SITE_ID = "1bd22346-5280-4363-8050-06e33f68d4c4"
PROJECT_DIR = Path("/home/ubuntu/netlify_source")
NETLIFY = ["pnpm", "--package=netlify-cli", "dlx", "netlify"]
CONTEXT = "production"
EXPECTED_CHAT_IDS = ["8855631169", "8674647124", "8216202664"]


def run(args):
    return subprocess.run(
        NETLIFY + args + ["--site", SITE_ID],
        cwd=PROJECT_DIR,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def extract_strings(value: Any) -> list[str]:
    if isinstance(value, str):
        return [value.strip()] if value.strip() else []
    if isinstance(value, list):
        found: list[str] = []
        for item in value:
            found.extend(extract_strings(item))
        return found
    if isinstance(value, dict):
        found: list[str] = []
        for key in ("value", "values", "Values", "resolvedValue"):
            if key in value:
                found.extend(extract_strings(value[key]))
        if not found:
            for nested in value.values():
                found.extend(extract_strings(nested))
        return found
    return []


def clean_values(raw: str) -> list[str]:
    raw = raw.strip()
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
        return extract_strings(parsed)
    except json.JSONDecodeError:
        return [raw.strip('"')]

results = {}
for name in ("TELEGRAM_CHAT_ID", "TG_CHAT_ID"):
    proc = run(["env:get", name, "--context", CONTEXT, "--json"])
    values = clean_values(proc.stdout) if proc.returncode == 0 else []
    best_value = max(values, key=len) if values else ""
    chat_ids = [item.strip() for item in best_value.split(",") if item.strip()]
    results[name] = {
        "resolved": bool(best_value),
        "recipient_count": len(chat_ids),
        "contains_all_target_recipients": all(expected in chat_ids for expected in EXPECTED_CHAT_IDS),
        "missing_target_recipients": [expected for expected in EXPECTED_CHAT_IDS if expected not in chat_ids],
        "masked_value": f"{len(chat_ids)} comma-separated recipient(s); secret value not printed" if best_value else "not resolved",
    }

print(json.dumps(results, indent=2, sort_keys=True))
