# Neon + Binance Futures candle architecture (v8.6.0)

## Environment variables

```env
TRADING_MODE=demo
ENABLE_LIVE_TRADING=false

BINANCE_BASE_URL=https://fapi.binance.com
BINANCE_WS_URL=wss://fstream.binance.com
BINANCE_MARKET_BASE_URL=https://fapi.binance.com
BINANCE_MARKET_WS_URL=wss://fstream.binance.com/market
BINANCE_PUBLIC_WS_URL=wss://fstream.binance.com/public
BINANCE_PRIVATE_WS_URL=wss://fstream.binance.com/private

DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB?sslmode=require
NODE_ENV=production
```

`PORT=3000` is not needed on Vercel.

## Flow

1. Chart history is read from Neon first.
2. If Neon is empty, the server requests Binance USD-M Futures history.
3. Live updates use `BINANCE_MARKET_WS_URL` and the Binance Futures `BTCUSDT@kline_15m` stream.
4. Every realtime candle is upserted into Neon.
5. If the live REST ticker is unavailable, the chart still renders using the latest Neon candle.

This build does not switch market data to Bybit or another exchange.
