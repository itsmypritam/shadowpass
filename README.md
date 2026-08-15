<div align="center">

# 🌙 ShadowPass

### Privacy-first eligibility verification on **Midnight**

<img width="1843" height="906" alt="1111" src="https://github.com/user-attachments/assets/ade5bc9d-89be-47df-bb43-c121f7d8a1c5" />
<img width="1710" height="602" alt="22222" src="https://github.com/user-attachments/assets/afb89164-baa5-410d-b99c-e0ffee08d7ba" />
**Prove `score ≥ requirement` in zero knowledge — publish only the boolean.**

<img width="1865" height="795" alt="contract midnight1" src="https://github.com/user-attachments/assets/eb9b672f-7a62-4f24-81d6-11d89b59e9e2" />

ShadowPass is a privacy-first eligibility gate (the **Age / Eligibility Gate**
challenge) built on the Midnight network. A user proves that a private value
meets a public threshold inside a **Compact** zero-knowledge circuit, and the
ledger records exactly one disclosed boolean — `lastResult`. The private score
never touches the chain, the API server, or even the proof itself. Anyone can
verify the result on-chain; **nobody can see the reason**.

[![CI](https://github.com/itsmypritam/shadowpass/actions/workflows/ci.yml/badge.svg)](https://github.com/itsmypritam/shadowpass/actions/workflows/ci.yml)
[![Live demo](https://img.shields.io/badge/demo-live-0fbcb0?logo=vercel)](https://repaint-stingily-nutlike.ngrok-free.dev)
[![Static build](https://img.shields.io/badge/static-build-4262ff)](https://shadowpass-wheat.vercel.app)
[![License: MIT](https://img.shields.io/badge/license-MIT-050038)](LICENSE)

---

</div>

## Table of contents

- [Why ShadowPass](#why-shadowpass)
- [Key features](#key-features)
- [Privacy model](#privacy-model)
- [Live demo](#live-demo)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Quick start (local devnet)](#quick-start-local-devnet)
- [Deploy to a public network](#deploy-to-a-public-network)
- [Testing](#testing)
- [CI/CD](#cicd)
- [Deployment](#deployment)
- [Project structure](#project-structure)
- [Product proposal](#product-proposal)
- [Submission checklist](#submission-checklist)
- [License](#license)

---

## Why ShadowPass

Every day, users are asked to prove a fact about themselves — *"I'm old
enough"*, *"I meet the income threshold"*, *"my score qualifies"* — by revealing
the **entire** underlying value. A nightclub asks for a birth date to check age
21. A lender asks for full income to check a minimum. The unboxed value leaks far
more than the single fact being checked.

ShadowPass inverts that. With one boolean published on the Midnight ledger and a
zero-knowledge proof backing it, a user can prove *"I exceed the threshold"*
while keeping the value itself fully private — and the claim is
cryptographically verifiable by anyone, not merely trusted.

> **Chosen challenge idea:** *Age / Eligibility Gate — prove a threshold without
> revealing the underlying value.* Full proposal in [`PROPOSAL.md`](PROPOSAL.md).

---

## Key features

| | Feature | Detail |
| --- | --- | --- |
| 🔐 | **Zero-knowledge threshold proof** | A Compact circuit *asserts* `score ≥ requirement` inside the proof; the score never leaves it |
| 👁️ | **Selective disclosure** | `disclose()` reveals only the boolean result — deliberate, minimal, auditable |
| ⚖️ | **Cheat-proof by construction** | A false claim fails the circuit and the transaction is rejected on-chain (tested) |
| 🧾 | **Transparent ledger** | `requirement`, `verificationCount`, `lastResult` are public; every proof re-verifiable on-chain |
| 🌐 | **Two proving paths** | Browser proving via the **Lace** wallet (static build) and a server-side Node wallet (interactive demo) |
| 🧪 | **9 passing tests** | Pure testkit suite — no blockchain required; runs in CI on every push |
| 🚀 | **CI/CD** | Compact compile → typecheck → tests → production build on every push |
| 📦 | **Static, backend-less deploy** | Reads state straight from the public indexer; proving runs in the browser |

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
single boolean. The circuit *asserts* the comparison — `if (claimedEligible)
{ require(score >= requirement) }` — so a false claim fails the proof and is
rejected on-chain. You can't even "cheat" by recording a wrong result.

The contract source of truth is
[`contract/shadow-pass.compact`](contract/shadow-pass.compact) — public ledger
state, private witness, and deliberate `disclose()` usage are all documented
inline.

---

## Live demo

<p align="center">
  <strong>
    <a href="https://repaint-stingily-nutlike.ngrok-free.dev">repaint-stingily-nutlike.ngrok-free.dev</a>
    &nbsp;·&nbsp;
    <a href="https://shadowpass-wheat.vercel.app">shadowpass-wheat.vercel.app</a>
  </strong>
</p>

The interactive demo runs against a **permanently deployed contract on the
Midnight Preview testnet**, exposed through a public tunnel, with all proving
done server-side by the funded Node wallet:

1. Open the link (ngrok free tier shows a one-time "Visit Site" interstitial —
   click through).
2. Pick the result you want recorded and enter your **private** score.
3. The server-side wallet proves `score >= requirement` in a zero-knowledge
   circuit — only the boolean is published to the ledger.
4. On-chain state updates instantly; watch `verificationCount` climb and verify
   the transaction on the public explorer.

https://github.com/user-attachments/assets/3008f9f1-8390-4ccc-8379-6909922d69c2

A **hosted, backend-less build** of the frontend reads state from the public
Preview indexer and proves entirely in your browser via Lace:
[**shadowpass-wheat.vercel.app**](https://shadowpass-wheat.vercel.app).

### Live contract

| Network | Contract address |
| --- | --- |
| Preview | `e5a0ea30513a2e1da27ff18a47865a0d7e63ccd73771320170c6e1befda51f69` |

Verify on the
[Midnight block explorer](https://preview.midnightexplorer.com/contracts/e5a0ea30513a2e1da27ff18a47865a0d7e63ccd73771320170c6e1befda51f69)
(`Preview` network) — the ledger shows only `requirement`, `verificationCount`,
and `lastResult`.

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
   static (Vercel demo)    │          └─ DApp Connector API (Lace, preview)
   ┌───────────────────────┘
   │
   ▼
┌─────────────────────────────┐     ┌──────────────────────────────┐
│  API server (src/server.ts) │     │  Midnight network            │
│  · Node wallet (server-side │     │  · node / indexer / proof    │
│    verify fallback)         │     │  · compiled contract on-ledger│
└──────────────┬──────────────┘     └──────────────────────────────┘
               │ local devnet / preview indexers & proof servers
```

- **`contract/shadow-pass.compact`** — the Midnight circuit. Public ledger:
  `requirement`, `verificationCount`, `lastResult`. One transaction type:
  `verifyEligibility(claimedEligible, score)` where `score` is a private witness.
- **`managed/`** — compiler output (JS contract + ZK keys + zkir), committed so
  the frontend can be built on hosts without the compact compiler.
- **`src/server.ts`** — Node API (`/api/contract`, `/api/verify`). Server-side
  verify fallback for local dev; the hosted demo runs without it.
- **`src/lace.ts` + `src/browser-contract.ts`** — Lace DApp Connector adapters:
  wallet discovery/connect, in-memory private state, browser proof + submission.
- **`src/zk-assets-plugin.ts`** — serves/embeds the ZK artifacts over `/zk/`.

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Smart contract | **Compact** (`compact` compiler, pragma ≥ 0.23) |
| Blockchain | **Midnight** network (Preview / Preprod / local devnet) |
| SDK | **Midnight.js** — `dapp-connector-api`, `midnight-js-*` (4.x) |
| Wallet | **Lace** (DApp Connector API) |
| Frontend | React 18 + Vite 5 + TypeScript |
| Backend (dev) | Node 22 + `tsx` |
| Proof server | Docker Compose (`docker compose up -d`) |
| Testing | Vitest + `testkit-js` |
| CI | GitHub Actions (`setup-compact-action`) |

---

## Quick start (local devnet)

Requirements: **Node 22+**, **Docker** (Compose v2). The compact compiler is
only needed for recompiling the contract (CI does this for you).

```bash
npm install
npm run setup        # starts devnet, compiles, deploys, funds genesis wallet
npm run test         # 9 contract tests, pure testkit — no chain needed
npm run dev          # API server (:3000) + Vite UI (:5173) together
```

Open http://localhost:5173 — the page connects to your local devnet contract.
Lace can also be used against the local devnet: create a Midnight network in
Lace pointing at `ws://localhost:9944`,
`http://localhost:8088/api/v4/graphql` (indexer), `http://localhost:6300`
(proof server).

> The local devnet wallet uses a well-known genesis seed (`…0001`) that is
> pre-minted by the dev chain preset. **Do not use that seed against Preprod,
> mainnet, or anything handling real value.**

### Run it in two terminals (alternative to `npm run dev`)

```bash
npm run server       # API on http://127.0.0.1:3000
npm run dev:ui       # Vite dev server on http://localhost:5173 (proxies /api)
```

---

## Deploy to a public network

```bash
npm run network preview
npm run setup -- --network preview
```

`setup` generates a fresh BIP-39 wallet (24-word phrase, printed once — back it
up; it restores the same wallet in Lace), prints your address, and polls the
faucet. Fund the address from the
[Midnight Preview faucet](https://midnight-tmnight-preview.nethermind.dev).
The deploy address is recorded in `.midnight-state.json` (gitignored).

For **Preprod**, use `npm run network preprod` and the
[Preprod faucet](https://midnight-tmnight-preprod.nethermind.dev) instead.

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

```text
✓ tests/shadow-pass.test.ts (9 tests) 182ms

 Test Files  1 passed (1)
      Tests  9 passed (9)
```

---

## CI/CD

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push and
pull request:

1. installs the pinned **compact compiler** (`midnightntwrk/setup-compact-action`)
2. `npm install` → `npm run compile` → typecheck (server + frontend) →
   `npm test` → `vite build`
3. uploads the built frontend as a workflow artifact

Status: [![CI](https://github.com/itsmypritam/shadowpass/actions/workflows/ci.yml/badge.svg)](https://github.com/itsmypritam/shadowpass/actions/workflows/ci.yml)

---

## Deployment

<img width="1892" height="853" alt="ci" src="https://github.com/user-attachments/assets/a05b7432-b541-4760-ab53-8e0754243357" />

- **Frontend**: `vercel.json` builds `src/` with Vite. Set the `VITE_*` vars
  below in the Vercel project and deploy — the build is fully static.

| Variable | Purpose |
| --- | --- |
| `VITE_CONTRACT_ADDRESS` | `e5a0ea30513a2e1da27ff18a47865a0d7e63ccd73771320170c6e1befda51f69` (Preview) |
| `VITE_NETWORK_ID` | `preview` |
| `VITE_INDEXER_URI` | `https://indexer.preview.midnight.network/api/v4/graphql` |
| `VITE_INDEXER_WS_URI` | `wss://indexer.preview.midnight.network/api/v4/graphql/ws` |

Without `VITE_CONTRACT_ADDRESS` the app runs in dev mode against `/api` (local
server). With it, the app runs in **static mode**: contract state is read
straight from the indexer and verification happens entirely in the browser.

---

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
├── PROPOSAL.md                    # Age / Eligibility Gate product proposal
├── PROPOSAL_L4.md                 # Level 4 Confidential Credentials proposal
└── vercel.json                    # static hosting config
```

---

## Product proposal

See [`PROPOSAL.md`](PROPOSAL.md) for the full **Age / Eligibility Gate** product
proposal: problem, solution, privacy design, and roadmap. A follow-up
**Confidential Credentials** proposal for the next level lives in
[`PROPOSAL_L4.md`](PROPOSAL_L4.md).

---

## Submission checklist

- **Public GitHub repository with a complete README** —
  [github.com/itsmypritam/shadowpass](https://github.com/itsmypritam/shadowpass)
- **Live demo link** — [shadowpass-wheat.vercel.app](https://shadowpass-wheat.vercel.app)
  (Vercel, static build against the Preview indexer).
- **Screenshot: test output (3+ tests passing)** — `npm test` runs 9 Vitest
  cases; all pass (see [Testing](#testing)). Also visible in any green
  **CI → "Typecheck, tests & build"** run in
  [Actions](https://github.com/itsmypritam/shadowpass/actions).
- **CI/CD badge or workflow file with passing runs** —
  [![CI](https://github.com/itsmypritam/shadowpass/actions/workflows/ci.yml/badge.svg)](https://github.com/itsmypritam/shadowpass/actions/workflows/ci.yml) —
  see [CI/CD](#cicd).
- **Demo video (1 minute) showing full functionality** — *(link the recorded
  video here)*. Walkthrough: generate an eligibility proof for a high score
  (server-wallet verify, proof server, on-chain result on Preview), then a
  rejected false claim, and the browser static-mode entry via the indexer.
- **README "privacy model" section: what an observer can and cannot learn** —
  see [Privacy model](#privacy-model).
- **Product proposal (from the idea list) submitted for approval** — the
  Age / Eligibility Gate idea, in [`PROPOSAL.md`](PROPOSAL.md).
- **Minimum 10 meaningful commits** — see the
  [commit history](https://github.com/itsmypritam/shadowpass/commits/main).

---

## License

MIT — see [`LICENSE`](LICENSE).
