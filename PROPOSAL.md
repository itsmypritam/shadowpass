# Product Proposal — ShadowPass (Age / Eligibility Gate)

**Challenge idea:** Age / Eligibility Gate — prove a threshold without revealing
the underlying value.

## 1. Problem

Every day, users are asked to prove facts about themselves — "I'm old enough",
"I meet the income threshold", "my credit score qualifies" — by revealing the
*whole* underlying value. A nightclub asks for a birth date to check age 21. A
lender asks for full income to check a minimum. A gaming platform asks for a
score to check a leaderboard floor.

The unboxed value leaks far more than the single fact being checked: exact age
→ date of birth, exact income → household profile, exact score → competitive
information. There is no way today for an individual to prove *only* "I exceed
the threshold" while keeping the underlying value private **and** making the
claim cryptographically verifiable rather than merely trusted.

## 2. Solution

ShadowPass is an **eligibility gate** built on Midnight: a zero-knowledge
circuit that takes a private score and a public boolean claim, *asserts* the
comparison inside the proof, and records only the boolean on the ledger.

- **Prover (you):** holds the private score. Builds a proof that
  `score >= requirement` (or `< requirement`), matching the boolean you chose.
- **Verifier (the ledger):** checks the proof. The transaction is accepted only
  if the claim is *true* — a false claim fails the circuit and is rejected.
- **Ledger:** publishes `lastResult`, `verificationCount`, and the public
  `requirement`. Nothing else.

A wrong claim cannot be recorded. A truthful claim reveals only the boolean.

## 3. Why Midnight (privacy model)

Midnight gives us a **transparent ledger with verifiable private inputs**:

- Private inputs (the score) are committed inside the ZK proof and **never
  stored** anywhere — not on-chain, not on a server.
- The public contract logic is auditable by anyone and executes identically for
  every user (no trusted third party).
- The circuit enforces the rule, so "privacy" cannot be abused to lie.
- The ledger keeps an immutable, replay-proof record of every verification.

This is the Age/Eligibility Gate pattern: **prove a threshold without revealing
the underlying value.**

## 4. What an observer can and cannot learn

| | Can learn | Cannot learn |
| --- | --- | --- |
| Ledger observer | claimed boolean, rule, count, proof validity | the private score, its exact value, any bound beyond the rule |
| Network observer | transaction metadata (public parts) | the score (never transmitted) |
| API operator (dev mode) | the claimed boolean (to sign/submit) | the score in static mode — the hosted demo has no backend at all |

## 5. Scope

**In scope (built):**

- Midnight circuit `verifyEligibility(claimedEligible, score)` with public rule
  `requirement`.
- 9 passing contract tests (testkit), including false-claim rejection.
- React frontend with a Lace (browser) verify path and a server-side fallback.
- Local devnet deployment + CI/CD (compile + test + build on every push).
- Static hosted demo against Preprod with a verifiable contract address.

**Out of scope / future (roadmap):**

- Multi-rounder contracts (one private check per address).
- Selective-disclosure credentials with expiry and revocation.
- On-chain "membership token" issued only after a successful private check.
- Threshold verification for arbitrary integer/ordering predicates.

## 6. Roadmap

| Phase | Goal |
| --- | --- |
| 1 | Local devnet + server-side prove/verify |
| 2 | Browser proving with Lace (private score never leaves the tab) |
| 3 (this cycle) | Preprod deployment, static live demo, CI/CD, tests, docs |
| 4 | Membership token + repeated checks; auditability tooling |

## 7. Success criteria

- A user proves eligibility **in their browser** with only Lace installed.
- The private score is unobservable to the ledger, the network, and the host.
- A false claim is cryptographically rejected (tested).
- Anyone can independently verify every recorded result on-chain.
