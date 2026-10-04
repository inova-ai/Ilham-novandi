# ILHAM NOVANDI V8.3 — 15M Smart Entry

Vercel + Node.js 24. Chart 15M now prefers direct browser access to Binance Futures public REST/WebSocket so a Vercel deployment region cannot prevent public market data. Vercel proxy remains a fallback for environments where direct access fails.

## Deploy
- Root Directory: `./`
- Framework Preset: Other
- Node.js: 24.x
- No Binance API key is required just to display public BTCUSDT market data.

## Environment variables
See `.env.example`. Keep API secrets only in Vercel.

## Important
Paper mode is the default. Live trading is server-gated and is not a profit guarantee. Test on Binance Futures Testnet/paper before live use.

## V8.5 — Vercel API Route Fix

V8.5 keeps the V8.4 UI/15M Smart Entry behavior and focuses on verifying that Vercel actually deploys the Node.js API Functions.

### Required project root
The Vercel project root must contain `index.html`, `api/`, `vercel.json`, and `package.json` at the same level. Do not set Vercel Root Directory to a parent folder that hides `api/`.

### Deployment smoke tests
After deployment, open these URLs in the browser:

1. `/api/health` → should return JSON with `ok: true` and `version: 8.5.0`.
2. `/api/binance?action=ping` → should return JSON with `ok: true`.
3. `/api/binance?action=market&symbol=BTCUSDT&interval=15m&limit=3` → should return Binance Futures market data or a specific upstream error.

If step 1 works, Vercel is deploying the `api/` directory. If step 1 works but step 2 is 404, the deployment root/routing configuration is still wrong. If steps 1–2 work but step 3 reports a Binance upstream error, the route is fixed and the remaining issue is Binance connectivity.

Never put `BINANCE_API_SECRET` in frontend code. Keep Binance credentials only in Vercel Environment Variables.
