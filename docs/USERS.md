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