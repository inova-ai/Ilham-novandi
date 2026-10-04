# Neon candle database setup

## 1. Create the Neon database
Open Neon Console and create/select a PostgreSQL project.

## 2. Add DATABASE_URL to Vercel
Copy the Neon connection string from **Connect** and add it in Vercel:

`DATABASE_URL=postgresql://...`

Do not put this value in `index.html` or expose it to the browser.

## 3. Optional: create the table manually
Run `db/schema.sql` in the Neon SQL Editor. The API also creates the table automatically on first request.

## 4. How this build works
- Browser gets Binance Futures candles only as the market-data ingestion source.
- Browser sends candles to `/api/candles?action=upsert`.
- `/api/candles?action=latest` reads candle history from Neon PostgreSQL.
- The chart renders the Neon candle history.
- WebSocket/poll updates are also persisted to Neon.

This avoids storing the Neon database password in frontend code.

## Binance Futures archive fallback

If the Vercel server receives HTTP 451 from Binance Futures REST, the chart can seed from Binance's official USD-M Futures public archive at `data.binance.vision`. This remains Binance Futures data; no Bybit/other exchange is used. Once seeded, candles are stored in Neon PostgreSQL and the chart reads Neon first.

The fallback requires the `fflate` dependency already included in `package.json`.
