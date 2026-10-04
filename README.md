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
