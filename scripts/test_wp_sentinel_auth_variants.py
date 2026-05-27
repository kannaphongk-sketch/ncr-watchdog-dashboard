from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ENV_FILE = Path('/tmp/netlify_env_list.txt')
BASE_URL = 'https://nakornchiangrainews.com/wp-json/ncr/v3/monitor'


def load_secret() -> str:
    if not ENV_FILE.exists():
        return ''
    for line in ENV_FILE.read_text().splitlines():
        if line.startswith('NCR_API_SECRET='):
            return line.split('=', 1)[1].strip()
    return ''


def call(label: str, url: str, headers: dict[str, str]) -> dict[str, object]:
    req = urllib.request.Request(url, headers={
        'User-Agent': 'NCR-Watchdog-AuthVariantCheck/1.0',
        'Cache-Control': 'no-cache',
        **headers,
    })
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            text = res.read().decode('utf-8', errors='replace')
            try:
                data = json.loads(text)
            except Exception:
                data = {}
            return {
                'label': label,
                'http': res.status,
                'json': bool(data),
                'auth_failed': data.get('sentinel_mode') == 'AUTH_FAILED' or data.get('status') == 'error',
                'keys': sorted(list(data.keys()))[:20],
                'mode': str(data.get('operating_mode') or data.get('sentinel_mode') or '')[:80],
                'status': str(data.get('status') or '')[:80],
                'health': str(data.get('health') or '')[:80],
            }
    except urllib.error.HTTPError as exc:
        text = exc.read().decode('utf-8', errors='replace')
        data = {}
        try:
            data = json.loads(text)
        except Exception:
            pass
        return {
            'label': label,
            'http': exc.code,
            'json': bool(data),
            'auth_failed': data.get('sentinel_mode') == 'AUTH_FAILED' or data.get('status') == 'error',
            'keys': sorted(list(data.keys()))[:20],
            'mode': str(data.get('operating_mode') or data.get('sentinel_mode') or '')[:80],
            'status': str(data.get('status') or '')[:80],
            'health': str(data.get('health') or '')[:80],
        }
    except Exception as exc:
        return {'label': label, 'http': 0, 'json': False, 'error': type(exc).__name__, 'message': str(exc)[:120]}


def main() -> int:
    secret = load_secret()
    encoded = urllib.parse.quote(secret, safe='')
    variants = [
        ('header_ncr_secret', f'{BASE_URL}?v=auth-variant', {'NCR-Secret': secret}),
        ('header_x_ncr_secret', f'{BASE_URL}?v=auth-variant', {'X-NCR-Secret': secret}),
        ('header_authorization_bearer', f'{BASE_URL}?v=auth-variant', {'Authorization': f'Bearer {secret}'}),
        ('query_secret', f'{BASE_URL}?secret={encoded}&v=auth-variant', {}),
        ('query_ncr_secret', f'{BASE_URL}?ncr_secret={encoded}&v=auth-variant', {}),
        ('query_api_secret', f'{BASE_URL}?api_secret={encoded}&v=auth-variant', {}),
        ('query_token', f'{BASE_URL}?token={encoded}&v=auth-variant', {}),
    ]
    print(json.dumps([call(*v) for v in variants], indent=2, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
