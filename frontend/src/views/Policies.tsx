import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { api, errorText } from "../api";
import type { Policy } from "../types";
import { Badge, ErrorBox } from "../components/Common";
export default function Policies() {
  const [packs, setPacks] = useState<Policy[]>([]);
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<Policy | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  async function load() {
    setError("");
    try {
      const next = await api<Policy[]>("/policies");
      setPacks(next);
      setDraft(structuredClone(next[index]));
      setDirty(false);
    } catch (e) {
      setError(errorText(e));
    }
  }
  useEffect(() => {
    let active = true;
    api<Policy[]>("/policies")
      .then((next) => {
        if (active) {
          setPacks(next);
          setDraft(structuredClone(next[0]));
        }
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      });
    return () => {
      active = false;
    };
  }, []);
  function select(i: number) {
    setIndex(i);
    setDraft(structuredClone(packs[i]));
    setDirty(false);
    setMessage("");
  }
  function edit(
    id: string,
    key: "enabled" | "min_matches" | "action",
    value: boolean | number | string,
  ) {
    setDraft((p) =>
      p
        ? {
            ...p,
            rules: p.rules.map((r) =>
              r.id !== id
                ? r
                : key === "min_matches"
                  ? { ...r, thresholds: { min_matches: Number(value) } }
                  : { ...r, [key]: value },
            ),
          }
        : p,
    );
    setDirty(true);
    setMessage("");
  }
  async function save() {
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      const next = await api<Policy>("/policies/" + draft.profile, {
        method: "PUT",
        body: JSON.stringify({
          expected_version: draft.version,
          rules: Object.fromEntries(
            draft.rules.map((r) => [
              r.id,
              {
                enabled: r.enabled,
                min_matches: r.thresholds.min_matches,
                action: r.action,
              },
            ]),
          ),
        }),
      });
      setPacks((p) => p.map((v) => (v.profile === next.profile ? next : v)));
      setDraft(structuredClone(next));
      setDirty(false);
      setMessage(
        `Saved ${next.profile} policy v${next.version}. Future requests use this version; cached demos remain historical.`,
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">POLICY, MADE EXPLICIT</p>
          <h1>Set the boundaries.</h1>
          <p>
            Changes create a new version, recorded with every future request.
          </p>
        </div>
        <button
          className="primary"
          disabled={!dirty || busy}
          onClick={() => void save()}
        >
          <Save size={16} />
          {busy ? "Saving…" : "Save new version"}
        </button>
      </div>
      <ErrorBox message={error} />
      {message && (
        <div role="status" className="notice success">
          {message}
        </div>
      )}
      <div className="card controls">
        <label>
          Policy pack
          <select
            value={index}
            disabled={dirty || busy}
            onChange={(e) => select(Number(e.target.value))}
          >
            {packs.map((p, i) => (
              <option value={i} key={p.profile}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        {draft && <Badge value={"v" + draft.version} />}
        <button disabled={busy} onClick={() => void load()}>
          Reload / discard edits
        </button>
        {dirty && (
          <span className="subtle">
            Unsaved changes · save or discard before switching packs.
          </span>
        )}
      </div>
      <p className="notice warning">
        Illustrative mappings, not legal advice. Disabling checks or selecting
        allow/log weakens enforcement. This local demo editor has no
        authentication.
      </p>
      {draft && (
        <section className="card">
          <p>{draft.system_prompt}</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Enabled</th>
                  <th>Rule / regulation</th>
                  <th>Stage</th>
                  <th>Severity</th>
                  <th>On violation</th>
                  <th>Minimum matches</th>
                </tr>
              </thead>
              <tbody>
                {draft.rules.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Enable ${r.id}`}
                        checked={r.enabled}
                        disabled={busy}
                        onChange={(e) =>
                          edit(r.id, "enabled", e.target.checked)
                        }
                      />
                    </td>
                    <td>
                      <strong>
                        {r.id} · {r.description}
                      </strong>
                      {r.regulations.map((ref) => (
                        <small key={ref.reference} title={ref.explanation}>
                          {ref.reference}
                        </small>
                      ))}
                    </td>
                    <td>{r.stage}</td>
                    <td>
                      <Badge value={r.severity} />
                    </td>
                    <td>
                      <select
                        aria-label={`Action for ${r.id}`}
                        value={r.action}
                        disabled={busy}
                        onChange={(e) => edit(r.id, "action", e.target.value)}
                      >
                        {["allow", "modify", "block", "escalate", "log"].map(
                          (a) => (
                            <option key={a}>{a}</option>
                          ),
                        )}
                      </select>
                    </td>
                    <td>
                      <input
                        className="number-input"
                        type="number"
                        min={1}
                        max={20}
                        aria-label={`Minimum matches for ${r.id}`}
                        value={r.thresholds.min_matches}
                        disabled={busy}
                        onChange={(e) =>
                          edit(r.id, "min_matches", Number(e.target.value))
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="subtle">
            Minimum matches applies to deterministic evidence. The NeMo input
            self-check uses a separate binary verdict.
          </p>
        </section>
      )}
    </>
  );
}
