'use strict';
/**
 * finance.js — pure, dependency-free financial math.
 *
 * Everything here is a pure function so it can be unit-tested with no network.
 * The "beta" framing matches OpenTrade's thesis: we measure how a name moves
 * relative to the market (SPY), not whether it beats it.
 *
 * A "series" is an array of { date: 'YYYY-MM-DD', close: number } sorted ascending.
 */

const TRADING_DAYS = 252;

/** Simple daily returns from an array of closes: r_t = close_t / close_{t-1} - 1 */
function dailyReturns(closes) {
  const r = [];
  for (let i = 1; i < closes.length; i++) {
    r.push(closes[i] / closes[i - 1] - 1);
  }
  return r;
}

function mean(xs) {
  if (!xs.length) return 0;
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

/** Population covariance (the n cancels in beta, so population vs sample is fine and consistent). */
function covariance(a, b) {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  const ma = mean(a.slice(0, n));
  const mb = mean(b.slice(0, n));
  let s = 0;
  for (let i = 0; i < n; i++) s += (a[i] - ma) * (b[i] - mb);
  return s / n;
}

function variance(a) {
  return covariance(a, a);
}

function stddev(a) {
  return Math.sqrt(variance(a));
}

/**
 * Beta: covariance(asset, market) / variance(market).
 * beta = 1 moves with the market; > 1 is more volatile; < 1 is defensive.
 */
function beta(assetReturns, marketReturns) {
  const v = variance(marketReturns);
  if (v === 0) return 0;
  return covariance(assetReturns, marketReturns) / v;
}

/**
 * Annualized CAPM alpha (risk-free defaults to ~0 for simplicity):
 * alpha = annualized(asset) - beta * annualized(market).
 * This is the "how much did you add ON TOP of just riding the market" number.
 */
function alphaAnnual(assetReturns, marketReturns, riskFreeAnnual = 0) {
  const b = beta(assetReturns, marketReturns);
  const rf = riskFreeAnnual;
  const assetAnn = mean(assetReturns) * TRADING_DAYS;
  const marketAnn = mean(marketReturns) * TRADING_DAYS;
  return (assetAnn - rf) - b * (marketAnn - rf);
}

/** Annualized volatility from daily returns. */
function annualizedVol(returns) {
  return stddev(returns) * Math.sqrt(TRADING_DAYS);
}

/** Align two dated series on their common dates. Returns { dates, a: closes[], b: closes[] }. */
function align(seriesA, seriesB) {
  const mapB = new Map(seriesB.map((p) => [p.date, p.close]));
  const dates = [];
  const a = [];
  const b = [];
  for (const p of seriesA) {
    if (mapB.has(p.date)) {
      dates.push(p.date);
      a.push(p.close);
      b.push(mapB.get(p.date));
    }
  }
  return { dates, a, b };
}

/** Total return over a series: last/first - 1. */
function totalReturn(series) {
  if (series.length < 2) return 0;
  return series[series.length - 1].close / series[0].close - 1;
}

/** Slice a series to [from, to] inclusive (YYYY-MM-DD strings compare lexicographically). */
function sliceRange(series, from, to) {
  return series.filter((p) => (!from || p.date >= from) && (!to || p.date <= to));
}

/** Total return between two dates using the first close on/after `from` and last on/before `to`. */
function rangeReturn(series, from, to) {
  const s = sliceRange(series, from, to);
  return totalReturn(s);
}

/**
 * The one-call analytics used by the app: given an asset series and the market
 * (SPY) series, return the numbers a user cares about. All computed from real data.
 */
function analyze(assetSeries, marketSeries) {
  const { a, b } = align(assetSeries, marketSeries);
  const assetR = dailyReturns(a);
  const marketR = dailyReturns(b);
  const b_ = beta(assetR, marketR);
  return {
    points: a.length,
    lastClose: assetSeries.length ? assetSeries[assetSeries.length - 1].close : null,
    totalReturn: totalReturn(assetSeries),
    beta: b_,
    alphaAnnual: alphaAnnual(assetR, marketR),
    annualizedVol: annualizedVol(assetR),
    marketTotalReturn: totalReturn(marketSeries),
  };
}

/**
 * Position P&L given a buy: amount invested at the first close on/after buyDate.
 * "We calculate the data for them" — this is that calculation.
 */
function positionPnL(series, amount, buyDate, asOf) {
  const s = sliceRange(series, buyDate, asOf);
  if (s.length < 2) return null;
  const entry = s[0].close;
  const now = s[s.length - 1].close;
  const ret = now / entry - 1;
  const shares = amount / entry;
  const value = shares * now;
  return {
    entryDate: s[0].date,
    entryPrice: entry,
    lastDate: s[s.length - 1].date,
    lastPrice: now,
    shares,
    invested: amount,
    value,
    pnl: value - amount,
    returnPct: ret,
  };
}

module.exports = {
  TRADING_DAYS,
  dailyReturns,
  mean,
  covariance,
  variance,
  stddev,
  beta,
  alphaAnnual,
  annualizedVol,
  align,
  totalReturn,
  sliceRange,
  rangeReturn,
  analyze,
  positionPnL,
};
