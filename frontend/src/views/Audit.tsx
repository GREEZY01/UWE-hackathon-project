import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Download, Search, X } from "lucide-react";
import { api, errorText } from "../api";
import type { ChatResult } from "../types";
import { Badge, Diff, ErrorBox, Trace } from "../components/Common";
export default function Audit() {
  const [filters, setFilters] = useState({
    profile: "",
    action: "",
    rule: "",
    severity: "",
    date_from: "",
    date_to: "",
  });
  const [rows, setRows] = useState<ChatResult[]>([]);
  const [error, setError] = useState("");
  const [verification, setVerification] = useState("");
  const [selected, setSelected] = useState<ChatResult | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const query = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v),
  ).toString();
  useEffect(() => {
    let active = true;
    api<ChatResult[]>("/audit?" + query)
      .then((data) => {
        if (active) {
          setRows(data.reverse());
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      });
    return () => {
      active = false;
    };
  }, [query]);
  useEffect(() => {
    if (selected) dialog.current?.showModal();
    else dialog.current?.close();
  }, [selected]);
  async function verify() {
    try {
      const result = await api<{
        intact: boolean;
        records: number;
        first_invalid_id?: number;
      }>("/audit/verify");
      setVerification(
        result.intact
          ? `Chain intact · ${result.records} records verified.`
          : `Chain broken at record ${result.first_invalid_id}.`,
      );
    } catch (e) {
      setError(errorText(e));
    }
  }
  function filter(key: keyof typeof filters, value: string) {
    setFilters((f) => ({ ...f, [key]: value }));
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ACCOUNTABILITY BY DESIGN</p>
          <h1>A record of every response.</h1>
          <p>
            Inspect the decision, its policy version, and the checks that shaped
            it.
          </p>
        </div>
        <button onClick={() => void verify()}>
          <CheckCircle2 size={17} />
          Verify hash chain
        </button>
      </div>
      <ErrorBox message={error} />
      {verification && (
        <div role="status" className="notice">
          {verification}
        </div>
      )}
      <div className="card filters">
        <label>
          Profile
          <select
            value={filters.profile}
            onChange={(e) => filter("profile", e.target.value)}
          >
            <option value="">All profiles</option>
            {["client", "research", "compliance", "staff"].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label>
          Action
          <select
            value={filters.action}
            onChange={(e) => filter("action", e.target.value)}
          >
            <option value="">All actions</option>
            {["allow", "modify", "block", "escalate"].map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <label>
          Rule
          <input
            value={filters.rule}
            placeholder="e.g. IN-04"
            onChange={(e) => filter("rule", e.target.value)}
          />
        </label>
        <label>
          Severity
          <select
            value={filters.severity}
            onChange={(e) => filter("severity", e.target.value)}
          >
            <option value="">All severities</option>
            {["low", "medium", "high"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          From
          <input
            type="date"
            value={filters.date_from}
            onChange={(e) => filter("date_from", e.target.value)}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={filters.date_to}
            onChange={(e) => filter("date_to", e.target.value)}
          />
        </label>
      </div>
      <section className="card">
        <div className="section-heading">
          <h2>{rows.length} matching records</h2>
          <div className="button-row">
            <a
              className="button"
              href={"/api/audit/export?format=json&" + query}
              download
            >
              <Download size={15} />
              JSON
            </a>
            <a
              className="button"
              href={"/api/audit/export?format=csv&" + query}
              download
            >
              CSV
            </a>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID / time</th>
                <th>Profile</th>
                <th>Input</th>
                <th>Rails</th>
                <th>Action</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 150).map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong className="mono">#{r.id}</strong>
                    <small>{new Date(r.timestamp).toLocaleString()}</small>
                  </td>
                  <td>{r.profile}</td>
                  <td className="truncate-cell">{r.original_input}</td>
                  <td>{r.guardrails ? "ON" : "OFF"}</td>
                  <td>
                    <Badge value={r.final_action} />
                  </td>
                  <td>
                    <button
                      aria-label={`Inspect record ${r.id}`}
                      onClick={() => setSelected(r)}
                    >
                      <Search size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <p>No matching audit records.</p>}
        {rows.length > 150 && (
          <p className="subtle">
            Showing the newest 150 matches. Narrow filters or export all
            matches.
          </p>
        )}
        <p className="subtle">
          Demonstration hash chain, not a certified immutable store. A rewritten
          chain or deleted tail needs an external trusted checkpoint to detect.
        </p>
      </section>
      <dialog
        ref={dialog}
        className="drawer"
        aria-labelledby="audit-detail-title"
        onCancel={() => setSelected(null)}
        onClick={(e) => {
          if (e.target === dialog.current) setSelected(null);
        }}
      >
        {selected && (
          <>
            <div className="section-heading">
              <h2 id="audit-detail-title">Audit #{selected.id}</h2>
              <button
                aria-label="Close audit details"
                onClick={() => setSelected(null)}
              >
                <X size={20} />
              </button>
            </div>
            <p>
              {selected.profile} · {selected.user_role} ·{" "}
              {selected.policy_pack_version}
            </p>
            <h3>Stored input</h3>
            <p>{selected.original_input}</p>
            <h3>Final response</h3>
            <p className="answer">{selected.final_output}</p>
            <Diff
              before={selected.raw_model_output}
              after={selected.final_output}
            />
            <Trace result={selected} />
            <details>
              <summary>Hash-chain evidence</summary>
              <pre>
                Previous: {selected.previous_hash}
                {"\n"}Record: {selected.hash}
              </pre>
            </details>
          </>
        )}
      </dialog>
    </>
  );
}
