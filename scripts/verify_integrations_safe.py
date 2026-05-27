from __future__ import annotations

import json
import re
import sys
import urllib.request
import urllib.error
from pathlib import Path

ENV_FILE = Path('/tmp/netlify_env_list.txt')
TARGET_ZONE = 'nakornchiangrainews.com'
SENTINEL_URL = 'https://nakornchiangrainews.com/wp-json/ncr/v3/monitor'


def load_env() -> dict[str, str]:
    env: dict[str, str] = {}
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text().splitlines():
            if '=' in line:
                key, value = line.split('=', 1)
                env[key.strip()] = value.strip()
    return env


def request_json(url: str, headers: dict[str, str], timeout: int = 20) -> tuple[int, dict]:
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            body = res.read().decode('utf-8', errors='replace')
            return res.status, json.loads(body)
    except urllib.error.HTTPError as exc:
        body = exc.read().decode('utf-8', errors='replace')
        try:
            return exc.code, json.loads(body)
        except Exception:
            return exc.code, {'raw': body[:500]}


def main() -> int:
    env = load_env()
    cf_token = env.get('CF_API_TOKEN', '')
    ncr_secret = env.get('NCR_API_SECRET', '')
    results: dict[str, object] = {'cloudflare': {}, 'wordpress': {}}

    if cf_token:
        status, verify = request_json('https://api.cloudflare.com/client/v4/user/tokens/verify', {'Authorization': f'Bearer {cf_token}'})
        results['cloudflare'] = {
            'token_verify_http': status,
            'token_valid': bool(verify.get('success')),
        }
        status, zones = request_json(f'https://api.cloudflare.com/client/v4/zones?name={TARGET_ZONE}', {'Authorization': f'Bearer {cf_token}'})
        zone_id = ''
        if zones.get('success') and zones.get('result'):
            zone_id = zones['result'][0].get('id', '')
        results['cloudflare'] = {
            **results['cloudflare'],
            'zones_http': status,
            'zone_found': bool(zone_id),
            'zone_id': zone_id,
            'zone_name': TARGET_ZONE if zone_id else '',
        }
    else:
        results['cloudflare'] = {'token_valid': False, 'zone_found': False, 'error': 'CF_API_TOKEN missing'}

    if ncr_secret:
        url = SENTINEL_URL + '?v=local-safe-check'
        req = urllib.request.Request(url, headers={
            'User-Agent': 'NCR-Watchdog-SafeCheck/1.0',
            'Cache-Control': 'no-cache',
            'NCR-Secret': ncr_secret,
        })
        try:
            with urllib.request.urlopen(req, timeout=20) as res:
                body = res.read().decode('utf-8', errors='replace')
                content_type = res.headers.get('content-type', '')
                data = json.loads(body)
                results['wordpress'] = {
                    'http': res.status,
                    'content_type': content_type,
                    'json': True,
                    'has_memory_usage': 'memory_usage' in data,
                    'has_disk_free': 'disk_free' in data,
                    'has_db_latency': 'db_latency' in data,
                    'operating_mode': str(data.get('operating_mode', ''))[:80],
                    'status': str(data.get('status', ''))[:80],
                    'health': str(data.get('health', ''))[:80],
                }
        except urllib.error.HTTPError as exc:
            text = exc.read().decode('utf-8', errors='replace')
            results['wordpress'] = {'http': exc.code, 'json': False, 'body_preview': re.sub(ncr_secret, '[redacted]', text[:300])}
        except Exception as exc:
            results['wordpress'] = {'http': 0, 'json': False, 'error': type(exc).__name__, 'message': str(exc)[:200]}
    else:
        results['wordpress'] = {'http': 0, 'json': False, 'error': 'NCR_API_SECRET missing'}

    # Do not print any token or secret values.
    print(json.dumps(results, indent=2, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
