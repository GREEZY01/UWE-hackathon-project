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
