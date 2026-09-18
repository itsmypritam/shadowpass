# ShadowPass — Demo video script

The submission requires a **demo video showing full MVP functionality**. Use
this as the shot list and narration. Target length: **2:00–2:45**.

> Tooling: record with OBS or Loom, 1080p, 16:9. Keep the Midnight explorer
> tab pre-loaded and zoomed so the on-chain update is visible.

---

## Scene 1 — Hook (0:00–0:15)

**Screen:** live demo landing page (shadowpass-wheat.vercel.app),
scroll hero.

**Narration:**
> "Prove you're eligible — without revealing why. ShadowPass publishes one
> boolean on the Midnight ledger, backed by a zero-knowledge proof your score
> never leaves."

**On-screen callout:** prepend the link to the demo as the video title/description.

## Scene 2 — The problem (0:15–0:35)

**Screen:** scroll to the "One public fact" table and features.

**Narration:**
> "Normally, proving you meet a threshold means giving away the whole number —
> a birth date, an income, a score. ShadowPass flips that: the circuit asserts
> `score >= requirement` inside the proof, so only the boolean is ever public."

## Scene 3 — Peek under the hood (0:35–0:50)

**Screen:** show `contract/shadow-pass.compact` briefly, then the tests running
in a terminal (`npm test`, 25 passing).

**Narration:**
> "The rule is a Compact circuit compiled to a real Midnight contract, with
> 25 passing tests including a false-claim rejection — you can't even record a
> wrong result."

**On-screen callout:** test output with `✓ 25 passed`.

## Scene 4 — Wallet setup (0:50–1:20)

**Screen:** Lace wallet open on Preprod, faucet tab, Dust Generator, then back
to the demo.

**Narration:**
> "On the Preprod network with Lace, grab tNIGHT from the faucet, generate some
> DUST for fees, and connect."

**On-screen callout:** "Preprod ✓" in Lace settings.

## Scene 5 — Prove it (1:20–2:00) — the money shot

**Screen:** connect Lace → select **Eligible** → enter private score 85 →
**Verify in zero knowledge (browser)** → approve in Lace → result banner with
tx id + block height.

**Narration:**
> "Enter a private score — say 85 — and prove E LIGIBLE in your browser. Your
> score stays here. Only the signed boolean goes to the ledger."

**On-screen callout:** highlight the private-score input ("never leaves this
tab") and the result banner.

## Scene 6 — On-chain proof (2:00–2:20)

**Screen:** open the Midnight Preprod explorer, search the contract address /
the tx from scene 5, show `lastResult` and `verificationCount` updated.

**Narration:**
> "And there it is on-chain — `lastResult: true`, the counter bumped. Anyone
> can verify it; nobody can see the score."

**On-screen callout:** explorer URL + highlighted ledger fields.

## Scene 7 — Feedback loop + registry (2:20–2:40)

**Screen:** scroll the app to the Preprod users registry + feedback form; open
one GitHub issue path.

**Narration:**
> "Real users, tracked per wallet on Preprod, with structured feedback feeding
> every iteration. The loop is public — feedback links to shipping commits."

**On-screen callout:** `preprod-users.json` diff.

## Scene 8 — Close (2:40–end)

**Screen:** back to hero.

**Narration:**
> "Fork it, deploy it, or just verify — ShadowPass. Prove the boolean, keep
> the reason private."

**On-screen callout:** repo URL + live demo URL.

---

## Post-production checklist

- [ ] Captions (auto-captions reviewed)
- [ ] Demo links (repo, live demo, explorer) pasted in description
- [ ] 1080p export, under 3 minutes
- [ ] Thumbnail with hero screenshot + "ZK on Midnight" text