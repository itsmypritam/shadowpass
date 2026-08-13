# ShadowPass

> **Age / Eligibility Gate** — prove a threshold without revealing the underlying value.

ShadowPass is a privacy-first eligibility verifier on **Midnight**. It proves
`score >= requirement` inside a **zero-knowledge circuit** and publishes exactly
one boolean on the ledger — `lastResult`. The private score never touches the
chain, the API server, or even the proof itself. Anyone can verify the result
on-chain; nobody can see the reason.

Chosen problem from the challenge list: **Age / Eligibility Gate** — "prove a
threshold without revealing the underlying value."

[![CI](https://github.com/itsmypritam/shadowpass/actions/workflows/ci.yml/badge.svg)](https://github.com/itsmypritam/shadowpass/actions/workflows/ci.yml)
[![Live demo](https://img.shields.io/badge/demo-live-0fbcb0?logo=vercel)](https://repaint-stingily-nutlike.ngrok-free.dev)
[![License](https://img.shields.io/badge/license-MIT-050038)](LICENSE)

---

## Live demo

<p align="center">
  <a href="https://repaint-stingily-nutlike.ngrok-free.dev"><strong>repaint-stingily-nutlike.ngrok-free.dev</strong></a>
</p>

The interactive demo runs against a **permanently deployed contract on the
Midnight Preview testnet**, exposed through a public tunnel, with all proving
done server-side by the funded Node wallet:

1. Open the link (ngrok free tier shows a one-time "Visit Site" interstitial —
   click through).
2. Pick the result you want recorded and enter your **private** score.
3. The server-side wallet proves `score >= requirement` in a zero-knowledge
   circuit — only the boolean is published to the ledger.
4. On-chain state updates instantly; you can watch `verificationCount` climb and
   verify the transaction on the public explorer.

The live contract on **Midnight Preview**:
`e5a0ea30513a2e1da27ff18a47865a0d7e63ccd73771320170c6e1befda51f69`
(verify with the [Midnight block explorer](https://explorer.midnight.network) —
`Preview` network).

A hosted, backend-less build of the frontend (reads state from the public
Preview indexer; verifying runs in your browser via Lace) is deployed at
[**shadowpass-wheat.vercel.app**](https://shadowpass-wheat.vercel.app).

To run the interactive demo yourself: start Docker, run `npm run setup`, then
`npm run dev`.

### Live contract

| Network | Contract address |
| --- | --- |
| Preprod | `PLACEHOLDER_PREPROD_ADDRESS` |

Verify on [explorer.devnet.midnight.network](https://explorer.devnet.midnight.network) —
the ledger shows only `requirement`, `verificationCount`, and `lastResult`.

---

## Privacy model

What an **observer** can and cannot learn from ShadowPass:

| Data | Visibility | Where it lives |
| --- | --- | --- |
| Eligibility score | **Private** | Inside the zero-knowledge proof — never stored anywhere |
| Claimed result | Public | Ledger field `lastResult` (a boolean) |
| Eligibility rule | Public | Ledger field `requirement` — readable by anyone |
| Verification count | Public | Ledger counter `verificationCount` |
| Proof of claim | Public | Verified on-chain — anyone can re-check every recorded result |

**What an observer can learn:** that *some* party made a claim, what boolean it
was, how many verifications have ever happened, and the public rule. That's all.

**What an observer cannot learn:** the private score, any bound on it beyond the
rule, the identity linking the claimer to their score, or any history beyond the
single boolean. The circuit *asserts* the comparison (`if (claimedEligible)
{ require(score >= requirement) }`), so a false claim fails the proof and is
rejected on-chain — you can't even "cheat" by recording a wrong result.

The contract source of truth is [`contract/shadow-pass.compact`](contract/shadow-pass.compact).

---

## Architecture

```
                    ┌─────────────────────────────┐
                    │  Browser (React + Vite)     │
                    │  · read ledger via indexer  │
                    │  · prove in-browser (Lace)  │
                    │  · Lace signs + submits     │
                    └──────┬──────────┬───────────┘
                           │          │
   static (Vercel demo)    │          └─ DApp Connector API (Lace, preprod)
   ┌───────────────────────┘
   │
   ▼
┌─────────────────────────────┐     ┌──────────────────────────────┐
│  API server (src/server.ts) │     │  Midnight network            │
│  · Node wallet (server-side │     │  · node / indexer / proof    │
│    verify fallback)         │     │  · compiled contract on-ledger│
└──────────────┬──────────────┘     └──────────────────────────────┘
               │ local devnet / preprod indexers & proof servers
```

- **`contract/shadow-pass.compact`** — the Midnight circuit. Public ledger:
  `requirement`, `verificationCount`, `lastResult`. One transaction type:
  `verifyEligibility(claimedEligible, score)` where `score` is a private
  witness.
- **`managed/`** — compiler output (JS contract + ZK keys + zkir), committed so
  the frontend can be built on hosts without the compact compiler.
- **`src/server.ts`** — Node API (`/api/contract`, `/api/verify`). Server-side
  verify fallback for local dev; the hosted demo runs without it.
- **`src/lace.ts` + `src/browser-contract.ts`** — Lace DApp Connector adapters:
  wallet discovery/connect, in-memory private state, browser proof + submission.
- **`src/zk-assets-plugin.ts`** — serves/embeds the ZK artifacts over `/zk/`.

---

## Quick start (local devnet)

Requirements: Node 22+, Docker (Compose v2). The compact compiler is only
needed for recompiling the contract (CI does this for you).

```bash
npm install
npm run setup        # starts devnet, compiles, deploys, funds genesis wallet
npm run test         # 9 contract tests, pure testkit — no chain needed
npm run dev          # API server (:3000) + Vite UI (:5173) together
```

Open http://localhost:5173 — the page connects to your local devnet contract.
Lace can also be used against the local devnet: create a Midnight network in
Lace pointing at `ws://localhost:9944`, `http://localhost:8088/api/v4/graphql`
(indexer), `http://localhost:6300` (proof server).

> The local devnet wallet uses a well-known genesis seed (`…0001`) that is
> pre-minted by the dev chain preset. **Do not use that seed against Preprod,
> mainnet, or anything handling real value.**

### Run it in two terminals (alternative to `npm run dev`)

```bash
npm run server       # API on http://127.0.0.1:3000
npm run dev:ui       # Vite dev server on http://localhost:5173 (proxies /api)
```

---

## Deploy to Preprod

```bash
npm run network preprod
npm run setup -- --network preprod
```

`setup` generates a fresh BIP-39 wallet (24-word phrase, printed once — back it
up; it restores the same wallet in Lace), prints your address, and polls the
faucet. Fund the address from the [Midnight Preprod faucet](https://faucet.testnet.midnight.network/).
The deploy address is recorded in `.midnight-state.json` (gitignored).

Switch back to the local devnet any time with `npm run network undeployed`.

---

## Testing

```bash
npm test
```

Nine Vitest cases exercise the compiled contract through the compact-runtime
testkit — no blockchain or proof server required:

- initialization of the public rule and empty ledger
- eligible / not-eligible transitions at and around the threshold
- **rejection** of a false claim (score below rule) — the circuit refuses to
  prove it
- verifier-side re-check of a generated proof

## CI/CD

`.github/workflows/ci.yml` runs on every push and pull request:

1. installs the pinned **compact compiler** (`midnightntwrk/setup-compact-action`)
2. `npm ci` → `npm run compile` → typecheck (server + frontend) → `npm test` → `vite build`
3. uploads the built frontend as a workflow artifact

## Deployment

- **Frontend**: `vercel.json` builds `src/` with Vite. Set the `VITE_*` vars
  below in the Vercel project and deploy — the build is fully static.

| Variable | Purpose |
| --- | --- |
| `VITE_CONTRACT_ADDRESS` | Preprod contract address |
| `VITE_NETWORK_ID` | `preprod` |
| `VITE_INDEXER_URI` | `https://indexer.preprod.midnight.network/api/v4/graphql` |
| `VITE_INDEXER_WS_URI` | `wss://indexer.preprod.midnight.network/api/v4/graphql/ws` |

Without `VITE_CONTRACT_ADDRESS` the app runs in dev mode against `/api` (local
server). With it, the app runs in **static mode**: contract state is read
straight from the indexer and verification happens entirely in the browser.

## Project structure

```
├── contract/shadow-pass.compact   # the Midnight circuit (source of truth)
├── managed/                       # compiler output (committed)
├── tests/                         # 9 contract tests + testkit simulator
├── scripts/                       # network/wallet/deploy/setup/cli/e2e/dev
├── src/
│   ├── App.tsx, styles.css        # React UI (DESIGN.md)
│   ├── lace.ts                    # Lace discovery + connect
│   ├── browser-contract.ts        # browser providers + verify + public read
│   ├── zk-assets-plugin.ts        # Vite /zk artifact serving + copy
│   ├── server.ts                  # Node API (dev-mode fallback)
│   └── vite.config.ts             # Vite (wasm, top-level-await, zk plugin)
├── .github/workflows/ci.yml       # compile + test + build on every push
└── vercel.json                    # static hosting config
```

## Product proposal

See [`PROPOSAL.md`](PROPOSAL.md) for the full **Age / Eligibility Gate** product
proposal: problem, solution, privacy design, and roadmap.

## License

MIT
