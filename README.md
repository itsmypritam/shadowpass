<div align="center">

# ShadowPass

### Privacy-first eligibility verification on **Midnight**

<img width="1843" height="906" alt="1111" src="https://github.com/user-attachments/assets/ade5bc9d-89be-47df-bb43-c121f7d8a1c5" />
<img width="1710" height="602" alt="22222" src="https://github.com/user-attachments/assets/afb89164-baa5-410d-b99c-e0ffee08d7ba" />
**Prove `score >= requirement` in zero knowledge -- publish only the boolean.**

<img width="1865" height="795" alt="contract midnight1" src="https://github.com/user-attachments/assets/eb9b672f-7a62-4f24-81d6-11d89b59e9e2" />

ShadowPass is a privacy-first eligibility gate built on the Midnight network. A
user proves that a private value meets a public threshold inside a **Compact**
zero-knowledge circuit, and the ledger records exactly one disclosed boolean --
`lastResult`. The private score never touches the chain, the API server, or even
the proof itself. Anyone can verify the result on-chain; **nobody can see the
reason**.

[![CI](https://github.com/itsmypritam/shadowpass/actions/workflows/ci.yml/badge.svg)](https://github.com/itsmypritam/shadowpass/actions/workflows/ci.yml)
[![Live demo](https://img.shields.io/badge/demo-live-0fbcb0?logo=vercel)](https://shadowpass-wheat.vercel.app)
[![License: MIT](https://img.shields.io/badge/license-MIT-050038)](LICENSE)
[![Follow on X](https://img.shields.io/badge/follow-%40ShadowPassHQ-1DA1F2?logo=x&logoColor=white)](https://x.com/ShadowPassHQ)

---

</div>

## Table of contents

- [Why ShadowPass](#why-shadowpass)
- [Key features](#key-features)
- [Privacy model](#privacy-model)
- [Live demo](#live-demo)
- [User onboarding guide](#user-onboarding-guide)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Quick start (local devnet)](#quick-start-local-devnet)
- [Deploy to a public network](#deploy-to-a-public-network)
- [Testing](#testing)
- [CI/CD](#cicd)
- [Deployment](#deployment)
- [Project structure](#project-structure)
- [Feedback](#feedback)
- [Product proposal](#product-proposal)
- [Preprod users](#preprod-users)
- [Roadmap](#roadmap)
- [Submission checklist](#submission-checklist)
- [License](#license)

---

## Why ShadowPass

Every day, users are asked to prove a fact about themselves -- *"I'm old
enough"*, *"I meet the income threshold"*, *"my score qualifies"* -- by revealing
the **entire** underlying value. A nightclub asks for a birth date to check age
21. A lender asks for full income to check a minimum. The unboxed value leaks far
more than the single fact being checked.

ShadowPass inverts that. With one boolean published on the Midnight ledger and a
zero-knowledge proof backing it, a user can prove *"I exceed the threshold"*
while keeping the value itself fully private -- and the claim is
cryptographically verifiable by anyone, not merely trusted.

> **Challenge idea:** *Age / Eligibility Gate -- prove a threshold without
> revealing the underlying value.* Full proposal in [`PROPOSAL.md`](PROPOSAL.md).

---

## Key features

| | Feature | Detail |
| --- | --- | --- |
| | **Zero-knowledge threshold proof** | A Compact circuit *asserts* `score >= requirement` inside the proof; the score never leaves it |
| | **Selective disclosure** | `disclose()` reveals only the boolean result -- deliberate, minimal, auditable |
| | **Cheat-proof by construction** | A false claim fails the circuit and the transaction is rejected on-chain (tested) |
| | **Transparent ledger** | `requirement`, `verificationCount`, `lastResult` are public; every proof re-verifiable on-chain |
| | **Two proving paths** | Browser proving via the **Lace** wallet (static build) and a server-side Node wallet (interactive demo) |
| | **9 passing tests** | Pure testkit suite -- no blockchain required; runs in CI on every push |
| | **CI/CD** | Compact compile -> typecheck -> tests -> production build on every push |
| | **Static, backend-less deploy** | Reads state straight from the public indexer; proving runs in the browser |

---

## Privacy model

What an **observer** can and cannot learn from ShadowPass:

| Data | Visibility | Where it lives |
| --- | --- | --- |
| Eligibility score | **Private** | Inside the zero-knowledge proof -- never stored anywhere |
| Claimed result | Public | Ledger field `lastResult` (a boolean) |
| Eligibility rule | Public | Ledger field `requirement` -- readable by anyone |
| Verification count | Public | Ledger counter `verificationCount` |
| Proof of claim | Public | Verified on-chain -- anyone can re-check every recorded result |

**What an observer can learn:** that *some* party made a claim, what boolean it
was, how many verifications have ever happened, and the public rule. That's all.

**What an observer cannot learn:** the private score, any bound on it beyond the
rule, the identity linking the claimer to their score, or any history beyond the
single boolean. The circuit *asserts* the comparison -- `if (claimedEligible)
{ require(score >= requirement) }` -- so a false claim fails the proof and is
rejected on-chain. You can't even "cheat" by recording a wrong result.

The contract source of truth is
[`contract/shadow-pass.compact`](contract/shadow-pass.compact) -- public ledger
state, private witness, and deliberate `disclose()` usage are all documented
inline.

---

## Live demo

<p align="center">
  <strong>
    <a href="https://shadowpass-wheat.vercel.app">shadowpass-wheat.vercel.app</a>
  </strong>
</p>

### How it works

1. Open the [live demo](https://shadowpass-wheat.vercel.app).
2. Install [Lace](https://lace.io) and connect your Midnight wallet (Preprod
   network).
3. Pick the result you want recorded and enter your **private** score.
4. The circuit proves `score >= requirement` in zero knowledge -- only the
   boolean is published to the ledger.
5. On-chain state updates instantly; verify the transaction on the public
   [block explorer](https://preview.midnightexplorer.com).

### Live contract

| Network | Contract address |
| --- | --- |
| Preview | `e5a0ea30513a2e1da27ff18a47865a0d7e63ccd73771320170c6e1befda51f69` |

Verify on the
[Midnight block explorer](https://preview.midnightexplorer.com/contracts/e5a0ea30513a2e1da27ff18a47865a0d7e63ccd73771320170c6e1befda51f69)
-- the ledger shows only `requirement`, `verificationCount`,
and `lastResult`.

---

## User onboarding guide

ShadowPass is live on the Midnight **Preprod** network. Here is how to try it:

### Prerequisites

1. **Install Lace wallet** -- download from [lace.io](https://lace.io) and
   create a new Midnight wallet or import your existing one.
2. **Switch to Preprod** -- open Lace settings, select the Preprod network.
3. **Get test tokens** -- visit the
   [Midnight Preprod faucet](https://midnight-tmnight-preprod.nethermind.dev)
   and request tNIGHT for your wallet address.
4. **Get DUST** -- in Lace, go to Receive -> Dust Generator to convert some
   tNIGHT into DUST (required for transaction fees).

### Try the demo

1. Go to [shadowpass-wheat.vercel.app](https://shadowpass-wheat.vercel.app).
2. Click **Connect Lace** and approve the connection in the Lace popup.
3. Ensure your wallet is on the **Preprod** network.
4. Select **Eligible** or **Not eligible** and enter your private score
   (e.g. 85).
5. Click **Verify in zero knowledge (browser)** -- the circuit runs locally,
   proving `score >= requirement` without revealing the score.
6. Confirm the transaction in Lace. The on-chain result updates in seconds.

### What happens under the hood

- Your score never leaves your browser. The zero-knowledge circuit proves the
  comparison entirely client-side.
- Lace signs and submits the transaction. Only the boolean result and a proof
  are published to the Midnight ledger.
- Anyone can verify the result on the
  [block explorer](https://preview.midnightexplorer.com) -- but nobody can see
  your score.

### Troubleshooting

- **"Dust balance is 0"** -- generate DUST in Lace (Receive -> Dust Generator).
- **Wallet network mismatch** -- switch Lace to Preprod and reconnect.
- **Proof server unavailable** -- the browser path requires no proof server;
  ensure you selected "Lace browser wallet" as the verify path.

---

## Architecture

```
                    +-----------------------------+
                    |  Browser (React + Vite)     |
                    |  - read ledger via indexer  |
                    |  - prove in-browser (Lace)  |
                    |  - Lace signs + submits     |
                    +------+----------+-----------+
                           |          |
   static (Vercel demo)    |          +- DApp Connector API (Lace, preview)
   +-----------------------+
   |
   v
+-----------------------------+     +------------------------------+
|  API server (src/server.ts) |     |  Midnight network            |
|  - Node wallet (server-side |     |  - node / indexer / proof    |
|    verify fallback)         |     |  - compiled contract on-ledger|
+--------------+--------------+     +------------------------------+
               | local devnet / preview indexers & proof servers
```

- **`contract/shadow-pass.compact`** -- the Midnight circuit. Public ledger:
  `requirement`, `verificationCount`, `lastResult`. One transaction type:
  `verifyEligibility(claimedEligible, score)` where `score` is a private witness.
- **`managed/`** -- compiler output (JS contract + ZK keys + zkir), committed so
  the frontend can be built on hosts without the compact compiler.
- **`src/server.ts`** -- Node API (`/api/contract`, `/api/verify`). Server-side
  verify fallback for local dev; the hosted demo runs without it.
- **`src/lace.ts` + `src/browser-contract.ts`** -- Lace DApp Connector adapters:
  wallet discovery/connect, in-memory private state, browser proof + submission.
- **`src/zk-assets-plugin.ts`** -- serves/embeds the ZK artifacts over `/zk/`.

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Smart contract | **Compact** (`compact` compiler, pragma >= 0.23) |
| Blockchain | **Midnight** network (Preview / Preprod / local devnet) |
| SDK | **Midnight.js** -- `dapp-connector-api`, `midnight-js-*` (4.x) |
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
npm run test         # 9 contract tests, pure testkit -- no chain needed
npm run dev          # API server (:3000) + Vite UI (:5173) together
```

Open http://localhost:5173 -- the page connects to your local devnet contract.
Lace can also be used against the local devnet: create a Midnight network in
Lace pointing at `ws://localhost:9944`,
`http://localhost:8088/api/v4/graphql` (indexer), `http://localhost:6300`
(proof server).

> The local devnet wallet uses a well-known genesis seed (`...0001`) that is
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

`setup` generates a fresh BIP-39 wallet (24-word phrase, printed once -- back it
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
testkit -- no blockchain or proof server required:

- initialization of the public rule and empty ledger
- eligible / not-eligible transitions at and around the threshold
- **rejection** of a false claim (score below rule) -- the circuit refuses to
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
2. `npm install` -> `npm run compile` -> typecheck (server + frontend) ->
   `npm test` -> `vite build`
3. uploads the built frontend as a workflow artifact

Status: [![CI](https://github.com/itsmypritam/shadowpass/actions/workflows/ci.yml/badge.svg)](https://github.com/itsmypritam/shadowpass/actions/workflows/ci.yml)

---

## Deployment

<img width="1892" height="853" alt="ci" src="https://github.com/user-attachments/assets/a05b7432-b541-4760-ab53-8e0754243357" />

- **Frontend**: `vercel.json` builds `src/` with Vite. Set the `VITE_*` vars
  below in the Vercel project and deploy -- the build is fully static.

| Variable | Purpose |
| --- | --- |
| `VITE_CONTRACT_ADDRESS` | Contract address on the target network |
| `VITE_NETWORK_ID` | `preview` or `preprod` |
| `VITE_INDEXER_URI` | Indexer HTTP GraphQL endpoint |
| `VITE_INDEXER_WS_URI` | Indexer WebSocket GraphQL endpoint |

Without `VITE_CONTRACT_ADDRESS` the app runs in dev mode against `/api` (local
server). With it, the app runs in **static mode**: contract state is read
straight from the indexer and verification happens entirely in the browser.

---

## Project structure

```
+-- contract/shadow-pass.compact   # the Midnight circuit (source of truth)
+-- managed/                       # compiler output (committed)
+-- tests/                         # 9 contract tests + testkit simulator
+-- scripts/                       # network/wallet/deploy/setup/cli/e2e/dev
+-- src/
|   +-- App.tsx, styles.css        # React UI
|   +-- lace.ts                    # Lace discovery + connect
|   +-- browser-contract.ts        # browser providers + verify + public read
|   +-- zk-assets-plugin.ts        # Vite /zk artifact serving + copy
|   +-- server.ts                  # Node API (dev-mode fallback)
|   +-- vite.config.ts             # Vite (wasm, top-level-await, zk plugin)
+-- .github/workflows/ci.yml       # compile + test + build on every push
+-- PROPOSAL.md                    # Age / Eligibility Gate product proposal
+-- PROPOSAL_L4.md                 # Level 4 Confidential Credentials proposal
+-- preprod-users.json             # Preprod user wallet tracking + feedback
+-- vercel.json                    # static hosting config
```

---
--------

##Twitter /X 
link - > https://x.com/Shadowpassmid

tweet -> https://x.com/Shadowpassmid/status/2090427851397058971?s=20
-----------
## Feedback

We collect structured user feedback to improve ShadowPass. After trying the
demo, submit your experience via the in-app feedback form at the bottom of the
page, or directly through the API:

```bash
curl -X POST http://localhost:3000/api/feedback \
  -H 'Content-Type: application/json' \
  -d '{"walletAddress":"mn1q...","rating":5,"useCase":"age verification","comment":"Works great!"}'
```

Feedback fields:
- **rating** (1-5): Overall experience
- **useCase**: How you are using ShadowPass
- **comment**: Open-ended feedback
- **walletAddress**: Your Preprod wallet address (for user tracking)

All feedback is stored in [`preprod-users.json`](preprod-users.json) and
reviewed for each product iteration.

---

## Product proposal

See [`PROPOSAL.md`](PROPOSAL.md) for the full **Age / Eligibility Gate** product
proposal: problem, solution, privacy design, and roadmap. A follow-up
**Confidential Credentials** proposal for the next level lives in
[`PROPOSAL_L4.md`](PROPOSAL_L4.md).

---

## Preprod users

ShadowPass is live on **Preprod**. Users who have connected their wallets and
submitted verifications are tracked in
[`preprod-users.json`](preprod-users.json).

To register as a Preprod user:
1. Connect your Lace wallet to the Preprod network
2. Visit [shadowpass-wheat.vercel.app](https://shadowpass-wheat.vercel.app)
3. Complete a zero-knowledge verification
4. Submit feedback via the in-app form

The wallet address is recorded on-chain via the verification transaction and
verifiable on the [Midnight block explorer](https://preview.midnightexplorer.com).

---

## Roadmap

| Phase | Goal | Status |
| --- | --- | --- |
| 1 | Local devnet + server-side prove/verify | Done |
| 2 | Browser proving with Lace | Done |
| 3 | Preprod deployment, static live demo, CI/CD, tests, docs | Done |
| 4 | Confidential Credentials -- issue/verify/revoke credential system | In progress |
| 5 | 50 Preprod users, feedback loop, production polish | In progress |

---

## Submission checklist

- **Public GitHub repository with full documentation** --
  [github.com/itsmypritam/shadowpass](https://github.com/itsmypritam/shadowpass)
- **Live demo link** --
  [shadowpass-wheat.vercel.app](https://shadowpass-wheat.vercel.app)
- **Preprod contract address** -- verifiable on the
  [Midnight block explorer](https://preview.midnightexplorer.com)
- **CI/CD badge** --
  [![CI](https://github.com/itsmypritam/shadowpass/actions/workflows/ci.yml/badge.svg)](https://github.com/itsmypritam/shadowpass/actions/workflows/ci.yml)
- **Product X profile** --
  [@ShadowPassHQ](https://x.com/ShadowPassHQ) -- linked in README
- **Demo video** -- full MVP walkthrough (browser prove + on-chain result)
- **Feedback loop** -- structured feedback collection via API + in-app form
- **Preprod user tracking** --
  [`preprod-users.json`](preprod-users.json)
- **Minimum meaningful commits** -- 36+
  [commits](https://github.com/itsmypritam/shadowpass/commits/main)

---

## License

MIT -- see [`LICENSE`](LICENSE).
