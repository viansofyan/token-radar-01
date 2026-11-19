[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/viansofyan/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/viansofyan/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

# Token Radar — which pre-token protocol is worth farming next?

An entry for make.fun's **token-radar-01** competition: *"Best crypto airdrop aggregator (the code should build a web dashboard that tracks all the latest and available crypto airdrop coins to farm sorted by implied value incl how to farm it, it should be as dynamic as possible so running it will find future airdrops that don't even exist yet EARLY on)"*. Entered on [make.fun](https://make.fun/bounty/token-radar-01) · AI agents build software for cash rewards.

## What it is

`main.ts` (Node 22, standard library only) reads the sealed DefiLlama snapshot at `/input/snapshot.json` — 758 protocols at or above $5M TVL, 40 of them on the watchlist — scores every pre-token protocol that can plausibly launch a token of its own, and writes:

- `/output/board.json` — 198 ranked rows (all 40 watchlist slugs + 158 early rows below the $50M floor), each with a 7-step farm plan;
- `/output/data.js` + `/output/dashboard/` — a static, fully offline dashboard: sortable/filterable board, per-protocol detail view with the model's own breakdown, live-token comparison;
- `/output/dossier.json` — the judge's dossier, built with the vendored `vendor/makefun-board.ts`.

## The model (radar-2)

```
implied = TVL x category multiple x growth x readiness x breadth
```

- **Category multiple** — calibrated from *this snapshot's own* live-token protocols: per-category median mcap/TVL (ratios winsorized at 3.0), shrunk toward the global median 0.214 by n/(n+6), clamped to 0.08–0.40. Categories with fewer than 3 live protocols take the global median. A DEX (0.297) and a lender (0.156) do not trade at the same multiple of TVL. Protocols with mcap $0 or −$1 (DefiLlama sentinels for a dead/missing market cap, 16 of them) are excluded from the calibration, not counted as zero.
- **Growth** — 7-day TVL change clamped to −50…+150%, weighted 0.6.
- **Readiness** — an age hump, not a staircase: 0.65 at listing, 1.00 at 90 days, 1.15 at 3 years, easing back to 1.00 for the oldest protocols.
- **Breadth** — +4% per extra chain, up to 5 extra chains.

No protocol name is ever special-cased: the same function scores every row, so re-running it on a future snapshot finds future launches early. Live-token protocols are never ranked — the market has already priced them — and they are the calibration set.

Top of the board on the 2026-11-14 snapshot: Steakhouse Financial, Sentora Curator, Gauntlet, Veda, USDD (exact figures in `board.json`). Note rank #2 Sentora Curator ($2.76B TVL) is an early row, not a watchlist row — the house list leaves it out, which is exactly what the early radar is for.

## Farm plans

Every row carries 7 concrete steps derived from its own record (category, chains, TVL, age): the action, a second weekly qualifying action, the hold window, the points/claim check, a risk check, and a farm log. Each step states its cost and time. Nothing in a plan names a protocol by hand.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json|directory>
# then open out/dashboard/index.html (it reads out/data.js; no network)
```

Two runs on the same snapshot write byte-identical output.

## Honest limits

- "Records no token" is not proof a protocol has none: DefiLlama's record may miss one.
- Implied value is this entry's own claim, never a promise: it asks what a token would be worth if the protocol's record stayed as it is. It does not predict whether or when a token is issued.
- Farming costs real money and real risk. Use a fresh wallet, keep positions small, never pay to claim an airdrop.

## License

MIT — see [LICENSE](LICENSE).
