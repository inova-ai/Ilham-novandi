# ILHAM NOVANDI V8.1 — 15M Smart Entry

Vercel/Node 24 build with a server-side Binance public market-data proxy. The chart loads 15M candles through `/api/binance?action=market`, with browser WebSocket plus a 5-second polling fallback so the chart can still render when direct Binance browser access is blocked or restricted.

## Vercel
- Root Directory: `./`
- Framework Preset: Other
- Node.js: 24.x

## Environment Variables
See `.env.example`. Paper mode is the default. Live trading requires server-side Binance credentials and explicit live enablement.

## Important
Test on Paper/Testnet first. Trading strategies do not guarantee profit.
