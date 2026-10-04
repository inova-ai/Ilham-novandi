# ILHAM NOVANDI V8 — 15M Smart Entry (Vercel / Node 24)

V8 is the V7 15M Smart Entry build repackaged for the current Vercel Node.js runtime.

## What's included
- 15M-only decision and confirmation engine
- PRE-SIGNAL / EARLY ENTRY / CONFIRMED flow
- Smart Entry Window and pullback/retest logic
- Anti-chase and dynamic RR checks
- Dynamic SL/TP, TP1 → Break Even, trailing runner simulation
- Paper Engine, scanner, trade journal, win rate and quick backtest
- Binance Futures server API integration
- Live order gate remains disabled by default

## Vercel deployment
1. Import this project into Vercel.
2. Root Directory: `./` (the ZIP is already flattened; do not point to a nested folder).
3. Node.js: `24.x` (also pinned by `package.json`).
4. Add Environment Variables from `.env.example` when Binance connectivity is needed.
5. Keep `LIVE_TRADING_ENABLED=false` while testing.

## Environment variables
- `BINANCE_API_KEY`
- `BINANCE_API_SECRET`
- `BINANCE_BASE_URL` (mainnet default: `https://fapi.binance.com`)
- `LIVE_TRADING_ENABLED` (default `false`)
- `LIVE_CONFIRM` (`ILHAM-NOVANDI-LIVE`)
- `MAX_NOTIONAL_USDT` (default `100`)
- `DEFAULT_SL_PCT` (default `0.8`)
- `DEFAULT_TP_PCT` (default `1.6`)

## Safety
Paper mode is the default. Test on Binance Futures Testnet before any live trading. Never put the Binance secret in frontend code or GitHub. No strategy can guarantee profit.
