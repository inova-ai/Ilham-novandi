const { unzipSync, strFromU8 } = require('fflate');

function json(res, status, body) {
  res.status(status).setHeader('Cache-Control', 'no-store').json(body);
}

const DAY_MS = 86400000;
const MAX_DAYS = 5;

function intervalToMs(interval) {
  const m = String(interval).match(/^(\d+)(s|m|h|d|w)$/i);
  if (!m) return 15 * 60 * 1000;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  return n * ({s:1000,m:60000,h:3600000,d:86400000,w:604800000}[unit] || 900000);
}

function isoDay(d) {
  return d.toISOString().slice(0, 10);
}

function parseCsv(bytes, symbol, interval) {
  const files = unzipSync(bytes);
  const name = Object.keys(files).find(k => /\.csv$/i.test(k)) || Object.keys(files)[0];
  if (!name) return [];
  const text = strFromU8(files[name]);
  const rows = text.split(/\r?\n/);
  const out = [];
  for (const line of rows) {
    if (!line || line[0] === '#') continue;
    const p = line.split(',');
    if (p.length < 7) continue;
    const t = Number(p[0]);
    const o = Number(p[1]), h = Number(p[2]), l = Number(p[3]), c = Number(p[4]), v = Number(p[5]);
    const closeTime = Number(p[6]);
    if (![t,o,h,l,c,v,closeTime].every(Number.isFinite)) continue;
    // Binance public futures archives use milliseconds for USD-M kline timestamps.
    out.push([t,o.toString(),h.toString(),l.toString(),c.toString(),v.toString(),closeTime,'0',0,'0','0','0']);
  }
  return out;
}

async function fetchDay(symbol, interval, day) {
  const file = `${symbol}-${interval}-${day}.zip`;
  const url = `https://data.binance.vision/data/futures/um/daily/klines/${encodeURIComponent(symbol)}/${encodeURIComponent(interval)}/${file}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'ilham-novandi/8.5.2', 'Accept': 'application/zip' }, cache: 'no-store', signal: controller.signal });
    if (!r.ok) return { day, rows: [], status: r.status, url };
    return { day, rows: parseCsv(new Uint8Array(await r.arrayBuffer()), symbol, interval), status: 200, url };
  } finally {
    clearTimeout(timer);
  }
}

async function getHistorical(symbol, interval, limit) {
  const jobs = [];
  const today = new Date();
  // Daily archives are published after the trading day. Start from yesterday
  // and walk backward so this works even when the current day archive is absent.
  for (let i = 1; i <= MAX_DAYS; i++) jobs.push(fetchDay(symbol, interval, isoDay(new Date(today.getTime() - i * DAY_MS))));
  const results = await Promise.all(jobs);
  const map = new Map();
  for (const r of results) for (const k of r.rows) map.set(Number(k[0]), k);
  return [...map.values()].sort((a,b)=>Number(a[0])-Number(b[0])).slice(-limit);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok:false, error:'GET required' });
  const symbol = String(req.query?.symbol || 'BTCUSDT').toUpperCase();
  const interval = String(req.query?.interval || '15m');
  const limit = Math.min(Math.max(Number(req.query?.limit || 260), 1), 1500);
  try {
    const klines = await getHistorical(symbol, interval, limit);
    if (!klines.length) return json(res, 502, { ok:false, error:'Binance Vision tidak menemukan arsip Futures untuk '+symbol+' '+interval, source:'binance-vision-futures', daysChecked: MAX_DAYS });
    const last = klines.at(-1);
    const prev = klines.length > 1 ? klines.at(-2) : last;
    const lastClose = Number(last[4]), prevClose = Number(prev[4]);
    const ticker = {
      symbol,
      lastPrice: String(lastClose),
      highPrice: String(Math.max(...klines.map(k=>Number(k[2])))),
      lowPrice: String(Math.min(...klines.map(k=>Number(k[3])))),
      volume: String(klines.reduce((a,k)=>a+Number(k[5]),0)),
      priceChangePercent: String(prevClose ? ((lastClose/prevClose)-1)*100 : 0)
    };
    return json(res, 200, { ok:true, symbol, interval, klines, ticker, source:'binance-futures-public-archive' });
  } catch (err) {
    return json(res, 502, { ok:false, error:err.message || 'Binance Vision Futures error', source:'binance-futures-public-archive' });
  }
};
