# ILHAM NOVANDI AI TRADING SYSTEM v8.7.1

Binance Futures-only trading terminal with Neon PostgreSQL candle storage.

See `README-NEON.md` for deployment and candle-data architecture.


v8.7.1 fixes Binance Futures history bootstrap: official archive is attempted before REST, HTTP 451 fails fast, archive host fallback is included, and Neon candle upserts use a single transaction.
