'use strict';
/**
 * Unit tests for the math. Pure, no network.
 *   node --test        (or: npm test)
 */

const { test } = require('node:test');
const assert = require('node:assert');
const f = require('../lib/finance');

test('dailyReturns computes simple returns', () => {
  const r = f.dailyReturns([100, 110, 99]);
  assert.strictEqual(r.length, 2);
  assert.ok(Math.abs(r[0] - 0.1) < 1e-9);
  assert.ok(Math.abs(r[1] - -0.1) < 1e-9);
});

test('beta of a 2x-levered asset is ~2 and alpha ~0', () => {
  // market moves randomly; asset moves exactly 2x the market each day.
  const marketR = [0.01, -0.02, 0.015, -0.005, 0.02, -0.01, 0.008, -0.012];
  // build price series so dailyReturns reproduces these
  const toSeries = (returns, start = 100, tag = 'x') => {
    const out = [{ date: `2024-01-01`, close: start }];
    let px = start;
    returns.forEach((r, i) => {
      px = px * (1 + r);
      out.push({ date: `2024-01-${String(i + 2).padStart(2, '0')}`, close: px });
    });
    return out;
  };
  const market = toSeries(marketR);
  const asset = toSeries(marketR.map((r) => r * 2));
  const a = f.analyze(asset, market);
  assert.ok(Math.abs(a.beta - 2) < 1e-6, `beta ~2, got ${a.beta}`);
  assert.ok(Math.abs(a.alphaAnnual) < 1e-6, `alpha ~0, got ${a.alphaAnnual}`);
});

test('beta of a market-identical asset is ~1', () => {
  const marketR = [0.01, -0.02, 0.03, -0.01, 0.005];
  let px = 100;
  const series = [{ date: '2024-01-01', close: px }];
  marketR.forEach((r, i) => {
    px *= 1 + r;
    series.push({ date: `2024-01-0${i + 2}`, close: px });
  });
  const a = f.analyze(series, series);
  assert.ok(Math.abs(a.beta - 1) < 1e-9, `beta ~1, got ${a.beta}`);
});

test('totalReturn and rangeReturn', () => {
  const s = [
    { date: '2023-01-03', close: 100 },
    { date: '2023-06-01', close: 150 },
    { date: '2023-12-29', close: 239 },
  ];
  assert.ok(Math.abs(f.totalReturn(s) - 1.39) < 1e-9);
  assert.ok(Math.abs(f.rangeReturn(s, '2023-01-01', '2023-06-30') - 0.5) < 1e-9);
});

test('positionPnL computes shares, value and pnl', () => {
  const s = [
    { date: '2024-01-02', close: 50 },
    { date: '2024-07-01', close: 75 },
  ];
  const p = f.positionPnL(s, 100, '2024-01-01');
  assert.strictEqual(p.entryPrice, 50);
  assert.ok(Math.abs(p.shares - 2) < 1e-9);
  assert.ok(Math.abs(p.value - 150) < 1e-9);
  assert.ok(Math.abs(p.pnl - 50) < 1e-9);
  assert.ok(Math.abs(p.returnPct - 0.5) < 1e-9);
});

test('align intersects on common dates', () => {
  const A = [{ date: 'd1', close: 1 }, { date: 'd2', close: 2 }, { date: 'd3', close: 3 }];
  const B = [{ date: 'd2', close: 20 }, { date: 'd3', close: 30 }];
  const { dates, a, b } = f.align(A, B);
  assert.deepStrictEqual(dates, ['d2', 'd3']);
  assert.deepStrictEqual(a, [2, 3]);
  assert.deepStrictEqual(b, [20, 30]);
});
