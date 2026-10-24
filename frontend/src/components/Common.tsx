import { Check, AlertTriangle, X, ArrowRight } from "lucide-react";
import { diffWords } from "diff";
import type { ChatResult, Profile, Role } from "../types";
import { profiles } from "../types";
export function Badge({ value }: { value: string }) {
  return (
    <span
      className={`badge ${["blocked", "block", "off", "high"].includes(value) ? "danger" : ["modified", "modify", "escalated", "escalate", "medium"].includes(value) ? "warning" : "success"}`}
    >
      {value}
    </span>
  );
}
export function ErrorBox({ message }: { message: string }) {
  return message ? (
    <div role="alert" className="notice danger">
      <AlertTriangle size={17} />
      {message}
    </div>
  ) : null;
}
export function SelectProfile({
  value,
  onChange,
}: {
  value: Profile;
  onChange: (v: Profile) => void;
}) {
  return (
    <label>
      Use-case profile
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Profile)}
      >
        {Object.entries(profiles).map(([id, p]) => (
          <option key={id} value={id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}
export function SelectRole({
  value,
  onChange,
}: {
  value: Role;
  onChange: (v: Role) => void;
}) {
  return (
    <label>
      Demo role
      <select value={value} onChange={(e) => onChange(e.target.value as Role)}>
        {["client", "analyst", "compliance_officer", "staff"].map((role) => (
          <option key={role} value={role}>
            {role.replaceAll("_", " ")}
          </option>
        ))}
      </select>
    </label>
  );
}
export function Diff({ before, after }: { before: string; after: string }) {
  return (
    <div className="diff" aria-label="Reply changes">
      <p className="subtle">
        Removed text is struck through; additions are highlighted.
      </p>
      {diffWords(before, after).map((part, i) =>
        part.added ? (
          <mark key={i}>{part.value}</mark>
        ) : part.removed ? (
          <del key={i}>{part.value}</del>
        ) : (
          <span key={i}>{part.value}</span>
        ),
      )}
    </div>
  );
}
export function Summary({ result }: { result: ChatResult }) {
  const checks = result.rule_results;
  return (
    <span className="summary">
      {checks.length} checks ·{" "}
      {checks.filter((r) => r.status === "modified").length} modified ·{" "}
      {checks.filter((r) => r.status === "blocked").length} blocked ·{" "}
      {checks.filter((r) => r.status === "escalated").length} escalated
    </span>
  );
}
export function Trace({
  result,
  animated = false,
}: {
  result: ChatResult;
  animated?: boolean;
}) {
  return (
    <div className="trace">
      <div className="section-heading">
        <h3>Guardrail trace</h3>
        <span className="mono">{result.latency_ms.total.toFixed(1)} ms</span>
      </div>
      <div className="trace-stages">
        <span>Input</span>
        <ArrowRight size={12} />
        <span>{result.model_called ? "Model called" : "Model withheld"}</span>
        <ArrowRight size={12} />
        <span>Output</span>
      </div>
      {!result.rule_results.length && (
        <p className="notice danger">No guardrails active. Output unchecked.</p>
      )}
      {result.rule_results.map((rule, i) => (
        <details
          key={rule.rule_id}
          open={rule.status !== "pass"}
          className={`trace-item ${animated ? "animate-step" : ""}`}
          style={{ animationDelay: `${i * 65}ms` }}
        >
          <summary>
            <span className={`status-icon ${rule.status}`}>
              {rule.status === "pass" ? (
                <Check size={14} />
              ) : rule.status === "blocked" ? (
                <X size={14} />
              ) : (
                <AlertTriangle size={14} />
              )}
            </span>
            <span>
              <strong>{rule.rule_id}</strong> {rule.name}
              <small>
                {rule.stage} · {rule.severity} severity ·{" "}
                {(rule.latency_ms ?? 0).toFixed(1)} ms
              </small>
            </span>
            <Badge value={rule.status} />
          </summary>
          <div className="trace-body">
            <p>{rule.explanation}</p>
            {rule.regulation_references.map((ref, j) => (
              <p className="regulation" key={j}>
                {typeof ref === "string"
                  ? ref
                  : `${ref.reference} — ${ref.explanation}`}
              </p>
            ))}
            {!!rule.evidence.length && (
              <p>
                <strong>Evidence:</strong> {rule.evidence.join(" · ")}
              </p>
            )}
            {rule.method && <small>{rule.method}</small>}
          </div>
        </details>
      ))}
      <p className="subtle mono">
        {result.policy_pack_version} · {result.model_name} · Audit #{result.id}
      </p>
    </div>
  );
}
