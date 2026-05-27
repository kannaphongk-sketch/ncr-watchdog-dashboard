#!/usr/bin/env python3
import json
import subprocess
import sys
from pathlib import Path

SITE_ID = "1bd22346-5280-4363-8050-06e33f68d4c4"
PROJECT_DIR = Path("/home/ubuntu/netlify_source")
CMD = ["pnpm", "--package=netlify-cli", "dlx", "netlify"]
TARGET_KEYS = {"TELEGRAM_CHAT_ID", "TG_CHAT_ID", "TELEGRAM_BOT_TOKEN", "TG_BOT_TOKEN"}

def run(args):
    return subprocess.check_output(CMD + args + ["--site", SITE_ID], cwd=PROJECT_DIR, text=True, stderr=subprocess.DEVNULL)

try:
    raw = run(["env:list", "--json"])
except subprocess.CalledProcessError as exc:
    print(f"ERROR: env:list failed with exit code {exc.returncode}")
    sys.exit(exc.returncode)

try:
    data = json.loads(raw)
except Exception as exc:
    print(f"ERROR: could not parse env:list JSON: {exc}")
    sys.exit(1)

results = []
if isinstance(data, dict):
    iterable = data.items()
else:
    iterable = []

for key, value in iterable:
    if key not in TARGET_KEYS:
        continue
    entry = {"key": key, "shape": type(value).__name__}
    if isinstance(value, dict):
        entry["contexts"] = sorted(value.keys())
        scoped = []
        for ctx, ctx_value in value.items():
            if isinstance(ctx_value, dict):
                scoped.append({"context": ctx, "scopes": sorted(ctx_value.keys())})
            elif isinstance(ctx_value, str):
                scoped.append({"context": ctx, "masked_preview": f"len={len(ctx_value)}"})
        entry["scoped_contexts"] = scoped
    elif isinstance(value, str):
        entry["masked_preview"] = f"len={len(value)}"
    results.append(entry)

found_keys = sorted([r["key"] for r in results])
missing_keys = sorted(TARGET_KEYS - set(found_keys))
print(json.dumps({"found_keys": found_keys, "missing_keys": missing_keys, "results": results}, indent=2, sort_keys=True))
