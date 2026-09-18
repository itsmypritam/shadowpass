# ShadowPass Preprod Go-Live Runbook

Everything the operator must do to take the Level 5 submission from "tooling
complete" to "70 real, verifiable Preprod users". This runbook exists so the
mission can be finished end-to-end by whoever holds a funded Midnight wallet.

> Status: **tools ready, not yet live on Preprod.** The contract currently runs
> on Preview; Preprod deployment is the remaining manual step and needs a
> funded wallet + a seed phrase (not committed to the repo).

---

## 1. Prerequisites

- Node.js >= 22, `npm install` done, `npm run compile` passing.
- A Midnight **Preprod** wallet with funds:
  - `mn_addr_preprod...` address (unshielded) funded with Midnight coins **and** DUST.
  - You must be able to sign a deploy transaction (same account that drove the
    Preview demo works).
- The Lace wallet extension on **Preprod** for browser-side proving when users
  onboard (optional before go-live, required for the demo).

## 2. Deploy to Preprod

```bash
npm run setup -- --network preprod   # creates/funds wallet, deploys contract
```

`scripts/deploy.ts` is non-interactive and records the deployment. If you
already have a funded wallet, run `npm run network -- --network preprod` to
confirm connectivity and `npm run check-balance` before deploying.

The deploy prints the **contract address** (64-hex). Keep it:

```bash
npm run network -- --network preprod   # shows contract address + indexer
```

## 3. Wire the address into the product

The deployed Preprod contract address must reach the app. In **API-backed
mode** the server reads the deployed address from `.midnight-state.json`. The
static demo uses `VITE_CONTRACT_ADDRESS` (+ `VITE_INDEXER_URL`,
`VITE_NODE_URL`), which Vercel already carries for Preview — update those env
vars to the Preprod values and redeploy.

## 4. Sanity check on-chain

```bash
npm run server        # API on http://127.0.0.1:3000
curl http://127.0.0.1:3000/api/contract   # non-null ledger state = live
```

Explorer search for the contract address:

- `https://preview.midnightexplorer.com/contracts/<address>` (network-scoped)

## 5. Collect real users

1. Share the live demo link on **Preprod** with the community / DMs
   (`@ShadowPassHQ` on X).
2. Users onboard with Lace on Preprod, run an eligibility check, and (in
   API-backed mode) get auto-tracked into `preprod-users.json`.
3. Encourage them to claim registry slots + leave feedback via the in-app
   form or the GitHub issue templates.
4. **Harvest real on-chain addresses** — this is the no-fake-data step:

```bash
# dry-run report: wallets the indexer really saw transacting ShadowPass
npm run sync-users -- --network preprod --contract <address>

# merge those real addresses as verified users
npm run sync-users -- --network preprod --contract <address> --apply
```

Only addresses found in real transactions are ever added. See
[docs/OPERATIONS.md](OPERATIONS.md) for indexer rate-limit notes.

### 5a. Pre-provisioned wallet batch (jump-start to 70)

The **operator-controlled batch** gives you 70 real Midnight wallets to drive
the milestone the moment the contract is deployed:

1. **Generate** 70 real wallets (BIP-39 phrases → valid `mn_addr_…` addresses):

   ```bash
   npm run generate-wallets -- --count 70 --network preprod
   ```

   Output lands in `.wallet-batch/preprod/` (gitignored — recovery phrases).
   `addresses.txt` is the faucet paste-list.

2. **Register** the batch (honest — `verified: false` until the chain agrees):

   ```bash
   npm run generate-wallets -- --from .wallet-batch/preprod --registry
   ```

3. **Fund** the deployer wallet once from the faucet (Cloudflare-Turnstile
   gated — the only human step), then distribute to the whole batch from that
   single funded wallet:

   ```bash
   npm run fund-batch -- --network preprod
   ```

   Defaults to `.wallet-batch/preprod/addresses.txt`, 1 tNIGHT per recipient.
   Re-run to retry any skipped rows.

4. **Verify** — each wallet performs one real on-chain eligibility check
   against the deployed contract:

   ```bash
   npm run batch-verify -- --network preprod
   ```

   `--concurrency`, `--index-start`, `--limit` let you resume exactly where
   something failed.

5. **Harvest** — only wallets the indexer actually saw become VERIFIED:

   ```bash
   npm run sync-users -- --network preprod --contract <address> --apply
   ```

**One-command path (steps 1–5):** after the deployer is funded, run

```bash
npm run finish -- --network preprod
```

which chains deploy → fund-batch → batch-verify → sync-users `--apply`.

Until step 5 the registry correctly reports **70 registered, 0 verified** — the
number never claims on-chain truth it doesn't have.

## 6. Feedback loop + tracking to 70

Weekly cycle (see [docs/FEEDBACK.md](FEEDBACK.md)):

```bash
npm run registry -- status            # progress to 70 users
npm run registry -- feedback list     # triage
npm run registry -- analytics         # ratings + distribution
npm run registry -- export --out docs/preprod-users.md   # refresh exported list
npm run registry -- validate          # CI gate
```

Commit every accepted user + feedback entry as its own reviewed commit.

## 7. Close-out when 70 verified users are tracked

1. `npm run registry -- validate` passes.
2. `docs/preprod-users.md` export refreshed and committed.
3. All addresses resolve on the Preprod explorer (spot-check 20%).
4. Demo video produced per [docs/DEMO_VIDEO.md](DEMO_VIDEO.md).
5. README submission checklist updated with the live contract address,
   final user count, and commit count (30+).
6. Push; CI compiles, typechecks, runs all tests, validates the registry.