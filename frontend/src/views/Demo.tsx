import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Play,
  Presentation,
  Download,
  ShieldCheck,
} from "lucide-react";
import { api, download, errorText, pretty } from "../api";
import type { Cache, Comparison, Health, Profile, Role } from "../types";
import { profiles } from "../types";
import {
  Badge,
  Diff,
  ErrorBox,
  SelectProfile,
  SelectRole,
  Trace,
} from "../components/Common";
const categories = [
  "advice",
  "grounding",
  "pii",
  "promissory",
  "injection",
  "mnpi",
  "tipping_off",
  "fairness",
];
function exportHTML(result: Comparison) {
  const esc = (s: string) =>
    s.replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c]!,
    );
  download(
    "finguard-demo.html",
    `<!doctype html><html lang="en"><meta charset="utf-8"><title>FinGuard comparison</title><style>body{font:16px system-ui;max-width:1000px;margin:40px auto}section{display:grid;grid-template-columns:1fr 1fr;gap:30px}pre{white-space:pre-wrap}@media print{body{margin:0}}</style><h1>FinGuard comparison</h1><p>Fictional data. Not financial, legal or regulatory advice.</p><p>${esc(result.model.provider)} · ${esc(result.model.name)} · ${result.cached ? "Cached historical run" : "Fresh run"}</p><section><article><h2>Without guardrails</h2><pre>${esc(result.off.final_output)}</pre></article><article><h2>With guardrails</h2><pre>${esc(result.on.final_output)}</pre></article></section><h2>What changed</h2><p>${esc(result.removed_risks.map(pretty).join(", ") || "No risks removed by the scorecard.")}</p><h2>Trace</h2><pre>${esc(JSON.stringify(result.on.rule_results, null, 2))}</pre></html>`,
    "text/html",
  );
}
export default function Demo({ health }: { health: Health | null }) {
  const [cache, setCache] = useState<Cache | null>(null);
  const [index, setIndex] = useState(0);
  const [cached, setCached] = useState(true);
  const [live, setLive] = useState(false);
  const [result, setResult] = useState<Comparison | null>(null);
  const [all, setAll] = useState<Comparison[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [presentation, setPresentation] = useState(false);
  const [custom, setCustom] = useState("");
  const [profile, setProfile] = useState<Profile>("client");
  const [role, setRole] = useState<Role>("client");
  useEffect(() => {
    fetch("/cached-demo.json")
      .then((r) => {
        if (!r.ok) throw Error("Cached demo file is missing.");
        return r.json();
      })
      .then(setCache)
      .catch((e) => setError(errorText(e)));
  }, []);
  const scenario = cache?.scenarios[index];
  useEffect(() => {
    if (!presentation || !cache || busy) return;
    function key(e: KeyboardEvent) {
      if ((e.target as HTMLElement).closest("input,textarea,select,button"))
        return;
      if (e.key === "ArrowRight") {
        setIndex((i) => Math.min(i + 1, cache!.scenarios.length - 1));
        setResult(null);
      }
      if (e.key === "ArrowLeft") {
        setIndex((i) => Math.max(i - 1, 0));
        setResult(null);
      }
      if (e.key === "Escape") setPresentation(false);
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [presentation, cache, busy]);
  async function compare(id?: string) {
    if (cached) {
      if (!id || !cache)
        throw Error(
          "Custom prompts require a fresh server run. Turn off cached results.",
        );
      return cache.results[id];
    }
    return api<Comparison>("/demo/compare", {
      method: "POST",
      body: JSON.stringify(
        id
          ? { scenario_id: id, mode: live ? "live" : "mock" }
          : { prompt: custom, profile, role, mode: live ? "live" : "mock" },
      ),
    });
  }
  async function run(id?: string) {
    setBusy(true);
    setError("");
    try {
      setResult(await compare(id));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function runAll() {
    if (!cache) return;
    setBusy(true);
    setError("");
    setAll([]);
    try {
      for (const s of cache.scenarios) {
        const next = await compare(s.id);
        setAll((a) => [...a, next]);
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  function select(i: number) {
    setIndex(i);
    setResult(null);
  }
  return (
    <div className={presentation ? "presentation" : ""}>
      <div className="page-heading">
        <div>
          <p className="eyebrow">THE BEFORE & AFTER</p>
          <h1>Same question. Better boundaries.</h1>
          <p>Ten scenarios. Four use cases. An explainable difference.</p>
        </div>
        <button onClick={() => setPresentation(!presentation)}>
          <Presentation size={17} />
          {presentation ? "Exit presentation" : "Presentation mode"}
        </button>
      </div>
      <div className="demo-toolbar card">
        <label className="check-label">
          <input
            type="checkbox"
            checked={cached}
            onChange={(e) => {
              setCached(e.target.checked);
              setResult(null);
            }}
            disabled={busy}
          />
          Use cached results
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={live}
            disabled={cached || busy || !health?.live_available}
            onChange={(e) => {
              setLive(e.target.checked);
              setResult(null);
            }}
          />
          Live model
        </label>
        <span className="subtle">
          {cached
            ? `Mock cache · ${cache ? new Date(cache.generated_at).toLocaleString() : "loading"}`
            : live
              ? "Fresh live-model calls"
              : "Fresh mock-model calls"}
          {!health?.live_available && !cached
            ? " · Live provider not configured"
            : ""}
        </span>
        <button disabled={busy || !cache} onClick={() => void runAll()}>
          <Play size={15} />
          Run all scenarios
        </button>
      </div>
      <ErrorBox message={error} />
      {cache && scenario && (
        <>
          <div className="demo-layout">
            <nav className="scenario-list" aria-label="Demo scenarios">
              {cache.scenarios.map((s, i) => (
                <button
                  className={index === i ? "selected" : ""}
                  key={s.id}
                  onClick={() => select(i)}
                  disabled={busy}
                >
                  <span className="scenario-number">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>
                    <strong>{s.title}</strong>
                    <small>
                      {s.profile} · {s.risk}
                    </small>
                  </span>
                  {index === i && <ArrowRight size={16} />}
                </button>
              ))}
            </nav>
            <div>
              <section className="scenario-card">
                <div className="section-heading">
                  <span className="eyebrow">
                    SCENARIO {String(index + 1).padStart(2, "0")} /{" "}
                    {cache.scenarios.length}
                  </span>
                  <Badge value={scenario.profile} />
                </div>
                <h2>{scenario.title}</h2>
                <blockquote>“{scenario.prompt}”</blockquote>
                <p className="subtle">
                  {scenario.risk} · {scenario.regulation}
                </p>
                <div className="button-row">
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => void run(scenario.id)}
                  >
                    <Play size={16} />
                    {busy ? "Running comparison…" : "Compare both paths"}
                  </button>
                  <button
                    aria-label="Previous scenario"
                    disabled={index === 0 || busy}
                    onClick={() => select(index - 1)}
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <button
                    aria-label="Next scenario"
                    disabled={index === cache.scenarios.length - 1 || busy}
                    onClick={() => select(index + 1)}
                  >
                    <ArrowRight size={16} />
                  </button>
                </div>
                {presentation && (
                  <p className="subtle">
                    ← / → to move between scenarios · Escape to exit
                  </p>
                )}
              </section>
              {result ? (
                <>
                  <div className="comparison-grid">
                    <section className="card answer-panel unchecked">
                      <div className="section-heading">
                        <h3>Without guardrails</h3>
                        <Badge value="off" />
                      </div>
                      <p className="unchecked-label">
                        No guardrails active. Output unchecked.
                      </p>
                      <p className="answer">{result.off.final_output}</p>
                      <p className="subtle">
                        {result.off.model_name} ·{" "}
                        {result.off.latency_ms.total.toFixed(1)} ms
                      </p>
                    </section>
                    <section className="card answer-panel checked">
                      <div className="section-heading">
                        <h3>With guardrails</h3>
                        <ShieldCheck size={20} />
                      </div>
                      <Badge value={result.on.final_action} />
                      <p className="answer">{result.on.final_output}</p>
                      <p className="subtle">
                        {result.on.policy_pack_version} ·{" "}
                        {result.on.latency_ms.total.toFixed(1)} ms
                      </p>
                    </section>
                  </div>
                  <div className="result-origin">
                    {result.cached
                      ? "Historical cached mock result — no new audit entry was created."
                      : "Fresh run — both responses recorded in the audit log."}
                  </div>
                  <section className="card">
                    <h3>What changed</h3>
                    <p>
                      {result.removed_risks.length
                        ? `Removed scored risks: ${result.removed_risks.map(pretty).join(", ")}.`
                        : "No additional risks removed under the limited scorecard."}{" "}
                      Final action: <strong>{result.on.final_action}</strong>.
                    </p>
                    <Diff
                      before={result.off.final_output}
                      after={result.on.final_output}
                    />
                    <details>
                      <summary>Guarded raw model reply vs final reply</summary>
                      <Diff
                        before={
                          result.on.raw_model_output || "[Model call withheld]"
                        }
                        after={result.on.final_output}
                      />
                    </details>
                    <div className="table-wrap">
                      <table>
                        <caption>
                          Risk scorecard · independent heuristic checks
                        </caption>
                        <thead>
                          <tr>
                            <th>Risk category</th>
                            <th>OFF</th>
                            <th>ON</th>
                          </tr>
                        </thead>
                        <tbody>
                          {categories.map((c) => (
                            <tr key={c}>
                              <td>{pretty(c)}</td>
                              {(["off", "on"] as const).map((side) => (
                                <td key={side}>
                                  <span
                                    className={`score ${result.scores[side][c] ? "fail" : "pass"}`}
                                  >
                                    {result.scores[side][c] === null
                                      ? "N/A"
                                      : result.scores[side][c]
                                        ? "✕ Fail"
                                        : "✓ Pass"}
                                  </span>
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="subtle">
                      {result.note} PII is scored after privacy redaction in
                      both paths.
                    </p>
                    <div className="button-row">
                      <button
                        onClick={() =>
                          download(
                            "finguard-demo.json",
                            JSON.stringify(result, null, 2),
                          )
                        }
                      >
                        <Download size={15} />
                        Export JSON
                      </button>
                      <button onClick={() => exportHTML(result)}>
                        Print-friendly HTML
                      </button>
                    </div>
                  </section>
                  <section className="card">
                    <Trace result={result.on} animated />
                  </section>
                </>
              ) : (
                <div className="comparison-placeholder">
                  <div className="split-symbol">
                    OFF <ArrowRight size={24} /> ON
                  </div>
                  <h3>Make the difference visible.</h3>
                  <p>
                    Run the scenario to compare responses and inspect each
                    check.
                  </p>
                </div>
              )}
            </div>
          </div>
          <details className="card custom-prompt">
            <summary>Try a custom prompt</summary>
            <div className="controls">
              <SelectProfile
                value={profile}
                onChange={(p) => {
                  setProfile(p);
                  setRole(profiles[p].role);
                }}
              />
              <SelectRole value={role} onChange={setRole} />
            </div>
            <label>
              Custom prompt
              <textarea
                rows={3}
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                maxLength={20000}
              />
            </label>
            <p className="subtle">
              Requires a fresh run. Intent-based scorecard categories are N/A
              for unlabelled prompts.
            </p>
            <button
              className="primary"
              disabled={busy || cached || !custom.trim()}
              onClick={() => void run()}
            >
              Compare custom prompt
            </button>
          </details>
        </>
      )}
      {all.length > 0 && (
        <section className="card">
          <h2>Scenario results</h2>
          <div role="status" className="notice">
            {all.length}/{cache?.scenarios.length} completed · Scored category
            violations:{" "}
            {all.reduce(
              (n, r) =>
                n +
                Object.values(r.scores.off).filter((v) => v === true).length,
              0,
            )}{" "}
            OFF →{" "}
            {all.reduce(
              (n, r) =>
                n + Object.values(r.scores.on).filter((v) => v === true).length,
              0,
            )}{" "}
            ON
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Scenario</th>
                  <th>OFF violations</th>
                  <th>ON violations</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {all.map((r) => (
                  <tr key={r.scenario_id}>
                    <td>
                      {
                        cache?.scenarios.find((s) => s.id === r.scenario_id)
                          ?.title
                      }
                    </td>
                    <td>
                      {
                        Object.values(r.scores.off).filter((v) => v === true)
                          .length
                      }
                    </td>
                    <td>
                      {
                        Object.values(r.scores.on).filter((v) => v === true)
                          .length
                      }
                    </td>
                    <td>
                      <Badge value={r.on.final_action} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={() =>
              download(
                "finguard-all-scenarios.json",
                JSON.stringify(all, null, 2),
              )
            }
          >
            Export all results
          </button>
        </section>
      )}
    </div>
  );
}
