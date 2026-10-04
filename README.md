# ILHAM NOVANDI AI TRADING SYSTEM v8.6.0

Binance Futures 100% + Neon PostgreSQL candle database.

Use the `.env.example` values in Vercel. Set `DATABASE_URL` to the Neon connection string.

Trading remains demo/paper by default:
`TRADING_MODE=demo`
`ENABLE_LIVE_TRADING=false`

The chart uses Binance Futures WebSocket market data via `BINANCE_MARKET_WS_URL`, stores candles in Neon, and reads Neon history first.
