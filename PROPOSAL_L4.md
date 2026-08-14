# Level 4 Proposal — Confidential Credentials

**Track:** Tooling & Infrastructure (Consumer & Social)
**Idea (from the provided list):** *Confidential Credentials — prove a credential is valid without disclosing it.*

## Brief overview

A Midnight zk-app that lets a credential holder prove to a verifier that they
hold a valid, non-revoked credential — a skill badge, university degree, or
professional license — **without disclosing the credential itself or their
identity**. The verifier learns only a minimal, verified claim, and cannot link
two separate presentations of the same credential to each other.

**How it works.** An issuer publishes credential hashes to the Midnight ledger
and maintains a public revocation list. The credential contract's compact
circuit takes as **private witness** the holder's signed credential and, as
**public state**, the issuer's issued/revoked registry. Proving succeeds only if
the credential is authentic (signature verifies) and not revoked. Each
presentation is a fresh zero-knowledge proof, so a verifier can check "this is a
valid credential from an accredited issuer" while learning nothing else — not
the credential's contents, not the holder's identity, and not which other
verifiers the holder has shown it to.

**What an observer can and cannot learn.** An on-chain observer (indexer,
verifier, node) can learn that the issuer issued a credential and later revoked
some hashes; they cannot learn any holder's credential data or link a specific
presentation to a specific identity. The verifier learns only the claim the
holder chose to prove (e.g., "credential valid, issued by [accredited issuer]"),
at the time it is presented.

## Level 4–6 scope

- **Level 4:** core compact contract (`issue` / `verify` / `revoke` circuits),
  local devnet demo, proof-server + indexer integration, documented privacy
  model, CI + tests.
- **Level 5:** verifier/holder/issuer frontends, Lace wallet connection for
  credential presentation, on-chain revocation list updates.
- **Level 6:** production polish — key management, live testnet deployment,
  end-to-end demo video.

## Relationship to Level 3 (ShadowPass)

Reuses the working Midnight stack proven in
[`PROPOSAL.md`](PROPOSAL.md): compact circuit compilation, proof server, wallet,
indexer, CI, and the Vercel static deployment pattern — extended from a
single-threshold gate to a general issue/verify/revoke credential system.
