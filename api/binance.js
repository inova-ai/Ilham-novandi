const crypto = require('crypto');

const BASE_URL = process.env.BINANCE_BASE_URL || 'https://fapi.binance.com';
const API_KEY = process.env.BINANCE_API_KEY;
const API_SECRET = process.env.BINANCE_API_SECRET;
const LIVE_ENABLED = process.env.LIVE_TRADING_ENABLED === 'true';
const MAX_NOTIONAL_USDT = Number(process.env.MAX_NOTIONAL_USDT || 100);
const LIVE_CONFIRM = process.env.LIVE_CONFIRM || 'ILHAM-NOVANDI-LIVE';

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function requireKeys() {
  if (!API_KEY || !API_SECRET) throw new Error('Binance API credentials belum dikonfigurasi di Vercel Environment Variables.');
}

function encodeParams(params) {
  const clean = {};
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null && v !== '') clean[k] = String(v);
  }
  return new URLSearchParams(clean).toString();
}

function signature(query) {
  return crypto.createHmac('sha256', API_SECRET).update(query).digest('hex');
}

async function binance(method, path, params = {}, signed = false) {
  let query = encodeParams(params);
  const headers = {};
  if (API_KEY) headers['X-MBX-APIKEY'] = API_KEY;
  if (signed) {
    query = encodeParams({ ...params, timestamp: Date.now(), recvWindow: 5000 });
    query += '&signature=' + signature(query);
  }
  const url = BASE_URL + path + (query ? '?' + query : '');
  const r = await fetch(url, { method, headers });
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { msg: text }; }
  if (!r.ok) {
    const err = new Error(data.msg || `Binance HTTP ${r.status}`);
    err.binance = data;
    err.status = r.status;
    throw err;
  }
  return data;
}

function assertLive(req) {
  requireKeys();
  if (!LIVE_ENABLED) throw Object.assign(new Error('Live trading dinonaktifkan. Set LIVE_TRADING_ENABLED=true setelah pengujian.'), { status: 403 });
  if (req.headers['x-live-confirm'] !== LIVE_CONFIRM) throw Object.assign(new Error('Live order membutuhkan konfirmasi server.'), { status: 403 });
}

function validateSymbol(symbol) {
  if (!/^[A-Z0-9_]{5,30}$/.test(symbol)) throw new Error('Symbol tidak valid.');
  return symbol.toUpperCase();
}

function validateQuantity(q) {
  const n = Number(q);
  if (!Number.isFinite(n) || n <= 0) throw new Error('Quantity harus lebih besar dari 0.');
  return n;
}


async function publicMarket(symbol, interval='15m', limit=260) {
  const sym = validateSymbol(symbol);
  const allowed = new Set(['1m','3m','5m','15m','30m','1h','2h','4h','6h','8h','12h','1d']);
  if (!allowed.has(interval)) throw new Error('Interval tidak didukung.');
  const lim = Math.max(1, Math.min(Number(limit) || 260, 500));
  const [klines, ticker] = await Promise.all([
    binance('GET', '/fapi/v1/klines', { symbol: sym, interval, limit: lim }, false),
    binance('GET', '/fapi/v1/ticker/24hr', { symbol: sym }, false),
  ]);
  return { symbol: sym, interval, klines, ticker };
}

async function publicMarket24() {
  return binance('GET', '/fapi/v1/ticker/24hr', {}, false);
}

async function account() {
  requireKeys();
  const [a, p] = await Promise.all([
    binance('GET', '/fapi/v3/account', {}, true),
    binance('GET', '/fapi/v2/positionRisk', {}, true),
  ]);
  return {
    walletBalance: a.totalWalletBalance,
    availableBalance: a.availableBalance,
    unrealizedPnl: a.totalUnrealizedProfit,
    marginBalance: a.totalMarginBalance,
    assets: (a.assets || []).filter(x => Number(x.walletBalance) !== 0 || Number(x.availableBalance) !== 0),
    positions: (p || []).filter(x => Number(x.positionAmt) !== 0),
  };
}


async function getPosition(symbol) {
  requireKeys();
  const positions = await binance('GET', '/fapi/v2/positionRisk', { symbol: validateSymbol(symbol) }, true);
  return (positions || []).find(x => Number(x.positionAmt) !== 0) || null;
}

async function orderStatus(symbol, orderId) {
  return binance('GET', '/fapi/v1/order', { symbol: validateSymbol(symbol), orderId }, true);
}

async function normalizeQty(symbol, quantity) {
  const info = await binance('GET', '/fapi/v1/exchangeInfo');
  const s = (info.symbols || []).find(x => x.symbol === validateSymbol(symbol));
  if (!s) throw new Error('Symbol tidak ditemukan di Binance Futures.');
  const lot = (s.filters || []).find(f => f.filterType === 'LOT_SIZE');
  const priceFilter = (s.filters || []).find(f => f.filterType === 'PRICE_FILTER');
  const step = Number(lot?.stepSize || 0.001);
  const minQty = Number(lot?.minQty || step);
  const n = Math.floor(Number(quantity) / step) * step;
  if (!Number.isFinite(n) || n < minQty) throw new Error(`Quantity terlalu kecil. Minimum ${minQty}.`);
  const decimals = Math.max(0, (String(step).split('.')[1] || '').length);
  return { quantity: Number(n.toFixed(decimals)), tickSize: Number(priceFilter?.tickSize || 0.01) };
}

function roundToTick(price, tickSize) {
  if (!tickSize) return Number(price);
  const n = Math.round(Number(price) / tickSize) * tickSize;
  const decimals = Math.max(0, (String(tickSize).split('.')[1] || '').length);
  return Number(n.toFixed(decimals));
}

async function protectPosition(req, body) {
  assertLive(req);
  const symbol = validateSymbol(body.symbol);
  const p = await getPosition(symbol);
  if (!p) throw Object.assign(new Error(`Tidak ada posisi terbuka untuk ${symbol}.`), { status: 409 });
  const amount = Number(p.positionAmt);
  const side = amount > 0 ? 'SELL' : 'BUY';
  const { quantity, tickSize } = await normalizeQty(symbol, Math.abs(amount));
  const entry = Number(p.entryPrice);
  const mode = String(body.mode || 'breakeven').toLowerCase();
  const bufferPct = Math.max(0, Math.min(Number(body.bufferPct ?? 0.05), 1));
  const callbackRate = Math.max(0.1, Math.min(Number(body.callbackRate ?? 0.5), 5));
  await binance('DELETE', '/fapi/v1/allOpenOrders', { symbol }, true);
  if (mode === 'trailing') {
    const trailing = await binance('POST', '/fapi/v1/order', {
      symbol, side, type: 'TRAILING_STOP_MARKET', quantity, reduceOnly: 'true', callbackRate, workingType: 'MARK_PRICE'
    }, true);
    return { mode, entry, quantity, callbackRate, trailing };
  }
  const stopPrice = side === 'SELL' ? entry * (1 + bufferPct / 100) : entry * (1 - bufferPct / 100);
  const stop = await binance('POST', '/fapi/v1/order', {
    symbol, side, type: 'STOP_MARKET', quantity, reduceOnly: 'true', stopPrice: roundToTick(stopPrice, tickSize), workingType: 'MARK_PRICE'
  }, true);
  return { mode: 'breakeven', entry, quantity, stopPrice: roundToTick(stopPrice, tickSize), stop };
}

async function placeOrder(req, body) {
  assertLive(req);
  const symbol = validateSymbol(body.symbol);
  const side = String(body.side || '').toUpperCase();
  const type = String(body.type || 'MARKET').toUpperCase();
  if (!['BUY', 'SELL'].includes(side)) throw new Error('Side harus BUY atau SELL.');
  if (!['MARKET', 'LIMIT', 'STOP', 'TAKE_PROFIT', 'STOP_MARKET', 'TAKE_PROFIT_MARKET'].includes(type)) throw new Error('Order type tidak didukung.');
  const quantity = validateQuantity(body.quantity);
  const price = body.price == null ? undefined : Number(body.price);
  const stopPrice = body.stopPrice == null ? undefined : Number(body.stopPrice);
  if (['LIMIT', 'STOP', 'TAKE_PROFIT'].includes(type) && (!price || price <= 0)) throw new Error('Price wajib untuk order ini.');
  if (['STOP', 'TAKE_PROFIT', 'STOP_MARKET', 'TAKE_PROFIT_MARKET'].includes(type) && (!stopPrice || stopPrice <= 0)) throw new Error('Stop price wajib untuk order ini.');
  if (price && quantity * price > MAX_NOTIONAL_USDT) throw new Error(`Notional melebihi MAX_NOTIONAL_USDT (${MAX_NOTIONAL_USDT}).`);

  const params = {
    symbol, side, type, quantity,
    timeInForce: type === 'LIMIT' ? (body.timeInForce || 'GTC') : undefined,
    price: ['LIMIT', 'STOP', 'TAKE_PROFIT'].includes(type) ? price : undefined,
    stopPrice: ['STOP', 'TAKE_PROFIT', 'STOP_MARKET', 'TAKE_PROFIT_MARKET'].includes(type) ? stopPrice : undefined,
    reduceOnly: body.reduceOnly === true ? 'true' : undefined,
    positionSide: body.positionSide,
    workingType: body.workingType || 'MARK_PRICE',
    priceProtect: body.priceProtect === true ? 'TRUE' : undefined,
    newClientOrderId: body.clientOrderId,
  };
  return binance('POST', '/fapi/v1/order', params, true);
}

async function closePosition(req, symbol) {
  assertLive(req);
  const sym = validateSymbol(symbol);
  const positions = await binance('GET', '/fapi/v2/positionRisk', { symbol: sym }, true);
  const p = (positions || []).find(x => Number(x.positionAmt) !== 0);
  if (!p) throw Object.assign(new Error(`Tidak ada posisi terbuka untuk ${sym}.`), { status: 409 });
  await binance('DELETE', '/fapi/v1/allOpenOrders', { symbol: sym }, true);
  const amount = Number(p.positionAmt);
  const side = amount > 0 ? 'SELL' : 'BUY';
  const normalized = await normalizeQty(sym, Math.abs(amount));
  const params = { symbol: sym, side, type: 'MARKET', quantity: normalized.quantity };
  if (p.positionSide && p.positionSide !== 'BOTH') params.positionSide = p.positionSide;
  else params.reduceOnly = 'true';
  return binance('POST', '/fapi/v1/order', params, true);
}

async function bracketOrder(req, body) {
  assertLive(req);
  const symbol = validateSymbol(body.symbol);
  const side = String(body.side || '').toUpperCase();
  if (!['BUY', 'SELL'].includes(side)) throw new Error('Side harus BUY atau SELL.');
  const rawQty = validateQuantity(body.quantity);
  const { quantity, tickSize } = await normalizeQty(symbol, rawQty);
  const slPct = Math.min(Math.max(Number(body.slPct ?? process.env.DEFAULT_SL_PCT ?? 0.8), 0.1), 5);
  const tpPct = Math.min(Math.max(Number(body.tpPct ?? process.env.DEFAULT_TP_PCT ?? 1.6), 0.1), 10);
  const open = await binance('POST', '/fapi/v1/order', { symbol, side, type: 'MARKET', quantity }, true);
  let fillPrice = Number(open.avgPrice || open.price || body.entryPrice || 0);
  if (open.orderId && (!fillPrice || fillPrice <= 0)) {
    const filled = await orderStatus(symbol, open.orderId);
    fillPrice = Number(filled.avgPrice || filled.price || body.entryPrice || 0);
  }
  if (!fillPrice) throw new Error('Tidak mendapatkan average fill price untuk protective orders.');
  const slRaw = side === 'BUY' ? fillPrice * (1 - slPct / 100) : fillPrice * (1 + slPct / 100);
  const tpRaw = side === 'BUY' ? fillPrice * (1 + tpPct / 100) : fillPrice * (1 - tpPct / 100);
  const sl = roundToTick(slRaw, tickSize);
  const tp = roundToTick(tpRaw, tickSize);
  const exitSide = side === 'BUY' ? 'SELL' : 'BUY';
  const common = { symbol, side: exitSide, quantity, reduceOnly: 'true', workingType: 'MARK_PRICE' };
  const stop = await binance('POST', '/fapi/v1/order', { ...common, type: 'STOP_MARKET', stopPrice: sl }, true);
  const take = await binance('POST', '/fapi/v1/order', { ...common, type: 'TAKE_PROFIT_MARKET', stopPrice: tp }, true);
  return { open, stop, take, risk: { slPct, tpPct, fillPrice, stopPrice: sl, takeProfitPrice: tp, quantity } };
}

async function cancelAll(req, symbol) {
  assertLive(req);
  return binance('DELETE', '/fapi/v1/allOpenOrders', { symbol: validateSymbol(symbol) }, true);
}

module.exports = async (req, res) => {
  try {
    const action = String(req.query.action || 'status');
    if (req.method === 'GET' && action === 'market') return json(res, 200, await publicMarket((req.query || {}).symbol || 'BTCUSDT', (req.query || {}).interval || '15m', (req.query || {}).limit || 260));
    if (req.method === 'GET' && action === 'market24') return json(res, 200, await publicMarket24());
    if (req.method === 'GET' && action === 'status') {
      return json(res, 200, { configured: Boolean(API_KEY && API_SECRET), liveEnabled: LIVE_ENABLED, baseUrl: BASE_URL, maxNotionalUSDT: MAX_NOTIONAL_USDT });
    }
    if (req.method === 'GET' && action === 'account') return json(res, 200, await account());
    if (req.method === 'GET' && action === 'positions') {
      requireKeys();
      return json(res, 200, await binance('GET', '/fapi/v2/positionRisk', {}, true));
    }
    if (req.method === 'GET' && action === 'balance') {
      requireKeys();
      const a = await binance('GET', '/fapi/v3/account', {}, true);
      return json(res, 200, { walletBalance: a.totalWalletBalance, availableBalance: a.availableBalance, unrealizedPnl: a.totalUnrealizedProfit, marginBalance: a.totalMarginBalance });
    }
    if (req.method === 'POST' && action === 'order') return json(res, 200, await placeOrder(req, req.body || {}));
    if (req.method === 'POST' && action === 'bracket') return json(res, 200, await bracketOrder(req, req.body || {}));
    if (req.method === 'POST' && action === 'protect') return json(res, 200, await protectPosition(req, req.body || {}));
    if (req.method === 'GET' && action === 'position') return json(res, 200, await getPosition((req.query || {}).symbol));
    if (req.method === 'POST' && action === 'close') return json(res, 200, await closePosition(req, (req.body || {}).symbol));
    if (req.method === 'POST' && action === 'cancelAll') return json(res, 200, await cancelAll(req, (req.body || {}).symbol));
    return json(res, 404, { error: 'Action tidak ditemukan.' });
  } catch (e) {
    return json(res, e.status || 500, { error: e.message, details: e.binance || undefined });
  }
};
