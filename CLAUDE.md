# Called It — project constitution

A daily market deck for OpenTrade: past (history of value), present (live calls
that settle at close), future (2030 theses you can back with a position).
Zero-dependency Node server + vanilla front-end. All market data is real.

## Stack
- Node 18+, no npm dependencies. `node server.js` runs everything on :3000.
- `lib/finance.js` pure math (unit-tested, `npm test`), `lib/prices.js` Yahoo
  Finance daily + live quotes, `public/index.html` the whole front-end.
- Deploy: Railway (`railway up --ci`), service `OpenTrade1` in project
  `enchanting-radiance`. Live: https://opentrade1-production.up.railway.app
- Git: push over HTTPS remote (cached credential); the SSH key on this machine
  is a different GitHub identity and cannot push.

## Design constitution (non-negotiable)
- **Fonts:** "Instrument Serif" for display/questions, "Instrument Sans" for UI,
  "JetBrains Mono" for tickers/numbers. Never Inter, Poppins, or system defaults.
- **Color:** ink `#161412` on paper `#FAF9F6`, cards `#FFFFFF`, lines `#E7E4DD`.
  One accent: burnt orange `#C2410C`. Green `#147A4D` / red `#B3362B` are
  reserved strictly for market data (gains/losses). No gradients, no purple,
  no glassmorphism, no dark translucent panels.
- **Type scale:** 13/14/15/16/19/28/44px. Negative tracking on serif display.
- **Spacing:** 4px grid. Generous whitespace; single centered column, max 600px.
- **Radii:** 6px inputs, 8px cards, 999px chips. Nothing else.
- **Motion:** 150ms ease-out micro-interactions; 300–400ms
  cubic-bezier(0.22,1,0.36,1) entrances; opacity + transform only; always
  respect `prefers-reduced-motion`. Nothing bounces, nothing loops.
- **CTA rule:** exactly ONE filled (accent) button per screen. Everything else
  is a text link with underline-on-hover. Verb-first button copy.
- **No emoji anywhere in the UI.** No decorative icons. No fake phone frames.
- **Honest data only:** never render fake friends, fake leaderboards, or mocked
  prices as if real. If data is unavailable, say so plainly.
- **Copy:** plain, specific, confident. No hype, no "lessgo", no filler.
  Errors say what went wrong and what to do.

## Workflow rules
- Run `npm test` and `node --check` on the extracted front-end script before
  claiming a change works; smoke-test `node server.js` + `curl /api/health`.
- Commit messages describe the change; end with the Claude co-author line.
- After pushing, deploy with `railway up --ci` and verify the live URL serves
  the new markers (grep the served HTML) plus `/api/health` and `/api/live`.
- Never add npm dependencies without an explicit decision — zero-dep is a
  feature of this repo.
