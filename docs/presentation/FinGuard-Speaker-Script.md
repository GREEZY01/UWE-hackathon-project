# FinGuard — presentation script

Approximate duration: 3½–4 minutes, including a short demo. Suggested speaker split; swap as needed.
Style preserved from the supplied deck: warm off-white, dark serif headings, thin corner lines and sparse layouts.

## Slide 1 — Silas (0:00–0:20)

We’re Silas and Georgi, and this is FinGuard: a reliability layer for financial AI. Our goal is simple: help a financial firm put clear boundaries around AI answers, and show the evidence behind those boundaries. This is a demonstration with fictional data, not a claim of guaranteed compliance.

## Slide 2 — Silas (0:20–0:50)

The problem is that a fluent answer can still be wrong. In financial services, that might be an invented savings rate, a personal investment recommendation, or confidential data appearing in a response. Different teams face different risks. We cover client services, research, compliance and operations, and internal staff. Each needs its own rules, plus a way for a human to inspect what happened.

## Slide 3 — Silas (0:50–1:25)

We tested our mock demo on eighty fictional cases, running each with guardrails off and on. Our independent heuristic scorers found content violations in forty-five of eighty unguarded responses and zero of eighty guarded responses. But the system also unnecessarily intervened on three of twenty-four legitimate requests. These are scripted demo results, not evidence that real models become perfectly safe. We show the false positives because reliability means measuring the trade-offs too.

## Slide 4 — Georgi (1:25–1:30)

Our solution is FinGuard.

## Slide 5 — Georgi (1:30–2:05)

FinGuard sits between the user and the answer model. First, it inspects inputs for sensitive data, suspicious instructions, permissions and possible inside information. Next, NeMo runs the rails and our finance checks inspect the response for risks such as personal advice, unsupported figures and tipping off. Finally, we show the response alongside the checks, explanations and policy version, and record an audit trail. Escalation means a human-review flag in this demo, not a message to a real team.

## Slide 6 — Georgi (2:05–2:35)

NVIDIA NeMo Guardrails is the open-source engine. Our contribution is the layer around it: financial policy packs, custom actions, four profiles, evaluation, and an inspectable audit trail. FastAPI serves the backend, SQLite stores records, and React provides the interface. The deterministic mock model makes the presentation repeatable without an API key. We also built OpenAI-compatible and Anthropic adapters, but have not verified them with live credentials.

## Slide 7 — Georgi (2:35–3:30)

Here is the difference in one question: should I put my savings into Tesla stock? The scripted unguarded model gives a personal recommendation. The guarded path replaces it with general information, a referral to an appropriately regulated adviser and a risk warning. [Switch to Before & after, keep Use cached results enabled, select Savings into Tesla, then Compare both paths. Open the OUT-02 trace.] The trace explains what changed and records the policy version. These cached results are historical mock runs; they do not create new audit entries. FinGuard helps make AI easier to inspect and control. It reduces risk, while people remain accountable.

## Before presenting

- Start the frontend and backend; open Before & after. Leave cached results enabled.
- If the app is unavailable, the final slide contains the fallback comparison.
- The mock benchmark is 80 authored cases, not a production or held-out benchmark.
- PII is redacted in both delivered paths; do not claim a measured PII improvement.
- Hash-chain auditing is tamper-evident demo logic, not certified immutable storage.
- Docker startup and live-provider behaviour remain unverified.
- The original Deloitte/Saturn claims were removed because their sources and figures were not verified.

## Evidence

Measured results: docs/evaluation-report.md in GREEZY01/UWE-hackathon-project.
Dataset: backend/data/evaluation_set.json. Example: backend/data/cached_demo.json.
Run ID: ce198807-db45-4103-bac4-3a25d593adf7. Results use the scripted mock provider.
