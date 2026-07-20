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
