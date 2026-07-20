'use strict';
/**
 * prices.js — fetch REAL historical daily prices from Yahoo Finance.
 *
 * Yahoo's chart endpoint returns JSON with no API key:
 *   https://query1.finance.yahoo.com/v8/finance/chart/NVDA?range=2y&interval=1d
 * We fetch server-side (no browser CORS issue) and cache per process. This is
 * what makes the numbers real, not mocked. Uses adjusted close when available
 * (accounts for splits/dividends) so returns are accurate.
 */

const https = require('https');

const cache = new Map(); // symbol -> { at, promise }
const TTL_MS = 1000 * 60 * 30; // 30 min

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (called-it/0.1)' } }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`Yahoo HTTP ${res.statusCode}`));
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Bad JSON from Yahoo'));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(12000, () => req.destroy(new Error('Yahoo timeout')));
  });
}

/** Convert a Yahoo chart payload into ascending [{date, close}] using adjusted close. */
function parseChart(json, symbol) {
  const r = json && json.chart && json.chart.result && json.chart.result[0];
  if (!r || !r.timestamp) throw new Error(`No data for ${symbol}`);
  const ts = r.timestamp;
  const adj = r.indicators && r.indicators.adjclose && r.indicators.adjclose[0] && r.indicators.adjclose[0].adjclose;
  const close = r.indicators && r.indicators.quote && r.indicators.quote[0] && r.indicators.quote[0].close;
  const px = adj || close;
  if (!px) throw new Error(`No closes for ${symbol}`);
  const out = [];
  for (let i = 0; i < ts.length; i++) {
    const v = px[i];
    if (v == null || !Number.isFinite(v)) continue;
    const date = new Date(ts[i] * 1000).toISOString().slice(0, 10);
    out.push({ date, close: v });
  }
  return out;
}

/** Full ~5y daily series for a US ticker (cached). */
function series(ticker) {
  const sym = String(ticker).trim().toUpperCase();
  const hit = cache.get(sym);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.promise;
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}` +
    `?range=5y&interval=1d&includeAdjustedClose=true`;
  const promise = httpGetJson(url).then((j) => parseChart(j, sym));
  cache.set(sym, { at: Date.now(), promise });
  promise.catch(() => cache.delete(sym));
  return promise;
}

/** Last N daily rows of a series. */
async function seriesWindow(ticker, days = 252) {
  const s = await series(ticker);
  return s.slice(Math.max(0, s.length - days - 1));
}

// ---- live quote (current price + previous close) for "today's move" ----
const quoteCache = new Map(); // symbol -> { at, promise }
const QUOTE_TTL_MS = 1000 * 60; // 1 min

function parseQuote(json, symbol) {
  const r = json && json.chart && json.chart.result && json.chart.result[0];
  const m = r && r.meta;
  if (!m) throw new Error(`No quote for ${symbol}`);
  const price = m.regularMarketPrice;
  const prev = m.chartPreviousClose != null ? m.chartPreviousClose : m.previousClose;
  if (!Number.isFinite(price) || !Number.isFinite(prev)) throw new Error(`No price for ${symbol}`);
  return { price, previousClose: prev, name: m.longName || m.shortName || symbol };
}

/** Current price, previous close and name for a US ticker (short cache). */
function quote(ticker) {
  const sym = String(ticker).trim().toUpperCase();
  const hit = quoteCache.get(sym);
  if (hit && Date.now() - hit.at < QUOTE_TTL_MS) return hit.promise;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=5d&interval=1d`;
  const promise = httpGetJson(url).then((j) => parseQuote(j, sym));
  quoteCache.set(sym, { at: Date.now(), promise });
  promise.catch(() => quoteCache.delete(sym));
  return promise;
}

module.exports = { series, seriesWindow, quote, parseChart, parseQuote };
