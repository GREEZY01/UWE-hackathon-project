import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Play, Download } from "lucide-react";
import { api, download, errorText, pct } from "../api";
import type { Evaluation as Run, Health } from "../types";
import { ErrorBox, Badge } from "../components/Common";
export default function Evaluation({ health }: { health: Health | null }) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [selected, setSelected] = useState<Run | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    api<Run[]>("/evaluation/runs")
      .then(async (list) => {
        setRuns(list);
        if (list.length)
          setSelected(await api<Run>("/evaluation/runs/" + list[0].id));
      })
      .catch((e) => setError(errorText(e)));
  }, []);
  async function run() {
    setBusy(true);
    setError("");
    try {
      const next = await api<Run>("/evaluation/run", {
        method: "POST",
        body: JSON.stringify({
          mode: health?.provider === "mock" ? "mock" : "live",
        }),
      });
      setSelected(next);
      setRuns((list) => [next, ...list]);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function select(id: string) {
    setError("");
    try {
      setSelected(await api<Run>("/evaluation/runs/" + id));
    } catch (e) {
      setError(errorText(e));
    }
  }
  const m = selected?.metrics.overall;
  const chart = selected
    ? Object.entries(selected.metrics.by_profile).map(([profile, value]) => ({
        profile,
        OFF:
          value.content_violation.off.rate === null
            ? null
            : value.content_violation.off.rate * 100,
        ON:
          value.content_violation.on.rate === null
            ? null
            : value.content_violation.on.rate * 100,
        falsePositive:
          value.false_positive.rate === null
            ? null
            : value.false_positive.rate * 100,
        latency: value.average_added_latency_ms,
      }))
    : [];
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">MEASURE, DON’T ASSUME</p>
          <h1>Reliability, with evidence.</h1>
          <p>Actual paired runs. Explicit denominators. Visible limitations.</p>
        </div>
        <button
          className="primary"
          disabled={
            busy ||
            !health ||
            (health.provider !== "mock" && !health.live_available)
          }
          onClick={() => void run()}
        >
          <Play size={16} />
          {busy ? "Evaluating 80 cases…" : "Run evaluation"}
        </button>
      </div>
      <ErrorBox message={error} />
      {busy && (
        <div role="status" className="notice">
          Running both paths for every case. Live models may take several
          minutes and incur provider charges.
        </div>
      )}
      <div className="card controls">
        <label>
          Saved run
          <select
            value={selected?.id ?? ""}
            onChange={(e) => void select(e.target.value)}
            disabled={busy}
          >
            {!runs.length && <option value="">No runs yet</option>}
            {runs.map((r) => (
              <option value={r.id} key={r.id}>
                {new Date(r.finished_at).toLocaleString()} · {r.model.provider}{" "}
                / {r.model.name}
              </option>
            ))}
          </select>
        </label>
        {selected && (
          <>
            <Badge value={selected.status} />
            <span className="subtle">
              {selected.model.provider} · {selected.model.name} ·{" "}
              {selected.metrics.overall.paired_items}/{selected.dataset.items}{" "}
              paired cases
            </span>
            <button
              onClick={() =>
                download(
                  "finguard-evaluation.json",
                  JSON.stringify(selected, null, 2),
                )
              }
            >
              <Download size={15} />
              Export run
            </button>
          </>
        )}
      </div>
      {selected && m ? (
        <>
          <div className="metric-grid">
            <div className="metric card">
              <span>Content violations</span>
              <strong>
                {pct(m.content_violation.off)} <small>→</small>{" "}
                {pct(m.content_violation.on)}
              </strong>
              <p>
                OFF vs ON · {m.content_violation.on.denominator} paired cases
              </p>
            </div>
            <div className="metric card">
              <span>False positives</span>
              <strong>{pct(m.false_positive)}</strong>
              <p>
                {m.false_positive.numerator}/{m.false_positive.denominator}{" "}
                legitimate requests
              </p>
            </div>
            <div className="metric card">
              <span>Added latency</span>
              <strong>
                {m.average_added_latency_ms?.toFixed(1) ?? "N/A"}{" "}
                <small>ms</small>
              </strong>
              <p>Mean paired request difference</p>
            </div>
            <div className="metric card">
              <span>Complete audit trail</span>
              <strong>{pct(m.audit_complete.on)}</strong>
              <p>
                {m.audit_complete.on.numerator}/
                {m.audit_complete.on.denominator} guarded responses
              </p>
            </div>
          </div>
          <div className="card">
            <h2>Content violations by profile</h2>
            <p className="subtle">
              Missing disclosures are excluded from this chart. Full policy
              violations: {pct(m.policy_violation.off)} OFF /{" "}
              {pct(m.policy_violation.on)} ON.
            </p>
            <div
              className="chart"
              role="img"
              aria-label="Content violation rates before and after guardrails"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="profile" />
                  <YAxis unit="%" domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="OFF" fill="#a84b45" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="ON" fill="#18775d" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="two-cols">
            <section className="card">
              <h3>False positives by profile</h3>
              <div className="chart small">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="profile" />
                    <YAxis unit="%" />
                    <Tooltip />
                    <Bar
                      dataKey="falsePositive"
                      name="False positives (%)"
                      fill="#b67b26"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className="card">
              <h3>Added latency by profile</h3>
              <div className="chart small">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="profile" />
                    <YAxis unit="ms" />
                    <Tooltip />
                    <Bar
                      dataKey="latency"
                      name="Added latency (ms)"
                      fill="#496c99"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
          <section className="card">
            <div className="table-wrap">
              <table>
                <caption>Profile metrics · accessible chart data</caption>
                <thead>
                  <tr>
                    <th>Profile</th>
                    <th>OFF violations</th>
                    <th>ON violations</th>
                    <th>False positives</th>
                    <th>Added ms</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(selected.metrics.by_profile).map(([p, v]) => (
                    <tr key={p}>
                      <td>{p}</td>
                      <td>{pct(v.content_violation.off)}</td>
                      <td>{pct(v.content_violation.on)}</td>
                      <td>
                        {pct(v.false_positive)} ({v.false_positive.numerator}/
                        {v.false_positive.denominator})
                      </td>
                      <td>{v.average_added_latency_ms?.toFixed(1) ?? "N/A"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-wrap">
              <table>
                <caption>Overall risk metrics</caption>
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>OFF</th>
                    <th>ON</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      "unsupported_figure",
                      "pii_leakage",
                      "injection_success",
                      "mnpi_catch",
                      "audit_complete",
                    ] as const
                  ).map((key) => (
                    <tr key={key}>
                      <td>{key.replaceAll("_", " ")}</td>
                      {(["off", "on"] as const).map((side) => (
                        <td key={side}>
                          {pct(m[key][side])} ({m[key][side].numerator}/
                          {m[key][side].denominator})
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-wrap">
              <table>
                <caption>
                  Rule outcomes · catch rate is pipeline improvement, not causal
                  attribution
                </caption>
                <thead>
                  <tr>
                    <th>Rule</th>
                    <th>Outcome catch rate</th>
                    <th>Eligible OFF violations</th>
                    <th>Trace detection</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(selected.metrics.by_rule).map(
                    ([rule, value]) => (
                      <tr key={rule}>
                        <td className="mono">{rule}</td>
                        <td>
                          {value.catch_rate ? pct(value.catch_rate) : "N/A"}
                        </td>
                        <td>{value.catch_rate?.denominator ?? 0}</td>
                        <td>
                          {value.trace_detection
                            ? pct(value.trace_detection)
                            : "N/A"}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </section>
          <section className="card">
            <h3>How to read these numbers</h3>
            <p>
              Model:{" "}
              <strong>
                {selected.model.provider} / {selected.model.name}
              </strong>
              . Execution errors: {m.errors}. Mock results do not estimate
              live-model performance. PII is scored after privacy redaction in
              both paths.
            </p>
            <details>
              <summary>Methodology and limitations</summary>
              <ul>
                {selected.methodology?.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </details>
          </section>
        </>
      ) : (
        <div className="card empty-chat">
          <h2>No evaluation selected.</h2>
          <p>Run the labelled set to generate measured results.</p>
        </div>
      )}
    </>
  );
}
