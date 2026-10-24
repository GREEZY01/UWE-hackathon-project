from pathlib import Path


def percent(metric: dict) -> str:
    return 'N/A (0 eligible)' if metric['rate'] is None else f"{100*metric['rate']:.1f}% ({metric['numerator']}/{metric['denominator']})"


def render(report: dict) -> str:
    m = report['metrics']['overall']
    lines = ['# FinGuard evaluation report', '',
             f"Run: `{report['id']}` · {report['finished_at']}",
             f"Model: **{report['model']['provider']} / {report['model']['name']}**. Status: **{report['status']}**.",
             f"Dataset: {report['dataset']['version']}; SHA-256 `{report['dataset']['sha256']}`.",
             f"Completed pairs: {m['paired_items']}/{m['items']}; execution errors: {m['errors']}.",
             '', 'These are computed results on fictional, scripted scenarios—not evidence of regulatory compliance or real-model performance.', '',
             '| Metric | OFF | ON |', '|---|---|---|']
    for key in ('policy_violation','content_violation','unsupported_figure','pii_leakage','injection_success','mnpi_catch','audit_complete'):
        lines.append(f"| {key} | {percent(m[key]['off'])} | {percent(m[key]['on'])} |")
    latency = m['average_added_latency_ms']
    lines += ['',f"False positives on legitimate requests: {percent(m['false_positive'])}.",
              f"Expected action agreement: {percent(m['expected_action_match'])}.",
              f"Mean added latency: {latency:.3f} ms." if latency is not None else 'Mean added latency: N/A.',
              '', '| Profile | Content violations OFF | Content violations ON | False positives |', '|---|---|---|---|']
    for profile, metrics in report['metrics']['by_profile'].items():
        lines.append(f"| {profile} | {percent(metrics['content_violation']['off'])} | {percent(metrics['content_violation']['on'])} | {percent(metrics['false_positive'])} |")
    lines += ['', '| Rule | Outcome catch rate | Trace detection on labelled cases |', '|---|---|---|']
    for rule, metrics in report['metrics']['by_rule'].items():
        lines.append(f"| {rule} | {percent(metrics['catch_rate'])} | {percent(metrics['trace_detection'])} |")
    lines += ['', '## Interpretation', '', *['- '+note for note in report['methodology']], '', '## Outstanding cases', '']
    outstanding = [r for r in report['rows'] if r.get('error') or (r.get('on') and (any(r['on']['violations'].values()) or not r['action_match']))]
    if not outstanding:
        lines.append('No outstanding cases under these limited scorers.')
    for row in outstanding:
        risks = [c for c,v in row['on']['violations'].items() if v] if row.get('on') else []
        lines.append(f"- {row['id']}: remaining categories={risks}; expected action={row['expected_action']}; observed={row['on']['response']['final_action'] if row.get('on') else 'error'}; error={row.get('error') or 'none'}.")
    return '\n'.join(lines)+'\n'


def write_report(report: dict, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(render(report))
