# ILHAM NOVANDI AI TRADING SYSTEM 8.5.4

Binance Futures tetap menjadi satu-satunya sumber market data dan trading. Chart memakai Neon PostgreSQL sebagai cache/database candle. Jika REST Binance Futures terkena HTTP 451, bootstrap candle memakai arsip resmi Binance USD-M Futures (data.binance.vision / official S3 mirror), lalu disimpan ke Neon. Tidak menggunakan Bybit.

## Vercel Environment

Wajib:
- `DATABASE_URL` = connection string Neon PostgreSQL.

API key/secret Binance hanya diperlukan jika fitur LIVE trading di project memang digunakan.
