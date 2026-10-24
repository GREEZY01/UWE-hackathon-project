# FinGuard
Demo with fictional data. Not financial, legal or regulatory advice.

Python 3.11, NeMo Guardrails 0.12.0, Colang 1.0.

```sh
python3.11 -m venv .venv
.venv/bin/pip install -r backend/requirements.lock
cd backend
../.venv/bin/python -m pytest -q
../.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
```

In the prepared cloud machine use `/workspace/finguard-venv/bin/python` and
`/workspace/finguard-venv/bin/uvicorn` instead.

POST /chat with {"prompt":"guaranteed investment","guardrails":true}.
GET /health, /audit, /audit/verify. Four profiles are available: client, research, compliance and staff.
Export environment variables before starting; .env.example is a template and is not automatically loaded.
The default mock requires no key. Live providers require MODEL_PROVIDER=openai or anthropic,
MODEL_API_KEY and MODEL_NAME. OpenAI-compatible servers can override MODEL_BASE_URL.
Live providers have not been tested with credentials.

Actual NeMo input/output flows execute sensitive-data and misleading-language actions.
Sensitive-data detection covers the documented identifier patterns; see docs/limitations.md for coverage. Mock responses deliberately contain risks.
An offline lexical index replaces NeMo's default embedding download; it does not provide semantic understanding.
The passthrough callback is verified against installed 0.12.0 internals and must be retested on upgrades.

Audit fields are always redacted using the supported patterns. Original input means its
redacted representation. No raw secret retention switch is enabled at this stage.
The response also redacts supported PII in OFF mode. This is an audit/privacy safeguard.
The chain detects edited records but cannot detect a fully rewritten chain or tail truncation
without an external trusted checkpoint. This is not a certified immutable store.
The role selector is demo metadata, not authentication. Do not expose this API publicly.
Mappings are illustrative, not legal advice. Humans remain accountable.

Dependencies: NVIDIA NeMo Guardrails (Apache-2.0), FastAPI (MIT), HTTPX (BSD-3-Clause),
Uvicorn (BSD-3-Clause), pytest (MIT), Pydantic (MIT); transitive packages are captured in requirements.lock.

## Stage 3

Four profiles now run: client/client, research/analyst,
compliance/compliance_officer, staff/staff (profile/role pairs).
POST /chat accepts profile, role, prompt and guardrails. It records policy version,
per-rule latency, input/model/output timing, evidence and escalation/block status.

GET /policies lists packs; GET /policies/{profile} reads one.
PUT /policies/{profile} accepts, for example:
{"expected_version":1,"rules":{"OUT-01":{"enabled":true,"min_matches":1,"action":"modify"}}}.
Conflicting versions return HTTP 409. Overrides are stored in POLICY_DB (default
/tmp/finguard-policies.sqlite3). This unauthenticated editor is for local demos only.

Run `python scripts/generate_regulation_mapping.py` from backend to regenerate the
mapping from base policy files. See docs/limitations.md for implementation scope and
known weaknesses. Pydantic deprecation warnings come from NeMo and its dependencies.

## Stage 4: evaluation

From `backend`, run:

```sh
/workspace/finguard-venv/bin/python -m eval.runner --mode mock
```

For a local virtual environment use `../.venv/bin/python` instead. The runner executes
80 labelled fictional cases (20 per profile, 24 legitimate), each with guardrails OFF
and ON. It writes full run JSON to `backend/.runtime/evaluations/<run-id>.json` and
regenerates `docs/evaluation-report.md`. The CLI exits nonzero for incomplete runs.
Scored failures are findings, not execution failures. Full run records include model,
policy snapshots and hashes, dataset hash, paired responses, trace, scores and audit IDs.

API: POST `/evaluation/run` with `{"mode":"mock"}`; GET `/evaluation/runs`;
GET `/evaluation/runs/{run-id}` returns the complete JSON. The run request waits for
completion. Only one evaluation per server process runs at once. Use the CLI for long
live runs; configure the HTTP client's timeout appropriately for API use.

To evaluate a real model, export MODEL_PROVIDER=openai or anthropic, MODEL_API_KEY and
MODEL_NAME on the server, then run `python -m eval.runner --mode live`. The API also
accepts `{"mode":"live"}` when its server is configured for a real provider. API callers
cannot supply keys or switch server providers. A complete live run makes 160 pipeline requests, plus self-check calls for eligible
ON requests; blocked requests skip answer calls. Usage incurs the selected provider's charges. No live run has been performed.

Optional EVAL_RESULTS_DIR and EVAL_REPORT_PATH control output locations. Do not point
multiple independent server processes at the same report path when running concurrently.
`--dataset` and `--report` override CLI inputs/Markdown output. Do not put real client
data in evaluation fixtures. Results should be read alongside the methodology in each
report: missing disclosures are separated from content violations, PII is scored after
API privacy redaction, and mock performance is not evidence of live-model performance.

## Stage 5: frontend and demo

The frontend uses React 18, TypeScript, Vite, Tailwind CSS, Lucide and Recharts.
Node 24 was used for validation. From the repository root:

```sh
npm ci --prefix frontend
npm run dev --prefix frontend
```

Keep the backend running on port 8000. Vite listens on port 5173 and proxies `/api`
requests to the backend. `API_PROXY_TARGET` can override the proxy destination for
local development. No API key belongs in Vite variables or frontend code.

The default page is the before/after demo. Cached mode loads ten recorded mock
comparisons from a static JSON file and works with the backend unavailable. It shows
its generation time and historical policy versions. Turn off cached results for fresh
mock comparisons. Live mode is enabled only when the backend reports a configured
real provider. Custom prompts require fresh mode; unlabelled intent scores are N/A.
Use Run all scenarios, JSON export, or the print-friendly HTML export. Open the
exported HTML in a browser and print to PDF if needed.

Presentation mode enlarges responses; previous/next buttons and left/right arrow keys
move between scenarios when focus is outside a form control. Escape exits presentation.
Chat includes profile/role selection, default-ON guardrails, per-message summaries,
input redaction comparison, word diffs and timed rule traces. Messages are independent.
The Evaluation page plots saved or newly computed results. Audit supports filters,
record details, chain verification and JSON/CSV downloads. Policy editing uses version
checks and applies to future requests; cached results remain historical.

Regenerate the offline cache after intentional policy or mock changes:

```sh
cd backend
PYTHONPATH=. /workspace/finguard-venv/bin/python scripts/generate_demo_cache.py
```

This writes both backend/data/cached_demo.json and frontend/public/cached-demo.json,
and creates real audit entries for the generated mock comparisons.

Frontend checks:

```sh
npm run build --prefix frontend
npm run lint --prefix frontend
npm run test:e2e --prefix frontend
```

The browser tests are configured for this Linux cloud workspace: they start an isolated
backend on port 8003 and frontend on 5174, with test-only SQLite/report paths. They use
`/workspace/finguard-venv/bin/uvicorn` and the installed `/usr/bin/chromium`.
`PLAYWRIGHT_CHROMIUM_EXECUTABLE` selects another local Chromium binary. On another
machine, adjust the Python executable in frontend/playwright.config.ts. The tests cover
API-unavailable cached mode, fresh comparisons, chat, audit, policy saves, evaluations,
mobile layout, keyboard presentation controls and automated WCAG checks. Automated
accessibility checks supplement, rather than replace, assistive-technology testing.

Frontend dependencies: React, Vite, Tailwind CSS, Recharts, ESLint, Prettier and
Autoprefixer (MIT); TypeScript and Playwright (Apache-2.0); Lucide (ISC); jsdiff
(BSD-3-Clause); axe-core and its Playwright integration (MPL-2.0). Exact dependency
versions are recorded in frontend/package-lock.json.

## Docker delivery (Stage 6)

Prerequisites: Docker Engine/Desktop with Compose v2. From the repository root:

```sh
cp .env.example .env
# Leave MODEL_PROVIDER=mock for the no-key demo.
docker compose up --build -d
docker compose ps
docker compose logs backend
```

The frontend is served on local port **8080**, including the Nginx `/api` proxy. Only
that port is published; the backend is private to the Compose network. The mock demo
needs no API key or runtime internet once images are built. Initial image builds do
require registries and package downloads. API keys are supplied only to the backend.
The named volume retains audit records, policy versions and evaluation results across
container restarts. Stop with `docker compose down` without deleting the volume.

Without Docker, use the Python virtual-environment instructions near the top of this
README and the Stage 5 npm instructions. For live providers, export environment variables
in the backend shell; plain Python startup does not automatically load .env. Compose
reads .env for interpolation. Defaults remain mock mode.

See [three-minute demo script](docs/demo-script.md), [first-test checklist and
troubleshooting](docs/final-checklist.md), [regulation mapping](docs/regulation-mapping.md),
[evaluation report](docs/evaluation-report.md), and [limitations](docs/limitations.md).

This is a local hackathon demonstration, not a production compliance product. Known
limitations and remaining scope are documented rather than hidden by the interface.
