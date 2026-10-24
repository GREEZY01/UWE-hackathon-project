import { ShieldCheck, ArrowDown, Database, ScanLine, Bot } from "lucide-react";
export default function About() {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">BUILT FOR SCRUTINY</p>
          <h1>
            Guardrails reduce risk.
            <br />
            People remain accountable.
          </h1>
          <p>
            A transparent financial-services demonstration built around NVIDIA
            NeMo Guardrails.
          </p>
        </div>
      </div>
      <div className="two-cols">
        <section className="card">
          <h2>How a request travels</h2>
          <div
            className="architecture"
            aria-label="Request flows through input rails, model, output rails and audit storage"
          >
            <div>
              <ScanLine />
              Input rails<small>Redaction · intent · MNPI · permissions</small>
            </div>
            <ArrowDown />
            <div>
              <Bot />
              Model provider<small>Mock, OpenAI-compatible, or Anthropic</small>
            </div>
            <ArrowDown />
            <div>
              <ShieldCheck />
              Output rails
              <small>Grounding · advice · fairness · disclosures</small>
            </div>
            <ArrowDown />
            <div>
              <Database />
              Response + audit
              <small>Policy version · evidence · hash chain</small>
            </div>
          </div>
        </section>
        <section className="card">
          <h2>What is real</h2>
          <ul>
            <li>
              NeMo Guardrails 0.12.0 executes Colang 1.0 input and output flows.
            </li>
            <li>Custom Python checks produce structured, timed evidence.</li>
            <li>
              Editable policy versions, SQLite audit storage, and a verifiable
              hash chain.
            </li>
            <li>Evaluation metrics computed from actual paired runs.</li>
          </ul>
          <h2>What is mocked</h2>
          <ul>
            <li>
              Northbridge Financial, products, documents, cases and identities
              are fictional.
            </li>
            <li>
              The default provider returns scripted answers, including
              deliberately risky ones.
            </li>
            <li>
              Mock self-check verdicts are deterministic; they are not
              independent AI judgments.
            </li>
            <li>
              Escalation is a flag and response, not a notification to a real
              team.
            </li>
          </ul>
        </section>
      </div>
      <section className="card">
        <h2>Limits worth understanding</h2>
        <div className="two-cols">
          <div>
            <h3>Detection has blind spots</h3>
            <p>
              Regex and heuristics miss context and obfuscation. A valid
              citation ID does not prove a claim. Figure checks cannot establish
              semantic truth. There is no RAG pipeline or semantic retrieval
              model.
            </p>
            <h3>Access is simulated</h3>
            <p>
              Demo roles and policy editing are not production authentication.
              Use fictional inputs only. The chat evaluates messages
              independently.
            </p>
          </div>
          <div>
            <h3>Evidence is not certification</h3>
            <p>
              Regulation mappings are illustrative, not legal advice. The audit
              hash chain is not a certified immutable store; a rewritten chain
              or deleted tail requires an external checkpoint.
            </p>
            <h3>Mock scores do not generalise</h3>
            <p>
              The authored benchmark and scripted provider are a repeatable
              demo. Live providers remain unverified. Guardrails do not
              guarantee compliance or safe outputs.
            </p>
          </div>
        </div>
      </section>
      <section className="card">
        <h2>Open-source foundations</h2>
        <p>
          Credit to{" "}
          <a
            href="https://github.com/NVIDIA/NeMo-Guardrails"
            target="_blank"
            rel="noreferrer"
          >
            NVIDIA NeMo Guardrails
          </a>{" "}
          (Apache-2.0). FinGuard adds financial policy packs, custom checks,
          profiles, audit evidence and evaluation.
        </p>
        <p>
          React, Vite, Tailwind CSS, Recharts, FastAPI, Pydantic, pytest and
          ESLint (MIT); Lucide (ISC); jsdiff, HTTPX and Uvicorn (BSD-3-Clause);
          TypeScript and Playwright (Apache-2.0). Presidio is not used.
          Transitive dependencies are recorded in lockfiles.
        </p>
      </section>
    </>
  );
}
