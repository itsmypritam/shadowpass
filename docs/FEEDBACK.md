# ShadowPass Feedback Loop

This document is the **living constitution** of how ShadowPass collects,
triages, prioritizes, ships and measures user feedback. It exists because the
product is only as good as the loop that refines it — the Level 5 milestone is
not "70 users" but "70 users telling us what to build next."

Feedback is **structured**, **traceable** and **reviewed every cycle**. It is
not a suggestion box; it is a pipeline with a cadence and an owner.

---

## 1. The loop

```
        ┌─────────────────────────────────────────────────────────┐
        │                                                         │
   collect ──► triage ──► prioritize ──► ship ──► measure ────────┼── re-enter
        └─────────────────────────────────────────────────────────┘
```

| Step | What happens | Where | Cadence |
| --- | --- | --- | --- |
| **Collect** | Users rate, comment, describe use cases | In-app form, GitHub issues, X, interviews | Continuous |
| **Triage** | De-dup, label, classify severity, attach wallet/tx context | GitHub issues + `preprod-users.json` | Every new item |
| **Prioritize** | Score and rank against the roadmap | Weekly review (below) | Weekly |
| **Ship** | Small feedback-driven change, docs updated in the same PR | Git history (issue linked in commit) | Each cycle |
| **Measure** | Rating distribution, NPS-style signals, registry growth | `/api/analytics`, `npm run registry` | Each cycle |

## 2. Collect — the channels

| Channel | Best for | Flow |
| --- | --- | --- |
| **In-app form** (API-backed deployment) | Automated structured capture | `POST /api/feedback` → appended to `preprod-users.json` |
| **In-app form** (hosted static demo) | Same UX, zero backend | Opens a pre-filled GitHub issue (feedback template) |
| **GitHub issues** | Bug reports, feature requests, registry claims | Issue templates in `.github/ISSUE_TEMPLATE/` |
| **X / DMs** | Signal, early adopters | Operator transcribes into an issue + registry entry |

Every captured item carries at least:

- `rating` (1-5) for quantitative signal;
- `useCase` so we know which scenario is real;
- `comment` for the qualitative why;
- `walletAddress` (when shared) so we can tie it to an on-chain transaction.

Anonymous feedback is welcome and stored separately (`walletAddress:
"anonymous"`).

## 3. Triage

As items arrive they are labelled and classified in GitHub:

| Label | Meaning | Example |
| --- | --- | --- |
| `bug` | Something is broken | "Server path dead after connect" |
| `usability` | Works but friction | "Dust balance check confused me" |
| `feature` | Capability request | "I want to set my own requirement" |
| `docs` | Documentation gap | "Onboarding step lost me" |
| `registry` | User claims a registry spot | "Registry request: mn1…" |
| `feedback` | Structured experience report | "5★ age gate, fast" |

Triage rules:

1. De-duplicate: if a new report matches an existing issue, add a comment + `+1`
   instead of opening a new issue.
2. Attach context: wallet address, tx id, network, verify path.
3. Classify severity:
   - **Blocker** — product can't be used (e.g. proof fails for everyone).
   - **Major** — core flow degraded for a segment.
   - **Minor** — polish, copy, edge cases.
   - **Nice-to-have** — new ideas for the roadmap.
4. Close-with-reason: duplicates and out-of-scope items get a respectful close.