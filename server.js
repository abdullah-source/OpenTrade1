'use strict';
/**
 * server.js — zero-dependency Node server.
 *
 *   node server.js        # then open http://localhost:3000
 *
 * Serves the Called It web app from /public and exposes a small real-data API:
 *   GET /api/health
 *   GET /api/analyze?tickers=NVDA,AAPL&benchmark=SPY&window=252
 *   GET /api/range?ticker=NVDA&from=2023-01-01&to=2023-12-31
 *   GET /api/position?ticker=NVDA&amount=100&from=2024-01-02
 *
 * All price data is real, pulled from Yahoo Finance (see lib/prices.js). No API keys.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const finance = require('./lib/finance');
const prices = require('./lib/prices');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

async function apiAnalyze(params, res) {
  const tickers = (params.get('tickers') || '').split(',').map((s) => s.trim()).filter(Boolean);
  const benchmark = (params.get('benchmark') || 'SPY').trim();
  const window = Math.max(20, Math.min(1260, parseInt(params.get('window') || '252', 10)));
  if (!tickers.length) return sendJson(res, 400, { error: 'pass ?tickers=NVDA,AAPL' });

  const market = await prices.seriesWindow(benchmark, window);
  const results = {};
  for (const t of tickers) {
    try {
      const s = await prices.seriesWindow(t, window);
      results[t] = finance.analyze(s, market);
    } catch (e) {
      results[t] = { error: e.message };
    }
  }
  sendJson(res, 200, { benchmark, window, results });
}

async function apiRange(params, res) {
  const ticker = (params.get('ticker') || '').trim();
  const from = (params.get('from') || '').trim();
  const to = (params.get('to') || '').trim();
  if (!ticker) return sendJson(res, 400, { error: 'pass ?ticker=NVDA' });
  const s = await prices.series(ticker);
  const sliced = finance.sliceRange(s, from, to);
  sendJson(res, 200, {
    ticker,
    from: from || (sliced[0] && sliced[0].date),
    to: to || (sliced[sliced.length - 1] && sliced[sliced.length - 1].date),
    startClose: sliced[0] && sliced[0].close,
    endClose: sliced[sliced.length - 1] && sliced[sliced.length - 1].close,
    totalReturn: finance.rangeReturn(s, from, to),
  });
}

async function apiPosition(params, res) {
  const ticker = (params.get('ticker') || '').trim();
  const amount = parseFloat(params.get('amount') || '100');
  const from = (params.get('from') || '').trim();
  const to = (params.get('to') || '').trim();
  if (!ticker) return sendJson(res, 400, { error: 'pass ?ticker=NVDA' });
  const [s, market] = await Promise.all([prices.series(ticker), prices.seriesWindow('SPY', 252)]);
  const pnl = finance.positionPnL(s, amount, from, to);
  if (!pnl) return sendJson(res, 422, { error: 'not enough data for that date range' });
  const analysis = finance.analyze(finance.sliceRange(s, from, to), market);
  sendJson(res, 200, { ticker, ...pnl, beta: analysis.beta, annualizedVol: analysis.annualizedVol });
}

// ---- dynamic matchup generator: real data, fresh every time ----
// { tkr, name, sector, min } — min = earliest year with a full year of data.
const UNIVERSE = [
  { tkr: 'NFLX', name: 'Netflix', sector: 'streaming', min: 2015 },
  { tkr: 'SPOT', name: 'Spotify', sector: 'streaming', min: 2019 },
  { tkr: 'DIS', name: 'Disney', sector: 'streaming', min: 2015 },
  { tkr: 'ROKU', name: 'Roku', sector: 'streaming', min: 2018 },
  { tkr: 'CMG', name: 'Chipotle', sector: 'food', min: 2015 },
  { tkr: 'MCD', name: "McDonald's", sector: 'food', min: 2015 },
  { tkr: 'SBUX', name: 'Starbucks', sector: 'food', min: 2015 },
  { tkr: 'YUM', name: 'Taco Bell (Yum)', sector: 'food', min: 2015 },
  { tkr: 'NKE', name: 'Nike', sector: 'wear', min: 2015 },
  { tkr: 'LULU', name: 'Lululemon', sector: 'wear', min: 2015 },
  { tkr: 'DECK', name: 'UGG (Deckers)', sector: 'wear', min: 2015 },
  { tkr: 'CROX', name: 'Crocs', sector: 'wear', min: 2016 },
  { tkr: 'AAPL', name: 'Apple', sector: 'bigtech', min: 2015 },
  { tkr: 'NVDA', name: 'Nvidia', sector: 'bigtech', min: 2015 },
  { tkr: 'MSFT', name: 'Microsoft', sector: 'bigtech', min: 2015 },
  { tkr: 'GOOGL', name: 'Google', sector: 'bigtech', min: 2015 },
  { tkr: 'AMZN', name: 'Amazon', sector: 'bigtech', min: 2015 },
  { tkr: 'META', name: 'Meta', sector: 'social', min: 2015 },
  { tkr: 'SNAP', name: 'Snapchat', sector: 'social', min: 2018 },
  { tkr: 'PINS', name: 'Pinterest', sector: 'social', min: 2020 },
  { tkr: 'RDDT', name: 'Reddit', sector: 'social', min: 2025 },
  { tkr: 'TSLA', name: 'Tesla', sector: 'auto', min: 2015 },
  { tkr: 'RIVN', name: 'Rivian', sector: 'auto', min: 2022 },
  { tkr: 'F', name: 'Ford', sector: 'auto', min: 2015 },
  { tkr: 'GM', name: 'GM', sector: 'auto', min: 2015 },
  { tkr: 'UBER', name: 'Uber', sector: 'gig', min: 2020 },
  { tkr: 'DASH', name: 'DoorDash', sector: 'gig', min: 2021 },
  { tkr: 'LYFT', name: 'Lyft', sector: 'gig', min: 2020 },
  { tkr: 'ABNB', name: 'Airbnb', sector: 'gig', min: 2021 },
  { tkr: 'KO', name: 'Coca-Cola', sector: 'drinks', min: 2015 },
  { tkr: 'PEP', name: 'Pepsi', sector: 'drinks', min: 2015 },
  { tkr: 'CELH', name: 'Celsius', sector: 'drinks', min: 2019 },
  { tkr: 'MNST', name: 'Monster', sector: 'drinks', min: 2015 },
  { tkr: 'NVDA', name: 'Nvidia', sector: 'chips', min: 2015 },
  { tkr: 'AMD', name: 'AMD', sector: 'chips', min: 2015 },
  { tkr: 'INTC', name: 'Intel', sector: 'chips', min: 2015 },
  { tkr: 'MU', name: 'Micron', sector: 'chips', min: 2015 },
  { tkr: 'PYPL', name: 'PayPal', sector: 'fintech', min: 2016 },
  { tkr: 'COIN', name: 'Coinbase', sector: 'fintech', min: 2022 },
  { tkr: 'HOOD', name: 'Robinhood', sector: 'fintech', min: 2022 },
  { tkr: 'SOFI', name: 'SoFi', sector: 'fintech', min: 2022 },
];
const SECTORS = [...new Set(UNIVERSE.map((u) => u.sector))];
const YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const pctStr = (x) => (x >= 0 ? '+' : '') + (x * 100).toFixed(0) + '%';

const QVARIANTS = [
  (y) => `Flashback ${y} — who actually won?`,
  (y) => `${y}: which one printed?`,
  (y) => `Rewind to ${y}. Call the winner.`,
  (y) => `${y} tape — who beat who?`,
];

function buildCard(a, b, year, ra, rb) {
  const win = ra > rb ? { o: a, r: ra } : { o: b, r: rb };
  const lose = ra > rb ? { o: b, r: rb } : { o: a, r: ra };
  const gap = Math.round(Math.abs(ra - rb) * 100);
  const mx = Math.max(ra, rb);
  const hint =
    mx > 1 ? 'One of these more than doubled that year.'
    : Math.min(ra, rb) < 0 && mx > 0 ? 'One finished the year green, the other red.'
    : gap < 8 ? "It's closer than you'd think." : 'One clearly ran harder.';
  const why =
    `${win.o.name} ${win.r >= 0 ? 'ran ' + pctStr(win.r) : 'fell ' + pctStr(win.r)} in ${year}, ` +
    `vs ${lose.o.name} ${pctStr(lose.r)} — a ${gap}-point gap.`;
  return {
    period: String(year),
    q: pick(QVARIANTS)(year),
    a: { name: a.name, tkr: a.tkr },
    b: { name: b.name, tkr: b.tkr },
    ra, rb, why, hint,
  };
}

async function buildMatchup(used) {
  for (let attempt = 0; attempt < 16; attempt++) {
    const sector = pick(SECTORS);
    const members = UNIVERSE.filter((u) => u.sector === sector);
    if (members.length < 2) continue;
    const a = pick(members);
    const b = pick(members);
    if (b.tkr === a.tkr) continue;
    const years = YEARS.filter((y) => y >= Math.max(a.min, b.min));
    if (!years.length) continue;
    const year = pick(years);
    const key = [a.tkr, b.tkr].sort().join('-') + ':' + year;
    if (used.has(key)) continue;
    const from = `${year}-01-01`, to = `${year}-12-31`;
    try {
      const [sa, sb] = await Promise.all([prices.series(a.tkr), prices.series(b.tkr)]);
      const ca = finance.sliceRange(sa, from, to), cb = finance.sliceRange(sb, from, to);
      if (ca.length < 150 || cb.length < 150) continue; // need a full-ish year
      used.add(key);
      return buildCard(a, b, year, finance.totalReturn(ca), finance.totalReturn(cb));
    } catch (e) {
      continue;
    }
  }
  return null;
}

async function apiMatchups(params, res) {
  const count = Math.max(1, Math.min(8, parseInt(params.get('count') || '5', 10)));
  const used = new Set();
  const out = [];
  let guard = 0;
  while (out.length < count && guard++ < count * 4) {
    const m = await buildMatchup(used);
    if (m) out.push(m);
  }
  sendJson(res, 200, { matchups: out });
}

function serveStatic(req, res) {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/') rel = '/index.html';
  const filePath = path.join(PUBLIC, path.normalize(rel));
  if (!filePath.startsWith(PUBLIC)) {
    res.writeHead(403);
    return res.end('forbidden');
  }
  fs.readFile(filePath, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('not found');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, `http://${req.headers.host}`);
    if (u.pathname === '/api/health') return sendJson(res, 200, { ok: true, source: 'yahoo-finance' });
    if (u.pathname === '/api/analyze') return await apiAnalyze(u.searchParams, res);
    if (u.pathname === '/api/range') return await apiRange(u.searchParams, res);
    if (u.pathname === '/api/position') return await apiPosition(u.searchParams, res);
    if (u.pathname === '/api/matchups') return await apiMatchups(u.searchParams, res);
    if (u.pathname.startsWith('/api/')) return sendJson(res, 404, { error: 'unknown endpoint' });
    return serveStatic(req, res);
  } catch (e) {
    sendJson(res, 500, { error: e.message });
  }
});

server.listen(PORT, () => {
  console.log(`\n  Called It — running with LIVE market data`);
  console.log(`  ▶  http://localhost:${PORT}\n`);
  console.log(`  try the engine directly:`);
  console.log(`     http://localhost:${PORT}/api/analyze?tickers=NVDA,AAPL,LULU`);
  console.log(`     http://localhost:${PORT}/api/position?ticker=NVDA&amount=100&from=2024-01-02\n`);
});
