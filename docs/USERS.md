# ShadowPass Preprod Users — the path to 70

ShadowPass Level 5 requires **70 Preprod users with verifiable wallet
addresses**. This document defines what counts as a user, how onboarding
works, and how the operator verifies every address on-chain before it enters
the public registry (`preprod-users.json`).

---

## 1. What counts as a Preprod user

A Preprod user is a person who:

1. Installed/connected a Midnight wallet (Lace) on the **Preprod** network;
2. Completed **at least one zero-knowledge verification** against the deployed
   ShadowPass contract (browser path or server path);
3. Shared their unshielded wallet address, which is then **verified on-chain**.

> An address is "verifiable" because completing a verification publishes a
> transaction on the Midnight Preprod ledger — anyone can look that address up
> in the explorer/indexer and confirm it interacted with the contract.

## 2. The onboarding funnel

```
Discover ──► Install Lace ──► Fund + DUST ──► Verify in ZK ──► Claim registry ──► Feedback
   │           lace.io          Preprod faucet     shadowpass   GitHub issue      in-app form
   │                           dust generator        demo        (or API)        or GitHub
   │
   └─ channels: X, Discord, developer communities, docs
```

Each step is documented for the user in the README
[User onboarding guide](../README.md#user-onboarding-guide) with
troubleshooting — the kind of content that turns a curious visitor into #1 of
70.

## 3. Acquisition channels

| Channel | Action | Target |
| --- | --- | --- |
| **X (`@ShadowPassHQ`)** | Launch posts, demo clips, progress to 70 | Developer audience |
| **Midnight/Compact developer Discord** | Live demo + walkthrough for builders | Early adopters |
| **Developer newsletters / communities** | "A privacy gate you can prove with ZK" | Curious devs |
| **Referral inside the product** | "Know someone testing? send them the link" | Organic growth |
| **Course cohorts (Levels 4/5)** | Peers who already have Lace + Preprod funds | Highly qualified |

A weekly pulse: post current count, invite next sprint of 5-10 testers,
collect their addresses, verify, commit to the registry.

## 4. The registry & verification workflow

The registry is a single committed JSON file, `preprod-users.json`:

```jsonc
{
  "network": "preprod",
  "description": "Tracked Preprod user wallet addresses for the ShadowPass Level 5 submission",
  "users": [
    {
      "address": "mn1…",
      "firstSeenAt": "2026-08-20T10:00:00.000Z",
      "verifications": 1,
      "verified": true
    }
  ],
  "feedback": []
}
```

### Operator verification steps

1. **Receive a claim** — in-app registry claim (GitHub issue template), the
   feedback form, or the operator's own tracking of explorer activity.
2. **Structural check** — `npm run registry -- add <address>` refuses
   implausible addresses; `validate` checks duplicates + shape.
3. **On-chain check** — confirm the address appears on the Midnight Preprod
   explorer / indexer with a transaction against the ShadowPass contract, or
   simply that it exists on-chain (transaction from that address).
4. **Record** — `npm run registry -- verify <address>` marks it verified and
   bumps the counter, then commit the file.
5. **Celebrate & nudge** — the count in the app and README rises; post a pulse.

### Self-service (hosted static demo)

The static Vercel demo has no backend, so users self-register: the app's
**"Claim my spot on the registry"** button opens a pre-filled GitHub issue with
their address and the session's transaction id. The operator then runs steps
2-4 above and merges. This keeps the loop working with zero infrastructure.

## 5. Tracking progress

```bash
# Live summary + how many until 70
npm run registry -- status

# Each new registration / verification
npm run registry -- verify mn1…

# Table for the README / deliverables
npm run registry -- export --out docs/preprod-users.md

# CI gate (runs on every push)
npm run registry:validate
```

The app also exposes live summaries:

- `GET /api/users` → registry + summary + markdown
- `GET /api/analytics` → summary + contract state

## 6. Progress log

| Date | Users | Verified | Verifications | Notes |
| --- | --- | --- | --- | --- |
| _YYYY-MM-DD_ | 0 | 0 | 0 | Registry initialized |