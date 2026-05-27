#!/usr/bin/env python3
import json
import subprocess
import sys
from pathlib import Path

SITE_ID = "1bd22346-5280-4363-8050-06e33f68d4c4"
PROJECT_DIR = Path("/home/ubuntu/netlify_source")
NETLIFY = ["pnpm", "--package=netlify-cli", "dlx", "netlify"]
TARGET_CHAT_IDS = ["8855631169", "8674647124", "8216202664"]
CONTEXT = "production"
SCOPE = "functions"
SET_ALL_CONTEXTS_AND_SCOPES = False


def run(args, allow_failure=False):
    proc = subprocess.run(
        NETLIFY + args + ["--site", SITE_ID],
        cwd=PROJECT_DIR,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if proc.returncode != 0 and not allow_failure:
        print(f"ERROR: command failed for {args[:2]} with exit code {proc.returncode}")
        if proc.stderr.strip():
            print(proc.stderr.strip().splitlines()[-1])
        sys.exit(proc.returncode)
    return proc


def normalize_value(raw_stdout: str) -> str:
    value = raw_stdout.strip()
    if not value:
        return ""
    try:
        parsed = json.loads(value)
        if isinstance(parsed, str):
            return parsed.strip()
        if isinstance(parsed, dict):
            for candidate_key in ("value", "Values", "values"):
                candidate = parsed.get(candidate_key)
                if isinstance(candidate, str):
                    return candidate.strip()
    except json.JSONDecodeError:
        pass
    return value.strip().strip('"')


def get_value(name: str) -> str:
    proc = run(["env:get", name, "--context", CONTEXT, "--scope", SCOPE, "--json"], allow_failure=True)
    if proc.returncode != 0:
        proc = run(["env:get", name, "--context", CONTEXT, "--json"], allow_failure=True)
    if proc.returncode != 0:
        return ""
    return normalize_value(proc.stdout)

existing_telegram = get_value("TELEGRAM_CHAT_ID")
existing_tg = get_value("TG_CHAT_ID")
base_value = existing_telegram or existing_tg

if not base_value:
    print("ERROR: No existing TELEGRAM_CHAT_ID or TG_CHAT_ID value could be resolved for production.")
    sys.exit(2)

previous_chat_ids = [item.strip() for item in base_value.split(",") if item.strip()]
chat_ids = TARGET_CHAT_IDS.copy()
combined = ",".join(chat_ids)

for name in ("TELEGRAM_CHAT_ID", "TG_CHAT_ID"):
    if SET_ALL_CONTEXTS_AND_SCOPES:
        run(["env:set", name, combined, "--secret", "--force"])
    else:
        run(["env:set", name, combined, "--context", CONTEXT, "--secret", "--force"])

print(json.dumps({
    "updated": True,
    "target": "all scopes in production context" if not SET_ALL_CONTEXTS_AND_SCOPES else "all contexts and scopes",
    "variables_set": ["TELEGRAM_CHAT_ID", "TG_CHAT_ID"],
    "recipient_count": len(chat_ids),
    "removed_previous_extra_recipients": [item for item in previous_chat_ids if item not in TARGET_CHAT_IDS],
    "target_recipients_present": all(item in previous_chat_ids for item in TARGET_CHAT_IDS),
    "value_mask": f"{len(chat_ids)} comma-separated recipient(s); secret value not printed",
}, indent=2, sort_keys=True))
