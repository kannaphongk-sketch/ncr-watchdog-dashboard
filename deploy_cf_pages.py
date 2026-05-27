#!/usr/bin/env python3
import json
import os
import subprocess
from pathlib import Path

project = Path('/home/ubuntu/netlify_source')
config_path = project / '.project-config.json'
config = json.loads(config_path.read_text())
token = config.get('secrets', {}).get('CF_API_TOKEN') or config.get('secrets', {}).get('CLOUDFLARE_API_TOKEN')
if not token:
    print('ERROR:CF_API_TOKEN_NOT_FOUND')
    raise SystemExit(2)
print('CF_API_TOKEN=present_redacted')
env = os.environ.copy()
env['CLOUDFLARE_API_TOKEN'] = token
env['CF_API_TOKEN'] = token
cmd = [
    'npx', '-y', 'wrangler', 'pages', 'deploy', 'dist/public',
    '--project-name=ncr-watchdog',
]
result = subprocess.run(cmd, cwd=str(project), env=env, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
print(result.stdout.replace(token, '[REDACTED_TOKEN]'))
raise SystemExit(result.returncode)
