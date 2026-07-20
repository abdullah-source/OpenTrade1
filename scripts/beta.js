'use strict';
/**
 * CLI: node scripts/beta.js NVDA AAPL LULU
 * Prints real beta / return / alpha vs SPY for each ticker. No server needed.
 */

const finance = require('../lib/finance');
const prices = require('../lib/prices');

const pct = (x) => (x * 100).toFixed(1) + '%';
const pad = (s, n) => String(s).padEnd(n);

async function main() {
  const tickers = process.argv.slice(2);
  if (!tickers.length) {
    console.log('usage: node scripts/beta.js NVDA AAPL LULU');
    process.exit(1);
  }
  console.log(`\nfetching real prices from Yahoo Finance (vs SPY, ~1y daily)...\n`);
  const market = await prices.seriesWindow('SPY', 252);

  console.log(pad('TICKER', 8), pad('LAST', 12), pad('1Y RET', 10), pad('BETA', 8), pad('ALPHA(ann)', 12), 'VOL(ann)');
  console.log('-'.repeat(60));
  for (const t of tickers) {
    try {
      const s = await prices.seriesWindow(t, 252);
      const a = finance.analyze(s, market);
      console.log(
        pad(t.toUpperCase(), 8),
        pad('$' + (a.lastClose != null ? a.lastClose.toFixed(2) : '?'), 12),
        pad(pct(a.totalReturn), 10),
        pad(a.beta.toFixed(2), 8),
        pad(pct(a.alphaAnnual), 12),
        pct(a.annualizedVol)
      );
    } catch (e) {
      console.log(pad(t.toUpperCase(), 8), 'error:', e.message);
    }
  }
  console.log('');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
