# NCR Watchdog — Option B Handoff

This package has been prepared for the Cloudflare Pages frontend URL:

> `https://29bfa18a.ncr-dashboard.pages.dev/`

The frontend production build was generated with:

```bash
VITE_API_BASE_URL=https://3000-isieb5gntt2dvgdql65hu-b3c9546d.sg1.manus.computer pnpm build
```

The built frontend in `dist/public/` therefore points to:

> `https://3000-isieb5gntt2dvgdql65hu-b3c9546d.sg1.manus.computer/api/trpc`

Backend CORS in `server/_core/index.ts` was updated to allow the requested Cloudflare Pages URL, the main `ncr-dashboard.pages.dev` domain, preview subdomains under `*.ncr-dashboard.pages.dev`, and configured origins from `ALLOWED_ORIGINS` or `FRONTEND_URL`.

Before deploying to a permanent backend host, replace `VITE_API_BASE_URL` with the permanent backend origin and rebuild. Do not place real secrets in source control; use backend host environment variables for Cloudflare, Telegram, WordPress, or other API credentials.

## Included build output

The ZIP includes source code and current build files:

| Path | Purpose |
|---|---|
| `client/` | Frontend source |
| `server/` | Backend source |
| `shared/` | Shared source |
| `dist/public/` | Built frontend assets |
| `dist/index.js` | Bundled backend entry |
| `.env.example` | Safe example configuration only |

Excluded from the ZIP are heavy or sensitive runtime folders such as `node_modules/`, `.git/`, `.project-config.json`, local `.env` files, and cache/temp folders.
