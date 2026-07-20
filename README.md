# Called It 🔮

A social **foresight game** for OpenTrade — you call what the market does *before it happens*, backed by a **real beta / P&L engine** so the numbers are accurate, not mocked.

Two things live here:

1. **The game** (`/public`) — *Flashback* mode: swipe on real historical matchups ("2024: Spotify or Netflix?") and get scored instantly against real returns and against the algo.
2. **The engine** (`/lib`, `/server.js`) — pulls **real historical prices** (Yahoo Finance, no API key) and computes **beta, alpha, volatility, return, and position P&L**. This is the "beta trading" lens: how much of a move was just the market, and how much was your call.

Zero npm dependencies. Node 18+.

---

## Run it (quick + easy)

```bash
node server.js
```

Then open **http://localhost:3000**. That's it — no `npm install`, nothing to configure.

- The game shows a **LIVE data** badge when the engine is running.
- Open the **📊 Position Lab** tab → type a ticker, an amount, and a buy date → it fetches real prices and computes your **P&L + beta** for you.

### Try the engine directly

```bash
# beta / return / alpha vs SPY for any tickers
node scripts/beta.js NVDA AAPL LULU CMG

# or hit the API
curl "http://localhost:3000/api/analyze?tickers=NVDA,AAPL,LULU"
curl "http://localhost:3000/api/position?ticker=NVDA&amount=100&from=2024-01-02"
curl "http://localhost:3000/api/range?ticker=SPOT&from=2024-01-01&to=2024-12-31"
```

### Run the tests

```bash
npm test        # node --test — pure math, no network
```

---

## Why this matters for OpenTrade

- **Front door:** *Flashback* is a frictionless, no-signup hook — real history, instant answers — that drops users into the live swipe deck.
- **We do the math for them:** the Position Lab is the "add your buy → here's your live P&L and beta" moment a plain brokerage never gives.
- **Honest beta framing:** every position is measured against SPY, so we can show how much return was the market (beta) vs. the actual call. That's accurate information, computed live.

## API

| Endpoint | What it returns |
|---|---|
| `GET /api/health` | `{ ok, source }` |
| `GET /api/analyze?tickers=A,B&benchmark=SPY&window=252` | beta, alpha, vol, return, last close per ticker |
| `GET /api/range?ticker=A&from=YYYY-MM-DD&to=YYYY-MM-DD` | total return between two dates |
| `GET /api/position?ticker=A&amount=100&from=YYYY-MM-DD` | shares, value, P&L, return, beta |

## Data & caveats

- Prices come from **Yahoo Finance** daily data (`lib/prices.js`), cached per process. Real, free, no key. Uses adjusted close so returns account for splits/dividends.
- The static preview (e.g. GitHub Pages, opening the file directly) uses **embedded** approximate historical returns so the game still works offline; run the server for live data.
- `alpha` is a simplified annualized CAPM alpha (risk-free ≈ 0). Beta = cov(asset, market) / var(market) on daily returns.

## Structure

```
server.js            zero-dep static server + real-data API
lib/finance.js       pure math: returns, beta, alpha, vol, P&L  (unit-tested)
lib/prices.js        real historical prices from Yahoo Finance
scripts/beta.js      CLI: node scripts/beta.js NVDA AAPL
test/finance.test.js node --test
public/index.html    the Called It game + Position Lab
```
