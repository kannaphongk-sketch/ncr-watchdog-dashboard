#!/usr/bin/env python3
import re
from pathlib import Path

ROOT = Path('/home/ubuntu/netlify_source')
EXPECTED = ['8855631169', '8674647124', '8216202664']
EXPECTED_VALUE = ','.join(EXPECTED)

source_env = (ROOT / 'server/_core/env.ts').read_text()
dist_bundle = (ROOT / 'dist/index.js').read_text()
telegram_source = (ROOT / 'server/telegram.ts').read_text()

errors = []
if f'"{EXPECTED_VALUE}"' not in source_env:
    errors.append('server/_core/env.ts does not contain the exact expected three-recipient list')
if f'"{EXPECTED_VALUE}"' not in dist_bundle:
    errors.append('dist/index.js does not contain the exact expected three-recipient list')
if 'Promise.all(' not in telegram_source or 'chatIds.map(async (chatId)' not in telegram_source:
    errors.append('server/telegram.ts does not appear to fan out sends over all chat IDs')
if 'ENV.tgChatId' not in telegram_source:
    errors.append('server/telegram.ts does not read ENV.tgChatId')

source_ids = re.findall(r'\d{10}', source_env)
dist_ids = re.findall(r'\d{10}', dist_bundle[:20000])

print({
    'expected_recipients': EXPECTED,
    'source_env_contains_exact_list': EXPECTED_VALUE in source_env,
    'dist_bundle_contains_exact_list': EXPECTED_VALUE in dist_bundle,
    'source_env_recipient_ids': source_ids,
    'dist_bundle_recipient_ids_near_env': dist_ids,
    'fanout_uses_promise_all': 'Promise.all(' in telegram_source,
    'fanout_maps_all_chat_ids': 'chatIds.map(async (chatId)' in telegram_source,
})

if errors:
    raise SystemExit('\n'.join(errors))
