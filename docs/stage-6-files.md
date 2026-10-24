# Stage 6 complete file contents

## backend/Dockerfile

```
FROM python:3.11-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN sed -i 's|http://deb.debian.org|https://deb.debian.org|g' /etc/apt/sources.list.d/debian.sources && apt-get -o Acquire::Retries=0 -o Acquire::https::Timeout=20 update && apt-get install -y --no-install-recommends g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app/backend
COPY backend/requirements.lock ./requirements.lock
RUN pip install --no-cache-dir -r requirements.lock
COPY backend/ ./
RUN useradd --create-home --uid 10001 finguard && mkdir -p /app/runtime /app/docs && chown -R finguard:finguard /app
USER finguard
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

```

## frontend/Dockerfile

```
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build
FROM nginx:1.28-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80

```

## frontend/nginx.conf

```
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;
    location /api/ {
        proxy_pass http://backend:8000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
    location / { try_files $uri $uri/ /index.html; }
}

```

## docker-compose.yml

```
services:
  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile
    environment:
      MODEL_PROVIDER: ${MODEL_PROVIDER:-mock}
      MODEL_NAME: ${MODEL_NAME:-}
      MODEL_API_KEY: ${MODEL_API_KEY:-}
      MODEL_BASE_URL: ${MODEL_BASE_URL:-https://api.openai.com/v1}
      AUDIT_DB: /app/runtime/audit.sqlite3
      POLICY_DB: /app/runtime/policies.sqlite3
      EVAL_RESULTS_DIR: /app/runtime/evaluations
      EVAL_REPORT_PATH: /app/runtime/evaluation-report.md
    volumes:
      - finguard-data:/app/runtime
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=5)"]
      interval: 10s
      timeout: 6s
      retries: 12
      start_period: 30s
  frontend:
    build:
      context: .
      dockerfile: frontend/Dockerfile
    ports:
      - "127.0.0.1:8080:80"
    depends_on:
      backend:
        condition: service_healthy
volumes:
  finguard-data:

```

## .dockerignore

```
.git
**/node_modules
**/dist
**/__pycache__
**/.pytest_cache
**/.runtime
**/test-results
**/playwright-report
**/*.tsbuildinfo
**/*.sqlite3
.env
.venv
docs/stage-*-files.md

```

## README.md

```
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

```

## docs/demo-script.md

```
# Three-minute presentation

1. Before presenting: start the app, leave **Use cached results** enabled, and select
   **Savings into Tesla**. The cache is a real historical mock run, not live inference.
2. 0:00–0:40: Compare both paths. Show the risky recommendation on the left, the general
   information on the right, and the OUT-02 trace. Explain that NeMo runs the rails.
3. 0:40–1:15: Choose **Numbers without evidence**. Show the unsupported figures,
   corrected response and grounding evidence. State that sources are fictional.
4. 1:15–1:50: Choose **An acquisition before announcement**. Explain that the input
   is escalated and the answer-model call is withheld.
5. 1:50–2:20: Show **A customer reply about AML**, then **A biased decision**. Point out
   tipping-off prevention and the human-review flag; no real notification is sent.
6. 2:20–3:00: Open Evaluation. State which model generated the selected run, show
   false positives as well as improvements, then open Audit and verify the chain.

If the API is unavailable, remain in cached Demo mode and use Run all scenarios.
Evaluation and Audit require the backend. Do not imply cached results are new audit
entries. Presentation mode supports arrow keys outside form controls and Escape.

```

## docs/final-checklist.md

```
# What to test first

- Start with the mock provider and no API key. Compare the Tesla scenario.
- Disable cached results and repeat; verify two new audit entries appear.
- Send a fictional card number in Chat; inspect redaction and the guarded response.
- Try an MNPI scenario; verify `model_called=false` on the guarded result.
- Run evaluation; check the model label, completed pairs, denominators and false positives.
- Verify the audit chain, inspect a record, and export a filtered CSV.
- Change a rule in Policy packs, save, and confirm a new version on the next request.
  Restore the rule afterward. Cached results intentionally keep historical versions.
- Check a narrow screen and keyboard-only navigation.
- Restart containers without removing volumes; confirm audit and policy data persist.

# Troubleshooting

- Port 8080 occupied: change only the frontend host port in docker-compose.yml.
- Backend fails to build: inspect `docker compose build backend --progress plain`.
  The pinned NeMo stack requires Python 3.11 and a compiler for annoy.
- Backend unhealthy: `docker compose logs backend`. A healthy process does not prove
  live provider credentials; use a real request to verify those separately.
- Frontend API failures: check both services are running. Nginx routes `/api/` to the
  backend service; do not put an API key or external provider URL in frontend variables.
- Provider errors: verify MODEL_PROVIDER, MODEL_NAME and server-side credentials.
  The mock mode needs none. Live evaluations incur provider charges.
- Policy save conflict: reload the current version before reapplying edits.
- Cache missing/stale: regenerate using the documented Python script, then rebuild the
  frontend. The build copies static cache files; editing a policy does not update them.
- Docker evaluation report: stored at `/app/runtime/evaluation-report.md`, inside the
  named volume. Retrieve JSON through the evaluation API or copy the Markdown with
  `docker compose cp backend:/app/runtime/evaluation-report.md ./evaluation-report.md`.
- `docker compose down` retains data. `docker compose down -v` deletes the demo data;
  use the latter only when intentionally resetting your own environment.

# Validation boundary

The local backend/frontend and mock workflow were tested. Browser tests use installed
Chromium. Docker execution depends on a running daemon and registry access. Live external
models, production authentication, legal compliance and immutable storage are not certified.

Container validation in this cloud session: Compose schema validated and base images
were downloaded. The image build was stopped after repeated Debian package-network
retries. Images and container startup are not verified. The backend Dockerfile uses
HTTPS package sources and bounded metadata retries; that final adjustment is untested.
Local validation completed: 49 backend tests, 8 browser tests, frontend build and lint.

```

## docs/architecture.md

```
# Architecture

React/TypeScript renders chat, demo, evaluation, audit, policy and limitations views.
Vite proxies /api during development; Nginx performs the same routing in Docker.
FastAPI loads the active policy snapshot for each request. NeMo Guardrails 0.12.0
with Colang 1.0 runs input and output actions. A model-boundary gate independently
withholds answer calls after terminal input decisions. The provider wrapper selects
mock, OpenAI-compatible or Anthropic using server-only environment variables.

Custom checks live in backend/actions. Their dispatcher records evidence, timing,
severity, regulation mapping and status. Policy base files live in backend/policies;
versioned SQLite overrides take precedence. Audit storage serializes append operations
and chains record hashes. Evaluation uses independent heuristic outcome scorers,
paired OFF/ON requests, and persisted model/dataset/policy provenance.

The demo cache is generated through actual mock comparisons and copied into frontend
static assets. Cache use creates no fresh audit entry. Live mode and fresh mock mode
call the backend; policy changes affect future calls, not historical caches.

Persistent Docker state resides in the finguard-data named volume. No real credentials
are copied into images. Local demo roles are metadata, not production authentication.

```

## docs/dependency-licences.md

```
# Dependency licence inventory

Declared metadata; consult each package licence for authoritative terms.

## Python environment

| Package | Version | Declared licence |
|---|---|---|
| aiohappyeyeballs | 2.7.1 | PSF-2.0 |
| aiohttp | 3.14.5 | Apache-2.0 AND MIT |
| aiosignal | 1.4.0 | Apache 2.0 |
| annotated-doc | 0.0.5 | MIT |
| annotated-types | 0.8.0 | MIT |
| annoy | 1.17.3 | Apache License 2.0 |
| anyio | 4.15.1 | MIT |
| attrs | 26.1.0 | MIT |
| certifi | 2026.10.23 | MPL-2.0 |
| charset-normalizer | 3.5.2 | MIT |
| click | 8.5.0 | BSD-3-Clause |
| coloredlogs | 15.0.1 | MIT |
| dataclasses-json | 0.6.7 | MIT |
| distro | 1.9.0 | Apache License, Version 2.0 |
| fastapi | 0.162.0 | MIT |
| fastembed | 0.4.0 | Apache License |
| filelock | 4.2.4 | MIT |
| flatbuffers | 25.12.19 | Apache 2.0 |
| frozenlist | 1.8.0 | Apache-2.0 |
| fsspec | 2026.9.0 | BSD-3-Clause |
| h11 | 0.16.0 | MIT |
| hf-xet | 1.7.0 | Apache-2.0 |
| httpcore | 1.0.9 | BSD-3-Clause |
| httpcore2 | 2.16.0 | BSD-3-Clause |
| httpx | 0.28.1 | BSD-3-Clause |
| httpx-sse | 0.4.3 | MIT |
| httpx2 | 2.16.0 | BSD-3-Clause |
| huggingface_hub | 0.36.2 | Apache |
| humanfriendly | 10.0 | MIT |
| idna | 3.20 | BSD-3-Clause |
| iniconfig | 2.3.1 | MIT |
| Jinja2 | 3.1.6 | BSD License |
| jsonpatch | 1.36 | BSD-3-Clause |
| jsonpointer | 3.4 | Modified BSD License |
| langchain | 0.3.30 | MIT |
| langchain-community | 0.3.31 | MIT |
| langchain-core | 0.3.86 | MIT |
| langchain-text-splitters | 0.3.11 | MIT |
| langsmith | 0.14.12 | MIT |
| lark | 1.3.1 | MIT |
| loguru | 0.7.3 | MIT License |
| markdown-it-py | 4.2.0 | MIT License |
| MarkupSafe | 3.0.4 | BSD-3-Clause |
| marshmallow | 3.26.2 | MIT License |
| mdurl | 0.1.2 | MIT License |
| ml_dtypes | 0.5.4 | Apache-2.0 |
| mmh3 | 4.1.0 | See distribution licence text (included in installed package) |
| mpmath | 1.3.0 | BSD |
| multidict | 7.2.0 | Apache-2.0 |
| mypy_extensions | 1.1.0 | MIT |
| nemoguardrails | 0.12.0 | LICENSE.md |
| nest-asyncio | 1.6.0 | BSD |
| numpy | 1.26.4 | See distribution licence text (included in installed package) |
| onnx | 1.23.2 | Apache-2.0 |
| onnxruntime | 1.19.2 | MIT License |
| opentelemetry-api | 1.45.1 | Apache-2.0 |
| orjson | 3.13.0 | MPL-2.0 AND (Apache-2.0 OR MIT) |
| packaging | 25.0 | Apache Software License; BSD License |
| pandas | 2.3.3 | See distribution licence text (included in installed package) |
| pillow | 10.4.0 | HPND |
| pluggy | 1.7.0 | MIT |
| prompt_toolkit | 3.0.53 | BSD License |
| propcache | 0.5.4 | Apache-2.0 |
| protobuf | 7.36.2 | 3-Clause BSD License |
| pydantic | 2.14.1 | MIT |
| pydantic-settings | 2.16.1 | MIT |
| pydantic_core | 2.50.1 | MIT |
| Pygments | 2.21.0 | BSD-2-Clause |
| PyStemmer | 2.2.0.3 | MIT, BSD |
| pytest | 9.1.1 | MIT |
| python-dateutil | 3.0.0 | Dual License |
| python-dotenv | 1.2.4 | BSD-3-Clause |
| pytz | 2026.5 | MIT |
| PyYAML | 6.0.3 | MIT |
| requests | 2.34.2 | Apache-2.0 |
| requests-toolbelt | 1.0.0 | Apache 2.0 |
| rich | 15.0.0 | MIT |
| shellingham | 1.5.4 | ISC License |
| simpleeval | 1.0.8 | MIT |
| six | 1.17.0 | MIT |
| sniffio | 1.3.1 | MIT OR Apache-2.0 |
| snowballstemmer | 2.2.0 | BSD-3-Clause |
| SQLAlchemy | 2.1.6 | MIT |
| starlette | 1.9.0 | BSD-3-Clause |
| sympy | 1.14.0 | BSD |
| tenacity | 9.2.1 | Apache-2.0 |
| tokenizers | 0.23.3 | Apache Software License |
| tqdm | 4.70.1 | MPL-2.0 AND MIT |
| truststore | 0.10.5 | MIT |
| typer | 0.27.3 | MIT |
| typing-inspect | 0.9.0 | MIT |
| typing-inspection | 0.4.4 | MIT |
| typing_extensions | 4.16.0 | PSF-2.0 |
| tzdata | 2026.5 | Apache-2.0 |
| urllib3 | 2.8.0 | MIT |
| uuid_utils | 0.18.0 | BSD-3-Clause |
| uvicorn | 0.54.0 | BSD-3-Clause |
| watchdog | 6.0.0 | Apache-2.0 |
| wcwidth | 0.9.3 | MIT License |
| websockets | 17.3 | BSD-3-Clause |
| xxhash | 4.0.2 | BSD-2-Clause |
| yarl | 1.25.1 | Apache-2.0 |
| zstandard | 0.25.0 | BSD-3-Clause |

## Frontend dependency lock

| Package path | Version | Declared licence |
|---|---|---|
| @alloc/quick-lru | 5.3.0 | MIT |
| @axe-core/playwright | 4.14.0 | MPL-2.0 |
| @babel/code-frame | 7.29.7 | MIT |
| @babel/compat-data | 7.29.7 | MIT |
| @babel/core | 7.29.7 | MIT |
| @babel/generator | 7.29.8 | MIT |
| @babel/helper-compilation-targets | 7.29.7 | MIT |
| @babel/helper-globals | 7.29.7 | MIT |
| @babel/helper-module-imports | 7.29.7 | MIT |
| @babel/helper-module-transforms | 7.29.7 | MIT |
| @babel/helper-plugin-utils | 7.29.7 | MIT |
| @babel/helper-string-parser | 7.29.11 | MIT |
| @babel/helper-validator-identifier | 7.29.7 | MIT |
| @babel/helper-validator-option | 7.29.7 | MIT |
| @babel/helpers | 7.29.10 | MIT |
| @babel/parser | 7.29.11 | MIT |
| @babel/plugin-transform-react-jsx-self | 7.29.7 | MIT |
| @babel/plugin-transform-react-jsx-source | 7.29.7 | MIT |
| @babel/runtime | 7.29.10 | MIT |
| @babel/template | 7.29.7 | MIT |
| @babel/traverse | 7.29.10 | MIT |
| @babel/types | 7.29.11 | MIT |
| @esbuild/aix-ppc64 | 0.25.12 | MIT |
| @esbuild/android-arm | 0.25.12 | MIT |
| @esbuild/android-arm64 | 0.25.12 | MIT |
| @esbuild/android-x64 | 0.25.12 | MIT |
| @esbuild/darwin-arm64 | 0.25.12 | MIT |
| @esbuild/darwin-x64 | 0.25.12 | MIT |
| @esbuild/freebsd-arm64 | 0.25.12 | MIT |
| @esbuild/freebsd-x64 | 0.25.12 | MIT |
| @esbuild/linux-arm | 0.25.12 | MIT |
| @esbuild/linux-arm64 | 0.25.12 | MIT |
| @esbuild/linux-ia32 | 0.25.12 | MIT |
| @esbuild/linux-loong64 | 0.25.12 | MIT |
| @esbuild/linux-mips64el | 0.25.12 | MIT |
| @esbuild/linux-ppc64 | 0.25.12 | MIT |
| @esbuild/linux-riscv64 | 0.25.12 | MIT |
| @esbuild/linux-s390x | 0.25.12 | MIT |
| @esbuild/linux-x64 | 0.25.12 | MIT |
| @esbuild/netbsd-arm64 | 0.25.12 | MIT |
| @esbuild/netbsd-x64 | 0.25.12 | MIT |
| @esbuild/openbsd-arm64 | 0.25.12 | MIT |
| @esbuild/openbsd-x64 | 0.25.12 | MIT |
| @esbuild/openharmony-arm64 | 0.25.12 | MIT |
| @esbuild/sunos-x64 | 0.25.12 | MIT |
| @esbuild/win32-arm64 | 0.25.12 | MIT |
| @esbuild/win32-ia32 | 0.25.12 | MIT |
| @esbuild/win32-x64 | 0.25.12 | MIT |
| @eslint-community/eslint-utils | 4.10.1 | MIT |
| @eslint-community/eslint-utils/node_modules/eslint-visitor-keys | 3.4.3 | Apache-2.0 |
| @eslint-community/regexpp | 4.12.2 | MIT |
| @eslint/config-array | 0.21.2 | Apache-2.0 |
| @eslint/config-helpers | 0.4.2 | Apache-2.0 |
| @eslint/core | 0.17.0 | Apache-2.0 |
| @eslint/eslintrc | 3.3.7 | MIT |
| @eslint/js | 9.39.5 | MIT |
| @eslint/object-schema | 2.1.7 | Apache-2.0 |
| @eslint/plugin-kit | 0.4.1 | Apache-2.0 |
| @humanfs/core | 0.19.2 | Apache-2.0 |
| @humanfs/node | 0.16.8 | Apache-2.0 |
| @humanfs/types | 0.15.0 | Apache-2.0 |
| @humanwhocodes/module-importer | 1.0.1 | Apache-2.0 |
| @humanwhocodes/retry | 0.4.3 | Apache-2.0 |
| @jridgewell/gen-mapping | 0.3.13 | MIT |
| @jridgewell/remapping | 2.3.5 | MIT |
| @jridgewell/resolve-uri | 3.1.2 | MIT |
| @jridgewell/sourcemap-codec | 1.6.0 | MIT |
| @jridgewell/trace-mapping | 0.3.31 | MIT |
| @napi-rs/lzma-linux-x64-gnu | 1.5.1 | MIT |
| @nodelib/fs.scandir | 2.1.5 | MIT |
| @nodelib/fs.stat | 2.0.5 | MIT |
| @nodelib/fs.walk | 1.2.8 | MIT |
| @playwright/test | 1.64.1 | Apache-2.0 |
| @rolldown/pluginutils | 1.0.0-beta.27 | MIT |
| @rollup/rollup-android-arm-eabi | 4.65.0 | MIT |
| @rollup/rollup-android-arm64 | 4.65.0 | MIT |
| @rollup/rollup-darwin-arm64 | 4.65.0 | MIT |
| @rollup/rollup-darwin-x64 | 4.65.0 | MIT |
| @rollup/rollup-freebsd-arm64 | 4.65.0 | MIT |
| @rollup/rollup-freebsd-x64 | 4.65.0 | MIT |
| @rollup/rollup-linux-arm-gnueabihf | 4.65.0 | MIT |
| @rollup/rollup-linux-arm-musleabihf | 4.65.0 | MIT |
| @rollup/rollup-linux-arm64-gnu | 4.65.0 | MIT |
| @rollup/rollup-linux-arm64-musl | 4.65.0 | MIT |
| @rollup/rollup-linux-loong64-gnu | 4.65.0 | MIT |
| @rollup/rollup-linux-loong64-musl | 4.65.0 | MIT |
| @rollup/rollup-linux-ppc64-gnu | 4.65.0 | MIT |
| @rollup/rollup-linux-ppc64-musl | 4.65.0 | MIT |
| @rollup/rollup-linux-riscv64-gnu | 4.65.0 | MIT |
| @rollup/rollup-linux-riscv64-musl | 4.65.0 | MIT |
| @rollup/rollup-linux-s390x-gnu | 4.65.0 | MIT |
| @rollup/rollup-linux-x64-gnu | 4.65.0 | MIT |
| @rollup/rollup-linux-x64-musl | 4.65.0 | MIT |
| @rollup/rollup-openbsd-x64 | 4.65.0 | MIT |
| @rollup/rollup-openharmony-arm64 | 4.65.0 | MIT |
| @rollup/rollup-win32-arm64-msvc | 4.65.0 | MIT |
| @rollup/rollup-win32-ia32-msvc | 4.65.0 | MIT |
| @rollup/rollup-win32-x64-gnu | 4.65.0 | MIT |
| @rollup/rollup-win32-x64-msvc | 4.65.0 | MIT |
| @types/babel__core | 7.20.5 | MIT |
| @types/babel__generator | 7.27.0 | MIT |
| @types/babel__template | 7.4.4 | MIT |
| @types/babel__traverse | 7.28.0 | MIT |
| @types/d3-array | 3.2.2 | MIT |
| @types/d3-color | 3.1.3 | MIT |
| @types/d3-ease | 3.0.2 | MIT |
| @types/d3-interpolate | 3.0.4 | MIT |
| @types/d3-path | 3.1.1 | MIT |
| @types/d3-scale | 4.0.9 | MIT |
| @types/d3-shape | 3.2.0 | MIT |
| @types/d3-time | 3.0.4 | MIT |
| @types/d3-timer | 3.0.2 | MIT |
| @types/diff | 7.0.2 | MIT |
| @types/estree | 1.0.9 | MIT |
| @types/json-schema | 7.0.15 | MIT |
| @types/prop-types | 15.7.15 | MIT |
| @types/react | 18.3.31 | MIT |
| @types/react-dom | 18.3.7 | MIT |
| @typescript-eslint/eslint-plugin | 8.72.0 | MIT |
| @typescript-eslint/eslint-plugin/node_modules/ignore | 7.0.14 | MIT |
| @typescript-eslint/parser | 8.72.0 | MIT |
| @typescript-eslint/project-service | 8.72.0 | MIT |
| @typescript-eslint/scope-manager | 8.72.0 | MIT |
| @typescript-eslint/tsconfig-utils | 8.72.0 | MIT |
| @typescript-eslint/type-utils | 8.72.0 | MIT |
| @typescript-eslint/types | 8.72.0 | MIT |
| @typescript-eslint/typescript-estree | 8.72.0 | MIT |
| @typescript-eslint/typescript-estree/node_modules/balanced-match | 4.0.4 | MIT |
| @typescript-eslint/typescript-estree/node_modules/brace-expansion | 5.0.12 | MIT |
| @typescript-eslint/typescript-estree/node_modules/minimatch | 10.2.6 | BlueOak-1.0.0 |
| @typescript-eslint/typescript-estree/node_modules/semver | 7.8.5 | ISC |
| @typescript-eslint/utils | 8.72.0 | MIT |
| @typescript-eslint/visitor-keys | 8.72.0 | MIT |
| @typescript-eslint/visitor-keys/node_modules/eslint-visitor-keys | 5.0.1 | Apache-2.0 |
| @vitejs/plugin-react | 4.7.0 | MIT |
| acorn | 8.19.0 | MIT |
| acorn-jsx | 5.3.2 | MIT |
| ajv | 6.15.0 | MIT |
| ansi-styles | 4.3.0 | MIT |
| any-promise | 1.3.0 | MIT |
| anymatch | 3.1.3 | ISC |
| arg | 5.0.2 | MIT |
| argparse | 2.0.1 | Python-2.0 |
| autoprefixer | 10.6.1 | MIT |
| axe-core | 4.14.0 | MPL-2.0 |
| balanced-match | 1.0.2 | MIT |
| baseline-browser-mapping | 2.11.32 | Apache-2.0 |
| binary-extensions | 2.3.0 | MIT |
| brace-expansion | 1.1.21 | MIT |
| braces | 3.0.3 | MIT |
| browserslist | 4.29.4 | MIT |
| callsites | 3.1.0 | MIT |
| camelcase-css | 2.0.1 | MIT |
| caniuse-lite | 1.0.30001819 | CC-BY-4.0 |
| chalk | 4.1.2 | MIT |
| chokidar | 3.6.0 | MIT |
| chokidar/node_modules/glob-parent | 5.1.2 | ISC |
| clsx | 2.1.1 | MIT |
| color-convert | 2.0.1 | MIT |
| color-name | 1.1.4 | MIT |
| commander | 4.1.1 | MIT |
| concat-map | 0.0.1 | MIT |
| convert-source-map | 2.0.0 | MIT |
| cross-spawn | 7.0.6 | MIT |
| cssesc | 3.0.0 | MIT |
| csstype | 3.2.3 | MIT |
| d3-array | 3.2.4 | ISC |
| d3-color | 3.1.0 | ISC |
| d3-ease | 3.0.1 | BSD-3-Clause |
| d3-format | 3.1.2 | ISC |
| d3-interpolate | 3.0.1 | ISC |
| d3-path | 3.1.0 | ISC |
| d3-scale | 4.0.2 | ISC |
| d3-shape | 3.2.0 | ISC |
| d3-time | 3.1.0 | ISC |
| d3-time-format | 4.1.0 | ISC |
| d3-timer | 3.0.1 | ISC |
| debug | 4.4.3 | MIT |
| decimal.js-light | 2.5.1 | MIT |
| deep-is | 0.1.4 | MIT |
| didyoumean | 1.2.2 | Apache-2.0 |
| diff | 7.0.0 | BSD-3-Clause |
| dlv | 1.1.3 | MIT |
| dom-helpers | 5.2.1 | MIT |
| electron-to-chromium | 1.5.464 | ISC |
| es-errors | 1.3.0 | MIT |
| esbuild | 0.25.12 | MIT |
| escalade | 3.2.0 | MIT |
| escape-string-regexp | 4.0.0 | MIT |
| eslint | 9.39.5 | MIT |
| eslint-plugin-react-hooks | 5.2.0 | MIT |
| eslint-scope | 8.4.0 | BSD-2-Clause |
| eslint-visitor-keys | 4.2.1 | Apache-2.0 |
| espree | 10.4.0 | BSD-2-Clause |
| esquery | 1.7.0 | BSD-3-Clause |
| esrecurse | 4.3.0 | BSD-2-Clause |
| estraverse | 5.3.0 | BSD-2-Clause |
| esutils | 2.0.3 | BSD-2-Clause |
| eventemitter3 | 4.0.7 | MIT |
| fast-deep-equal | 3.1.3 | MIT |
| fast-equals | 5.4.5 | MIT |
| fast-glob | 3.3.3 | MIT |
| fast-glob/node_modules/glob-parent | 5.1.2 | ISC |
| fast-json-stable-stringify | 2.1.0 | MIT |
| fast-levenshtein | 2.0.6 | MIT |
| fastq | 1.20.3 | ISC |
| file-entry-cache | 8.0.0 | MIT |
| fill-range | 7.1.1 | MIT |
| find-up | 5.0.0 | MIT |
| flat-cache | 4.0.1 | MIT |
| flatted | 3.4.4 | ISC |
| fraction.js | 5.3.4 | MIT |
| fsevents | 2.3.3 | MIT |
| function-bind | 1.1.2 | MIT |
| gensync | 1.0.0-beta.2 | MIT |
| glob-parent | 6.0.2 | ISC |
| globals | 14.0.0 | MIT |
| has-flag | 4.0.0 | MIT |
| hasown | 2.0.4 | MIT |
| ignore | 5.3.2 | MIT |
| import-fresh | 3.3.1 | MIT |
| imurmurhash | 0.1.4 | MIT |
| internmap | 2.0.3 | ISC |
| is-binary-path | 2.1.0 | MIT |
| is-core-module | 2.17.0 | MIT |
| is-extglob | 2.1.1 | MIT |
| is-glob | 4.0.3 | MIT |
| is-number | 7.0.0 | MIT |
| isexe | 2.0.0 | ISC |
| jiti | 1.21.7 | MIT |
| js-tokens | 4.0.0 | MIT |
| js-yaml | 4.3.2 | MIT |
| jsesc | 3.1.0 | MIT |
| json-buffer | 3.0.1 | MIT |
| json-schema-traverse | 0.4.1 | MIT |
| json-stable-stringify-without-jsonify | 1.0.1 | MIT |
| json5 | 2.2.3 | MIT |
| keyv | 4.5.4 | MIT |
| levn | 0.4.1 | MIT |
| lilconfig | 3.1.4 | MIT |
| lines-and-columns | 1.2.4 | MIT |
| locate-path | 6.0.0 | MIT |
| lodash | 4.18.1 | MIT |
| lodash.merge | 4.6.2 | MIT |
| loose-envify | 1.4.0 | MIT |
| lru-cache | 5.1.1 | ISC |
| lucide-react | 0.468.0 | ISC |
| merge2 | 1.4.1 | MIT |
| micromatch | 4.0.8 | MIT |
| minimatch | 3.1.5 | ISC |
| ms | 2.1.3 | MIT |
| mz | 2.7.0 | MIT |
| nanoid | 3.3.20 | MIT |
| natural-compare | 1.4.0 | MIT |
| node-releases | 2.0.60 | MIT |
| normalize-path | 3.0.0 | MIT |
| object-assign | 4.1.1 | MIT |
| object-hash | 3.0.0 | MIT |
| optionator | 0.9.4 | MIT |
| p-limit | 3.1.0 | MIT |
| p-locate | 5.0.0 | MIT |
| parent-module | 1.0.1 | MIT |
| path-exists | 4.0.0 | MIT |
| path-key | 3.1.1 | MIT |
| path-parse | 1.0.7 | MIT |
| picocolors | 1.1.1 | ISC |
| picomatch | 2.3.2 | MIT |
| pirates | 4.0.7 | MIT |
| playwright | 1.64.1 | Apache-2.0 |
| playwright-core | 1.64.1 | Apache-2.0 |
| postcss | 8.5.31 | MIT |
| postcss-import | 15.1.0 | MIT |
| postcss-js | 4.1.0 | MIT |
| postcss-load-config | 6.0.1 | MIT |
| postcss-nested | 6.2.0 | MIT |
| postcss-selector-parser | 6.1.5 | MIT |
| postcss-value-parser | 4.2.0 | MIT |
| prelude-ls | 1.2.1 | MIT |
| prettier | 3.9.10 | MIT |
| prop-types | 15.8.1 | MIT |
| prop-types/node_modules/react-is | 16.13.1 | MIT |
| punycode | 2.3.1 | MIT |
| queue-microtask | 1.2.3 | MIT |
| react | 18.3.1 | MIT |
| react-dom | 18.3.1 | MIT |
| react-is | 18.3.1 | MIT |
| react-refresh | 0.17.0 | MIT |
| react-smooth | 4.0.4 | MIT |
| react-transition-group | 4.4.5 | BSD-3-Clause |
| read-cache | 1.0.2 | MIT |
| readdirp | 3.6.0 | MIT |
| recharts | 2.15.4 | MIT |
| recharts-scale | 0.4.5 | MIT |
| resolve | 1.22.13 | MIT |
| resolve-from | 4.0.0 | MIT |
| reusify | 1.1.0 | MIT |
| rollup | 4.65.0 | MIT |
| run-parallel | 1.2.0 | MIT |
| scheduler | 0.23.2 | MIT |
| semver | 6.3.1 | ISC |
| shebang-command | 2.0.0 | MIT |
| shebang-regex | 3.0.0 | MIT |
| source-map-js | 1.2.2 | BSD-3-Clause |
| strip-json-comments | 3.1.1 | MIT |
| sucrase | 3.35.1 | MIT |
| supports-color | 7.2.0 | MIT |
| supports-preserve-symlinks-flag | 1.0.0 | MIT |
| tailwindcss | 3.4.19 | MIT |
| thenify | 3.3.1 | MIT |
| thenify-all | 1.6.0 | MIT |
| tiny-invariant | 1.3.3 | MIT |
| tinyglobby | 0.2.17 | MIT |
| tinyglobby/node_modules/fdir | 6.5.0 | MIT |
| tinyglobby/node_modules/picomatch | 4.0.7 | MIT |
| to-regex-range | 5.0.1 | MIT |
| ts-api-utils | 2.5.0 | MIT |
| ts-interface-checker | 0.1.13 | Apache-2.0 |
| type-check | 0.4.0 | MIT |
| typescript | 5.7.3 | Apache-2.0 |
| typescript-eslint | 8.72.0 | MIT |
| update-browserslist-db | 1.3.4 | MIT |
| uri-js | 4.4.1 | BSD-2-Clause |
| util-deprecate | 1.0.2 | MIT |
| victory-vendor | 36.9.2 | MIT AND ISC |
| vite | 6.4.5 | MIT |
| vite/node_modules/fdir | 6.5.0 | MIT |
| vite/node_modules/picomatch | 4.0.7 | MIT |
| which | 2.0.2 | ISC |
| word-wrap | 1.2.5 | MIT |
| yallist | 3.1.1 | ISC |
| yocto-queue | 0.1.0 | MIT |

```

## docs/limitations.md

```
# Stage 3 limitations

Demo with fictional data. Not financial, legal or regulatory advice.

All 15 checks are registered through two NeMo custom actions that dispatch to separate
Python check modules. Actual NeMo 0.12.0 Colang 1.0 input/output rails execute them.
IN-03 is input-stage intent filtering, not a separate generative dialogue rail. There is
no RAG pipeline or retrieval rail. Each profile has its own config, system prompt, topics,
permissions, disclosures and policy. Scope control currently denies a small set of known
unrelated intents; the allowed_topics list is descriptive, not an exhaustive classifier.

IN-01 uses regex plus Luhn and IBAN checksums. Supported categories are card, IBAN,
labelled UK account, sort code, NI number, SSN, email, phone and labelled DOB. Regex
coverage is incomplete and broad phone patterns may redact innocent numbers. No Presidio
model is used. No reversible map or raw secret persistence is needed.

IN-02 combines patterns and NeMo's built-in self_check_input action. Mock mode uses a
scripted verdict and does not add independent detection strength. Live mode calls the
configured provider after deterministic checks, redaction and the MNPI/access gate.
The prompt is in each profile's config.yml. Malformed verdicts or call failures block.
Model judges can miss obfuscated attacks and can themselves be manipulated. Live provider
calls have not been validated with credentials. The model-call boundary independently
refuses any input marked terminal by the input rails.

IN-04, OUT-01/02/06/07/08/09 use patterns, not a trained financial-risk classifier.
IN-05 checks explicit roles and document IDs; request roles are simulated, not authenticated.
OUT-03 checks entity/value/unit/profile against approved fixtures; dates and unsupported
numbers are withheld. It cannot establish semantic truth or resolve ambiguous statements.
OUT-04 requires allowed citation IDs per paragraph but does not prove source entailment.
OUT-05 appends disclosures. OUT-10 checks a factors label, not quality or fairness of reasoning.
Output checks inspect the original model reply so an early rewrite does not hide other
risks. Required disclosures are appended last. Errors in checks fail closed.

Policies load from JSON files at request time. The local editor API stores complete
versioned overrides in SQLite; once an override exists it takes precedence over its base
JSON file. Each request retains one policy snapshot. Set POLICY_DB to choose storage.
Updates require expected_version to prevent overwriting a concurrent update. min_matches
controls pattern-evidence thresholds; the self-check verdict is a separate binary check.
Disabling rules or choosing allow/log intentionally weakens enforcement. Logs retain a
separate detected field for allow/log violations. The policy editor API has no authentication
and is intended only for local demonstrations. No UI exists until Stage 5.

Audit records redact supported sensitive patterns even with guardrails OFF. The original
input field is therefore a redacted representation. The hash chain detects edits, not a
fully rewritten chain or tail deletion without a trusted external checkpoint. It is not
certified immutable storage. The audit API currently lists and verifies; richer filters and
exports are still pending. Human escalation is a flag and safe response, not a sent notification.

Regulation mappings are illustrative and jurisdiction-dependent. DORA and SR 11-7 mappings
refer to control concepts, not certifications. EU AI Act high-risk duties depend on the
actual use (for example credit scoring), not simply using this demo. Humans stay accountable.

## Evaluation scope (Stage 4)

The checked-in set contains 80 authored cases, not a random or held-out benchmark. The
model and cases are scripted for demonstration. Independent pattern-based outcome
scorers are implemented in eval/metrics.py and deliberately do not import enforcement
checks. Both still share conceptual blind spots. Rates are not estimates of production
risk. Each metric includes its denominator; absent opportunities are N/A, not zero.

False positives include unexpected non-disclosure output modifications to legitimate
requests whose OFF response has no independently scored content violation. This exposes
explainability overcorrection on normal compliance questions. Expected-action agreement
is shown separately. Outcome catch rates describe the entire pipeline, not causal rule
attribution. Always-on privacy redaction means delivered PII leakage can be zero with
rails OFF as well; no improvement is attributed to rails in that situation.

API evaluation is synchronous and can be slow for live providers. The runner serializes
runs within a process and snapshots policies for reporting; concurrent external policy
edits invalidate a run. The full response records and generated metrics are retained
in the configurable results directory. The generated Markdown report always represents
the latest run directed to that path. Live provider runs remain unverified.

## Frontend and demo scope (Stage 5)

Cached comparisons are generated by the real mock pipeline and served as static JSON.
They are historical evidence, not fresh audit entries or proof of the currently edited
policy. Live mode requires a real provider configured on the backend; it has not been
validated with external credentials. Custom prompt scorecards mark unlabelled intent
categories N/A rather than invent labels. PII is redacted in both delivered paths.

The UI supplies keyboard-accessible controls, a native modal audit drawer, reduced-motion
support, responsive layouts and automated accessibility checks. No claim of formal
accessibility certification is made. Chat is per-message, with no conversation memory.
Frontend policy editing is unauthenticated and remains suitable only for a local demo.
Audit CSV exports neutralise spreadsheet formula prefixes. Audit lists display the
newest 150 matching records; filtered exports include all matches.

The Vite development proxy forwards local /api traffic. Production static hosting and
Docker routing are supplied by the frontend Nginx image and docker-compose.yml. The current production build is verified,
but it needs a matching backend proxy when hosted outside Vite.

```
