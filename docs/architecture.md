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
