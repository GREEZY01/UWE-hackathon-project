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
