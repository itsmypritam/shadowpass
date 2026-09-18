# ShadowPass Operations Runbook

How the ShadowPass product runs in production: the API server, the user
registry, feedback intake, and the static hosting setup. Written for the
operator (the maintainer running the Level 5 submission).

---

## 1. Two deployment modes

| Mode | Backend | Used by |
| --- | --- | --- |
| **Static demo** (Vercel) | None — browser proves + submits via Lace | Public link `shadowpass-wheat.vercel.app` |
| **API-backed** | `src/server.ts` (Node wallet + registry) | Local dev, self-hosted registry collection |

In **static mode** the app never touches `/api`; in **API-backed mode** the
Vite dev server proxies `/api` to the Node server. Registry + feedback
collection need the API-backed mode (or the GitHub-issue self-service path on
the static demo).

## 2. The API server

```bash
npm run setup -- --network preprod   # (or preview) one-time: wallet + deploy
npm run server                        # API on http://127.0.0.1:3000
```

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/health` | GET | liveness + network |
| `/api/contract` | GET | public ledger state |
| `/api/users` | GET | registry + summary + markdown export |
| `/api/analytics` | GET | registry analytics + contract state |
| `/api/verify` | POST | server-side eligibility proof |
| `/api/feedback` | POST | record structured feedback |
| `/api/track-user` | POST | register a wallet address |
| `/api/track-verification` | POST | attribute an on-chain verification |

All API output is CORS-open JSON. The static SPA (Vite build) is also served
from `src/dist` by this server when present (`npm run build:ui` first).

## 3. The user registry

Single source of truth: **`preprod-users.json`** (committed).

```bash
npm run registry -- status                  # summary + health + progress to 70
npm run registry -- list                    # users table
npm run registry -- add mn1…                # register
npm run registry -- verify mn1…             # mark on-chain verified
npm run registry -- feedback add --rating 5 --use-case license --comment "nice" --wallet mn1…
npm run registry -- feedback list           # all feedback
npm run registry -- analytics               # ratings + distribution
npm run registry -- export --out docs/preprod-users.md
npm run registry -- validate                # CI gate (exit 1 on problems)
```

The schema, normalization and validation all live in **`src/registry.ts`** and
are covered by `tests/registry.test.ts`.

## 4. Feedback intake

- **API-backed deployments:** the app posts to `/api/feedback` →
  appended to `preprod-users.json` → operator reviews each cycle.
- **Static demo:** the app opens a pre-filled GitHub issue → operator
  triages, closes the loop, optionally transcribes structured data.
- **Manual:** `npm run registry -- feedback add ...` for interviews/DMs.

See [docs/FEEDBACK.md](FEEDBACK.md) for the full loop (triage, prioritization,
shipping, measuring).

## 5. On-chain verification of addresses

Midnight Preprod explorer:

- Contract: `https://preview.midnightexplorer.com/contracts/<address>`
- Address lookup: `https://preview.midnightexplorer.com/search?query=<address>`

A clean verification is: open the address, confirm one or more outgoing
transactions exist on Preprod against the deployed ShadowPass contract, mark
`verified`. The indexer APIs are the same ones the app reads from.

## 6. On-chain user sync (`npm run sync-users`)

Real registry addresses come from the chain, not from a spreadsheet. The sync
tool scans the Midnight indexer for transactions whose contract actions target
the deployed ShadowPass contract and harvests the unshielded owners as
verified users:

```bash
# dry-run (default): report what would be collected, write nothing
npm run sync-users -- --network preprod --contract <hex>

# merge the real addresses it found into preprod-users.json
npm run sync-users -- --network preprod --contract <hex> --apply
```

Flow: find the tip → scan `--from-height..tip` (default: last 20_000 blocks) →
match contract actions by contract address → dedupe owners → report with block
heights. `--apply` only ever writes addresses the scanner actually saw
on-chain; run without it first. The pure helpers are covered by
`tests/sync-users.test.ts`.

Operational notes:

- The public indexers **rate-limit aggressive scanning** (HTTP 403). Prefer
  short, targeted `--from-height` windows and modest `--concurrency`; block
  fetches retry with backoff, but wait if an IP gets throttled.
- The registry's `network` field guards against mixing Preprod and Preview
  addresses; `--force` is required to sync a different network into the file.
- `contractAction(address)` returns the live contract state — a cheap way to
  confirm a deployment exists on a network before harvesting.

## 7. CI + release hygiene

- `.github/workflows/ci.yml` compiles the circuit, typechecks, runs all tests
  (contract + registry) and **validates the registry** on every push.
- `managed/` (compiled circuit + ZK keys) is committed so the frontend builds
  on hosts without the compact compiler; CI recompiles and counts drift.
- The committed `preprod-users.json` means every user/feedback change is a
  reviewed, diffable commit — worth doing by hand under an hour.

## 8. Failure modes

| Symptom | Cause | Fix |
| --- | --- | --- |
| App shows "Could not read contract" | Static mode env vars wrong / contract address changed | Update `VITE_*` vars, redeploy |
| Feedback form errors | Static demo (no `/api`) or server down | Use GitHub issue path; restart server |
| Registry validate fails in CI | Duplicate/implausible address or bad rating | `npm run registry -- validate` locally, fix, commit |
| Zero Dust error in wallet | No DUST generated | Lace → Receive → Dust Generator |
| Wallet network mismatch | Wallet on wrong network | Switch Lace to Preprod, reconnect |