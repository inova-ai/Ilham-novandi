# ILHAM NOVANDI V7 — 15M Smart Entry

V7 keeps 15M as the only decision timeframe and adds Smart Entry Window, Pullback mode, dynamic RR checks, partial-profit simulation, SL Plus/BE, trailing simulation, trade journal, and a lightweight 15M backtest.

## Vercel
- Import this folder as a static/serverless Vercel project.
- Add Binance credentials only as Vercel Environment Variables.
- Keep `LIVE_TRADING_ENABLED=false` while testing.

## Important
The browser connects to Binance public market data. Paper Engine is the default. Live orders are protected by a server-side gate and should be tested on Testnet first. The strategy cannot guarantee profit.
