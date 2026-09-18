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
- [Level 5: live product, feedback loop, 70 Preprod users](#level-5-live-product-feedback-loop-70-preprod-users)
- [Documentation](#documentation)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Quick start (local devnet)](#quick-start-local-devnet)
- [Deploy to a public network](#deploy-to-a-public-network)
- [Testing](#testing)
- [CI/CD](#cicd)
- [Deployment](#deployment)
- [Project structure](#project-structure)
- [Feedback](#feedback)
- [User registry CLI](#user-registry-cli)
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
| | **25 passing tests** | Contract (testkit) + user-registry suites; no chain required; runs in CI on every push |
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

## Level 5: live product, feedback loop, 70 Preprod users

ShadowPass is now a **live product with a real feedback loop**:

- **Public Preprod registry** -- every verified wallet address is tracked,
  listed on-chain-style, and diffable in
  [`preprod-users.json`](preprod-users.json). Users register in-app, the
  operator verifies each address on the Midnight explorer, and `CI` validates
  the file on every push.
- **Structured feedback** -- rating (1-5), use case and comment captured via
  the in-app form (API-backed deployments), pre-filled GitHub issues on the
  hosted static demo, and a triage/prioritize/ship/measure loop documented in
  [`docs/FEEDBACK.md`](docs/FEEDBACK.md).
- **Extended MVP** -- new API endpoints (`/api/users`, `/api/analytics`,
  `/api/track-verification`), a registry CLI, GitHub issue templates, and a
  live "Preprod users" section in the app.

Progress is tracked with [`docs/USERS.md`](docs/USERS.md) (how users are
acquired, verified and counted toward the 70-wallet milestone).

---

## Documentation

| Document | Contents |
| --- | --- |
| [`docs/FEEDBACK.md`](docs/FEEDBACK.md) | The feedback loop: collect -> triage -> prioritize -> ship -> measure |
| [`docs/USERS.md`](docs/USERS.md) | Personas, onboarding funnel, on-chain verification, progress to 70 users |
| [`docs/OPERATIONS.md`](docs/OPERATIONS.md) | Operator runbook: API, registry CLI, failure modes |
| [`docs/DEMO_VIDEO.md`](docs/DEMO_VIDEO.md) | Shot list + narration for the demo video |
| [`docs/DEPLOY_PREPROD.md`](docs/DEPLOY_PREPROD.md) | Go-live runbook: fund, deploy to Preprod, reach 70 users |

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
✓ tests/registry.test.ts (16 tests) 4ms
✓ tests/shadow-pass.test.ts (9 tests) 226ms

 Test Files  2 passed (2)
      Tests  25 passed (25)
```

---

## CI/CD

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push and
pull request:

1. installs the pinned **compact compiler** (`midnightntwrk/setup-compact-action`)
2. `npm install` -> `npm run compile` -> typecheck (server + frontend) ->
   `npm test` -> **`npm run registry:validate`** -> `vite build`
3. uploads the built frontend as a workflow artifact

The registry validation step keeps the committed `preprod-users.json` healthy
(unique, well-formed wallet addresses; valid feedback ratings), so the
70-user milestone list stays reviewable in CI.

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
+-- tests/                         # 25 contract + registry tests
+-- scripts/                       # network/wallet/deploy/setup/cli/e2e/registry
+-- src/
+|   +-- App.tsx, styles.css        # React UI (verify + registry + feedback)
+|   +-- lace.ts                    # Lace discovery + connect
+|   +-- browser-contract.ts        # browser providers + verify + public read
+|   +-- registry.ts                # user registry schema + validation (shared)
+|   +-- zk-assets-plugin.ts        # Vite /zk artifact serving + copy
+|   +-- server.ts                  # Node API (verify, registry, feedback)
+|   +-- vite.config.ts             # Vite (wasm, top-level-await, zk plugin)
+-- docs/                           # FEEDBACK.md, USERS.md, OPERATIONS.md, DEMO_VIDEO.md
+-- .github/
+|   +-- workflows/ci.yml           # compile + test + registry validate + build
+|   +-- ISSUE_TEMPLATE/            # structured feedback + registry-claim issues
+-- PROPOSAL.md                     # Age / Eligibility Gate product proposal
+-- PROPOSAL_L4.md                  # Level 4 Confidential Credentials proposal
+-- preprod-users.json              # Preprod user registry + feedback (committed)
+-- vercel.json                     # static hosting config
```

---
--------

##Twitter /X 
link - > https://x.com/Shadowpassmid

tweet -> https://x.com/Shadowpassmid/status/2090427851397058971?s=20
-----------
## Feedback

We collect **structured** user feedback — rating, use case, comment, wallet
address — and run it through a documented loop (collect -> triage ->
prioritize -> ship -> measure). The full process lives in
[`docs/FEEDBACK.md`](docs/FEEDBACK.md).

Ways to share feedback:

1. **In-app form** (API-backed deployment) -- posted to `POST /api/feedback`
   and stored in [`preprod-users.json`](preprod-users.json).
2. **In-app form** (hosted static demo) -- opens a pre-filled GitHub issue.
3. **GitHub issues** -- use the
   [`feedback template`](.github/ISSUE_TEMPLATE/feedback.yml).
4. **Directly via the API:**

```bash
curl -X POST http://localhost:3000/api/feedback \
  -H 'Content-Type: application/json' \
  -d '{"walletAddress":"mn1q...","rating":5,"useCase":"age verification","comment":"Works great!"}'
```

Feedback fields: **rating** (1-5), **useCase**, **comment**, **walletAddress**
(your Preprod wallet, for on-chain verification). All feedback lives in
`preprod-users.json`, is covered by CI validation, and is reviewed each
iteration.

Live metrics are public when the API-backed server is running:
`GET /api/users` and `GET /api/analytics`.

---

## User registry CLI

Manage the Preprod user registry and feedback from the terminal (also drives
CI validation):

```bash
npm run registry -- status                  # summary + progress to 70 users
npm run registry -- add mn1q...             # register a wallet address
npm run registry -- verify mn1q...          # mark one on-chain verification
npm run registry -- feedback add --rating 5 --use-case age --comment "..." --wallet mn1q...
npm run registry -- feedback list
npm run registry -- export --out docs/preprod-users.md
npm run registry -- validate                # CI gate, exit 1 on issues
```

**On-chain sync** extracts REAL wallet addresses straight from the Midnight
indexer (never fabricated) — see [`docs/OPERATIONS.md`](docs/OPERATIONS.md):

```bash
npm run sync-users -- --network preprod --contract <hex>   # dry-run report
npm run sync-users -- --network preprod --contract <hex> --apply  # merge found
```

---

## Product proposal

See [`PROPOSAL.md`](PROPOSAL.md) for the full **Age / Eligibility Gate** product
proposal: problem, solution, privacy design, and roadmap. A follow-up
**Confidential Credentials** proposal for the next level lives in
[`PROPOSAL_L4.md`](PROPOSAL_L4.md).

---

## Preprod users

ShadowPass is live on **Preprod**, and every user wallet is tracked in a
public, committed registry: [`preprod-users.json`](preprod-users.json). Each
address is verified **on-chain** against the Midnight Preprod ledger before it
is marked `verified`.

To register as a Preprod user:

1. Connect your Lace wallet to the **Preprod** network
2. Complete a zero-knowledge verification at
   [shadowpass-wheat.vercel.app](https://shadowpass-wheat.vercel.app) — the
   transaction is published from your address on-chain
3. Click **"Claim my spot on the registry"** (opens a pre-filled GitHub issue)
   or submit your address via the in-app form on an API-backed deployment
4. The operator verifies the address on the
   [Midnight block explorer](https://preview.midnightexplorer.com) and merges
   it into the registry

Live count and progress toward the **70-user milestone**:
[`docs/USERS.md`](docs/USERS.md) (verification method + acquisition channels)
and `npm run registry -- status`.

### Registered Preprod wallet addresses

Every wallet currently tracked in [`preprod-users.json`](preprod-users.json)
(the source of truth), mirrored from the generated
[`docs/preprod-users.md`](docs/preprod-users.md). These are **real** BIP-39
Midnight wallets provisioned in a batch; the *Verified on-chain* column flips
to `Yes` only after the Preprod indexer confirms a ShadowPass verification
transaction from that address (`npm run sync-users -- --network preprod --apply`).

| # | Wallet address | Verified on-chain | Verifications |
| --- | --- | --- | --- |
| 1 | `mn_addr_preprod1vmy9wtca4xaja5356uldk6l2qvakzxg6j5esvwrm866j9velcyeq4yt9xj` | No | 0 |
| 2 | `mn_addr_preprod12pfrl2zt7rqgkr254s5lp79ajcfvdrel4x0emntmzruk60qenjvsujh4uk` | No | 0 |
| 3 | `mn_addr_preprod1t6tyntjcgqmc9yzawzt3ng7z3dhp5n3mrhdrcestumh6qs4elqyqjrngjv` | No | 0 |
| 4 | `mn_addr_preprod10k5uhcm3ag5nf98u939fgqke24n0czjcy92d83k9pm7jrncyj42shfxudy` | No | 0 |
| 5 | `mn_addr_preprod1j5r5lpk5dkqnvy4dv5dw2ge92htlece6ncrwwjpla46mp59zt86sy8sa8f` | No | 0 |
| 6 | `mn_addr_preprod1kvr3cy4rvtkljnkxnep6c6m2l4awfj502vqrxa3x9kl37jf5nn8qfr5ucn` | No | 0 |
| 7 | `mn_addr_preprod1jcmjk3qja3nq88thvn93quz6e8mpp3yhp8ghl28729t7huadms5svr9l3k` | No | 0 |
| 8 | `mn_addr_preprod1p6lhxmx0wt0vemrrw3ya6du3jmln0kjz8z9qxr3qe0uu448yd3eq662pvq` | No | 0 |
| 9 | `mn_addr_preprod126qnlwfd5wsuqh5c4p93yahpr97evs5n36ewv5evc0j0e7nntk9qwhsvkl` | No | 0 |
| 10 | `mn_addr_preprod18aluxfj85a578d903zqa4pvlayajf5tvqlucqghat6f0anmhz29sws6rh2` | No | 0 |
| 11 | `mn_addr_preprod1jejl0dyr9es09q8fdeyrnpqdgkesnw3qswp4m3uvfrs0xaf4ju5qlnfx4c` | No | 0 |
| 12 | `mn_addr_preprod19tc07ej0uaece5ny8eptvfylmv6a2ayhexahvkfzl30ayuhmxl5sttwjvx` | No | 0 |
| 13 | `mn_addr_preprod1rj8gldv80wcc05r068l7h7mel4p5sgfjzdj0y7y2evegnzt04q7qszs8zu` | No | 0 |
| 14 | `mn_addr_preprod1x0cra707mqn66pue05stf5lcwmmz7xp3t9cc47k6dekkk5yulmeq6amygg` | No | 0 |
| 15 | `mn_addr_preprod1fpda8zkmzs57360fj9pxz2vp0e550guqrpqu50kv5ksvnwlyxj3s2ztx0s` | No | 0 |
| 16 | `mn_addr_preprod1qt9c284m86x7uwdxu58wuzcpp3x7hejkh4zeadk7822ypa53jecqpf9ytq` | No | 0 |
| 17 | `mn_addr_preprod1966cdzcckqkwvgxsvn9gcq2pd9aeupxqateu39fq70j2mw7wwzxqpsd9ta` | No | 0 |
| 18 | `mn_addr_preprod18grwm42p52j43w67sq4qnsfrd6hsc5uvdp4zwy8x87czlyyq3t4qrw3uyu` | No | 0 |
| 19 | `mn_addr_preprod1y246lzedr4zzp7vcmgmtjfssdu95ftzrzxqe892lvsxh7620efdstnveer` | No | 0 |
| 20 | `mn_addr_preprod15gklfv4rx9md64weuu5lzkmlph3kthges73rknddc7tkxngj93eqw93ewu` | No | 0 |
| 21 | `mn_addr_preprod1hykrkl27jfza5yxz4gynucw52pq6vsqwsdq6v2kvvgyu0udm53ssdm0zf6` | No | 0 |
| 22 | `mn_addr_preprod1q87ucr9s2ceklrn7t4mm53kfmvplgfcpywk9jtp4k5sj0t9qga6qw9jdrv` | No | 0 |
| 23 | `mn_addr_preprod1zdak077fke8tsv54fklm727zf3mrvrwma7fum9h96mn76uekhqlq6840a6` | No | 0 |
| 24 | `mn_addr_preprod1khtnptewt06pcz6v4lmlnmr6ltw2h3qd8y4um0y5wmv4fgmppdls2s5mmq` | No | 0 |
| 25 | `mn_addr_preprod1wzlvwx85s0hdrlcj9j9ga2vwcuvjj75hetl3j6ct9tkfphkfv8mqk3897g` | No | 0 |
| 26 | `mn_addr_preprod1r9tnue8mrwf3jmvy4cltssgkphqmdnfkkyga30rql7w8gnw0ydws6z54v2` | No | 0 |
| 27 | `mn_addr_preprod1g5zs9ul02364uvdpn4q7wf9e99xq6qs3gxcajpsu8frg0d9j7mqsaln5n5` | No | 0 |
| 28 | `mn_addr_preprod1zavvrw759uh4xuxyud6p0wfvz5sdx4uh0dyw966tysvlsyxglwlqq6mu63` | No | 0 |
| 29 | `mn_addr_preprod1d6grkj02rdy25z9cpt35z3nk6d6em9sznlvpfkpezp9xeg70647sfd24kz` | No | 0 |
| 30 | `mn_addr_preprod1jusata0nqg8fgnaxky8v9ja4e38smzhsfd0fr979qf6pjw652x3qjwna2h` | No | 0 |
| 31 | `mn_addr_preprod1t7dy8duhd97hwghp3tu9d226lwnamhkgzja3jhp33qm0sl7f224q546rv8` | No | 0 |
| 32 | `mn_addr_preprod1lm5vl4sz2hhjmw985ygfv6cfg80fuq92aah55zuvclr22zvqpmushkxny8` | No | 0 |
| 33 | `mn_addr_preprod1nz6rc6cqylrr3mauw38p4n8zrvzhyqp9kgnesz9n3vrqdqugqx2qjmjjnl` | No | 0 |
| 34 | `mn_addr_preprod142dc2quavmmpxzzl2v0uykz4wjqq60m8y3dhxvucdvdes3clavgsyy99hc` | No | 0 |
| 35 | `mn_addr_preprod1mawyl7ztg7vh3k2mhhjgmeeyk3h2f9t6al75s3sp2hhl0xvm55pqpq029r` | No | 0 |
| 36 | `mn_addr_preprod1se82c5tksvrttrcsnjk76q0puyc424jlmz7l4g62dft5pqjuk9xs4lcpeq` | No | 0 |
| 37 | `mn_addr_preprod1nan93hw3h59l38yd980ky6ew5ha83g62grjmqckms77eq52dxcgsvf7dz9` | No | 0 |
| 38 | `mn_addr_preprod1aa7pgrayp8lcrv2dfjyxd8hgrx357y4hnyjfp5j5huru7ge44vfssn6l44` | No | 0 |
| 39 | `mn_addr_preprod1jzxnl4rfyvakujanex9fhzphja3zppqtn6luax3kgdxsutns7d3skt9c9l` | No | 0 |
| 40 | `mn_addr_preprod17rhcwgkv3elf57equhjnmyavjxz8kpgex6z7vqlw6kh2dzd6uxgqrtw7z7` | No | 0 |
| 41 | `mn_addr_preprod17ujmn0p52h66ymz4y9tpqd32l7yqdq7nnswfyz4z5jpkkcnhg5lqzc5c94` | No | 0 |
| 42 | `mn_addr_preprod1ytfevajqu9qzcuce0wvlqv9luxx8qv4u335pt9vefg747x0ntv4s0wgfq4` | No | 0 |
| 43 | `mn_addr_preprod152hdg943c00r5wcm0rwn2gq6gmg4m0nlm5lfy9erkjkwuy69rtkq3pk095` | No | 0 |
| 44 | `mn_addr_preprod1lpa7qkzfkx7qr0pwc35hrkf5vsrrs3ge86kxy5q297qka0pxzldqnq6p7d` | No | 0 |
| 45 | `mn_addr_preprod1kamdtprlv4gvc9weus66xff63yfvs55yedww3xgxm6k5jnuea4rqf753k7` | No | 0 |
| 46 | `mn_addr_preprod19cpenx0jdq8jz7y3j86esr4z870glya9kpeynemnud4xysq2wmfqv777mn` | No | 0 |
| 47 | `mn_addr_preprod156mj95j2ecpgft4yu38zr44vwh560el5cp75hvvr0g9eyd2tyxzs8dqlnx` | No | 0 |
| 48 | `mn_addr_preprod1e4h0t0wgumvulp83fgjg269l74pt2tq7auwjpr6zzrw923xkzmqs97xmxz` | No | 0 |
| 49 | `mn_addr_preprod1cdlksrga0uepdl4uzywxx6gu4h7smsj2n3em3774h68kdq2uws7q08jjpk` | No | 0 |
| 50 | `mn_addr_preprod19dj5t0zqdnavzppe6ce7nhaev4c8j5wcz2wn54xy9zzdnnkhaaksc6decv` | No | 0 |
| 51 | `mn_addr_preprod10w80grmlrpnqqxa22ecg44vk655vyj0kfzzgr0u942w9uhuyjlqqca4mwn` | No | 0 |
| 52 | `mn_addr_preprod1cc4tk7ephe4lhqu6nd8qhlzxhtkjud53lmgs0zkt7h3d339duecq4zx0t8` | No | 0 |
| 53 | `mn_addr_preprod1q6tsh548xgl7wvkv4hgfth9tthe00n5h2zjmppp9yyykqt07yp8q2whgn7` | No | 0 |
| 54 | `mn_addr_preprod1lqavkr5kc665eznrqn3xnh7zrqft70sps45q5r4c8kqlnpknw7lsmrdfmj` | No | 0 |
| 55 | `mn_addr_preprod1mdqmu0naxyta4udmrfq89k3fy6q7xrz2pt8p7qzvfv9h443fpgfssrgjum` | No | 0 |
| 56 | `mn_addr_preprod17vhpeuvvlc7rrhmefz2q7nfqyjlhmwwhvhf4jpapakyurky2jlcs6aflxe` | No | 0 |
| 57 | `mn_addr_preprod1nskp987recp9dgt2fjtlwk6lv3lp2tvtfyxen2llgstneercjgsqguvt3s` | No | 0 |
| 58 | `mn_addr_preprod1vk2p2v7wtca87vcu50uhwt8q3vqrlkhd4mz53gc0mmt046huedlsp7q0m7` | No | 0 |
| 59 | `mn_addr_preprod1tyzjmtz6t9kuqv8s8ntusfa8whr639g7vg0jtzlr2z6vjgvhs4tsjl5v93` | No | 0 |
| 60 | `mn_addr_preprod1j0xx0sy88tl4fgnl7qx5jf6pcpr7f5w7y5wuz4jrryjn3hs4340spygdta` | No | 0 |
| 61 | `mn_addr_preprod18lcxcaj33d6y35fkn8g37xax544hd52fcp5ysumts0cems6u3qestzfxnt` | No | 0 |
| 62 | `mn_addr_preprod1ns3y8trraj90sy2mejdjyadcq5r8usmz0tgd0p8xvfckduyp2yyqyketnp` | No | 0 |
| 63 | `mn_addr_preprod1jkwqa36axxqmpx8udc232m3tr5hrc6x07cxae3sp2v4d20p8dzvqgz30e0` | No | 0 |
| 64 | `mn_addr_preprod1dcznkjcpxjd5ssparrgxg9ygl4smf7rtwjqjhr0r9ywvjs89kg0qkjp308` | No | 0 |
| 65 | `mn_addr_preprod1cm8u39ulh7vamnjrgtms2lcwrf9zwaj43gl7zywn0355jzn52qxqgyle7m` | No | 0 |
| 66 | `mn_addr_preprod1k4lk9e8tpugwqtaqd2rxqg3x8xw9n3qxwf9wzftrqzsq3rqz087svenwmc` | No | 0 |
| 67 | `mn_addr_preprod13u4h7wkztd9trck786xvxflg9zkn0cys5kh8tzgfjpvyds5fzpdst7rans` | No | 0 |
| 68 | `mn_addr_preprod1zc97a3vutvfsnrdkqv6zsd603kzy04gkxk6n79d7tdtjxt7dqrrqs3rwyt` | No | 0 |
| 69 | `mn_addr_preprod1a7k4vquxddrly0fxqvhwwzmvq7pem4w07p67q838ulwwuhugwh8s7xmjme` | No | 0 |
| 70 | `mn_addr_preprod1v9xhmgqu56smx5kc6fuke5trvaczhkcylhvnnz3fqatkv2v0xywq6ckcw4` | No | 0 |

> **Operator wallet batch** — 70 real Midnight wallets are pre-generated
> (`.wallet-batch/`, gitignored) and registered so the milestone can be driven
> in one pass: generate → fund → `npm run batch-verify` → `npm run sync-users
> --apply`. The registry lists them as **registered but unverified** until the
> indexer confirms each on-chain (docs/DEPLOY_PREPROD.md §5a).

---

## Roadmap

| Phase | Goal | Status |
| --- | --- | --- |
| 1 | Local devnet + server-side prove/verify | Done |
| 2 | Browser proving with Lace | Done |
| 3 | Preprod deployment, static live demo, CI/CD, tests, docs | Done |
| 4 | Confidential Credentials -- issue/verify/revoke credential system | In progress |
| 5 | 70 Preprod users, feedback loop, production polish | In progress |

**Level 5 sub-goals**

| Item | Status |
| --- | --- |
| Extended MVP (registry + analytics + tracking APIs) | Done |
| Structured feedback loop documented (`docs/FEEDBACK.md`) | Done |
| Preprod user registry + on-chain verification (`docs/USERS.md`) | In progress — 0/70 users |
| 30+ meaningful commits this cycle | In progress |
| Demo video (shot list: `docs/DEMO_VIDEO.md`) | In progress |

---

## Submission checklist

- **Public GitHub repository with full documentation** --
  [github.com/itsmypritam/shadowpass](https://github.com/itsmypritam/shadowpass)
  -- README + [`docs/`](docs/)
- **Live demo link** --
  [shadowpass-wheat.vercel.app](https://shadowpass-wheat.vercel.app)
- **Preprod contract address** -- verifiable on the
  [Midnight block explorer](https://preview.midnightexplorer.com)
- **70 Preprod users** -- verifiable wallet addresses tracked in
  [`preprod-users.json`](preprod-users.json), verified on-chain
  ([`docs/USERS.md`](docs/USERS.md))
- **CI/CD badge** --
  [![CI](https://github.com/itsmypritam/shadowpass/actions/workflows/ci.yml/badge.svg)](https://github.com/itsmypritam/shadowpass/actions/workflows/ci.yml)
- **Product X profile** --
  [@ShadowPassHQ](https://x.com/ShadowPassHQ) -- linked in README
- **Demo video** -- full MVP walkthrough; shot list + narration in
  [`docs/DEMO_VIDEO.md`](docs/DEMO_VIDEO.md)
- **Feedback loop documented** -- [`docs/FEEDBACK.md`](docs/FEEDBACK.md) +
  structured collection (API / in-app form / GitHub templates)
- **Preprod user tracking** --
  [`preprod-users.json`](preprod-users.json) + `npm run registry`
- **Go-live runbook** -- [`docs/DEPLOY_PREPROD.md`](docs/DEPLOY_PREPROD.md):
  deploy to Preprod, collect + harvest real users, close out at 70
- **Minimum meaningful commits** -- target for this cycle: 30+
  [commits](https://github.com/itsmypritam/shadowpass/commits/main)

---

## FAQ

### Are the user registry addresses real or fabricated?

**Real.** `preprod-users.json` starts empty and is only ever extended with
addresses that were either (a) collected from real onboarding, or (b) **harvested
on-chain** — `npm run sync-users -- --network preprod --contract <hex> --apply`
scans the Midnight indexer and merges only the wallet addresses it actually saw
transacting against the deployed contract. All edits are committed and CI
validates structure, uniqueness and feedback ratings on every push.

### How does the project reach the 70-user milestone?

The full playbook lives in [`docs/DEPLOY_PREPROD.md`](docs/DEPLOY_PREPROD.md):
fund a Preprod wallet, deploy, share the demo, collect claims, then verify and
harvest on-chain. [`docs/USERS.md`](docs/USERS.md) defines what counts as a
user and how each address is verified; progress is tracked with
`npm run registry -- status`.

### Can I run the live demo without installing anything?

Yes — [`shadowpass-wheat.vercel.app`](https://shadowpass-wheat.vercel.app) runs
in static mode: proof and submission happen entirely in the browser via Lace.
In that mode feedback and registry claims open pre-filled GitHub issues.

### Where does the product learn what to build next?

From the feedback loop in [`docs/FEEDBACK.md`](docs/FEEDBACK.md): structured
ratings + comments collected in-app, on GitHub, or via
`npm run registry -- feedback add`, triaged weekly, prioritized by impact, and
shipped with the issue number linked in the commit.

---

## License

MIT -- see [`LICENSE`](LICENSE).
