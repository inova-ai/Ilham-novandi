const crypto = require('crypto');
const BASE_URL = process.env.BINANCE_BASE_URL || 'https://fapi.binance.com';
const MARKET_BASE_URL = process.env.BINANCE_MARKET_BASE_URL || BASE_URL;
// Binance Futures has several API hostnames. Try them in order so a transient
// hostname/routing problem does not make the whole market-data path fail.
const MARKET_BASE_URLS = Array.from(new Set([
  MARKET_BASE_URL,
  BASE_URL,
  'https://fapi1.binance.com',
  'https://fapi2.binance.com',
  'https://fapi3.binance.com',
  'https://fapi4.binance.com'
]));

function json(res, status, body) {
  res.status(status).setHeader('Cache-Control', 'no-store').json(body);
}

async function marketFetch(path) {
  const bases = MARKET_BASE_URLS;
  const attempts = bases.map(async (base) => {
    const url = `${base}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    try {
      const r = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json', 'User-Agent': 'ilham-novandi/8.5.4' },
        cache: 'no-store', signal: controller.signal
      });
      const text = await r.text();
      let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
      if (!r.ok) {
        const err = new Error(`Binance HTTP ${r.status}`);
        err.status = r.status; err.details = data; err.base = base;
        throw err;
      }
      return data;
    } finally { clearTimeout(timer); }
  });
  try { return await Promise.any(attempts); }
  catch (agg) {
    const reasons = (agg?.errors || []).filter(Boolean);
    const err = reasons.at(-1) || new Error('Binance Futures market data tidak dapat diakses');
    throw err;
  }
}

function signedQuery(params) {
  const qs = new URLSearchParams(params).toString();
  return qs;
}

async function handler(req, res) {
  const action = String(req.query?.action || '').toLowerCase();

  if (action === 'ping') {
    return json(res, 200, {
      ok: true,
      service: 'binance-api',
      version: '8.5.4',
      marketBaseUrl: MARKET_BASE_URL
    });
  }

  if (action === 'market') {
    const symbol = String(req.query?.symbol || 'BTCUSDT').toUpperCase();
    const interval = String(req.query?.interval || '15m');
    const limit = Math.min(Math.max(Number(req.query?.limit || 260), 1), 1500);

    try {
      const qs = signedQuery({ symbol, interval, limit });
      const [klines, ticker] = await Promise.all([
        marketFetch(`/fapi/v1/klines?${qs}`),
        marketFetch(`/fapi/v1/ticker/24hr?symbol=${encodeURIComponent(symbol)}`)
      ]);

      return json(res, 200, {
        ok: true,
        symbol,
        interval,
        klines,
        ticker,
        source: 'binance-futures-rest'
      });
    } catch (err) {
      // Do not call the archive handler from inside this serverless function.
      // The browser will call /api/binance-history directly after this REST failure.
      return json(res, 502, {
        ok: false,
        error: err.message || 'Binance market request failed',
        details: err.details || null,
        marketBaseUrl: MARKET_BASE_URL,
        fallback: 'binance-futures-public-archive'
      });
    }
  }

  if (action === 'market24') {
    const symbol = String(req.query?.symbol || 'BTCUSDT').toUpperCase();
    try {
      const ticker = await marketFetch(`/fapi/v1/ticker/24hr?symbol=${encodeURIComponent(symbol)}`);
      return json(res, 200, { ok: true, symbol, ticker, source: 'binance-futures-rest' });
    } catch (err) {
      return json(res, 502, {
        ok: false,
        error: err.message || 'Binance ticker request failed',
        details: err.details || null
      });
    }
  }

  return json(res, 404, {
    ok: false,
    error: 'Unknown action',
    available: ['ping', 'market', 'market24']
  });
}

module.exports = handler;
