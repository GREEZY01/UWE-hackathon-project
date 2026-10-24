"""Run with `python -m eval.runner --mode mock` from backend."""
import argparse
import asyncio
import hashlib
import json
import os
import platform
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from uuid import uuid4
from eval.metrics import aggregate, score
from eval.reports import write_report

ROOT = Path(__file__).resolve().parents[1]
RUN_LOCK = Lock()
METHODOLOGY = [
    'Independent deterministic scorers inspect delivered responses and request outcomes; enforcement check implementations are not imported by the scorers. These pattern and numeric oracles are incomplete and are not human adjudication.',
    'The mock answer provider is scripted. OFF and ON use the same provider; redaction and blocking can change the input. Live pairs are separate nondeterministic calls. No real-provider performance is inferred from mock results.',
    'Policy violation includes missing disclosures. Content violation excludes disclosures. This distinction prevents routine missing OFF disclaimers from hiding the substantive results.',
    'PII leakage is measured on delivered API output after always-on privacy redaction, including OFF mode. This does not measure unredacted provider output or prove the IN-01/OUT-07 rules caused a reduction.',
    'False positives are block/escalate, input modifications, or non-disclosure output intervention when the OFF answer has no scored content violation, on legitimate cases. Repairs to scored unsafe model answers and routine disclosures are excluded. This depends on the limited independent scorers.',
    'Rule catch rate measures removal of an observed OFF violation in labelled eligible cases; it does not establish which rule caused the improvement. Trace detection is reported separately. N/A means no eligible cases, not a perfect score.',
    'MNPI catch requires no answer-model call plus block/escalate. Injection success uses observable unsafe-output patterns on labelled attack cases; subtler successful attacks may be missed.',
    'Timing is paired total request latency, including rails and model but excluding the audit write. Model/check warmup and machine load affect it; negative added latency is retained.',
    'Audit completeness requires matching persisted records, required fields and an intact chain. The chain remains a demonstration without a trusted external checkpoint.',
    'Errors are retained and excluded from scored pairs; error counts and run status must be reviewed. Empty runs and duplicate IDs are rejected. Policy snapshots and hashes identify the configuration used.',
    'Expected action allow treats disclosure-only output modification as acceptable. Action agreement is separate from violation scores. Labels express intended safe behavior, not current implementation behavior.',
]


def utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def digest(value: dict) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def results_dir() -> Path:
    return Path(os.getenv('EVAL_RESULTS_DIR', str(ROOT/'.runtime/evaluations')))


def read_result(run_id: str) -> dict:
    if not run_id or any(c not in '0123456789abcdef-' for c in run_id):
        raise ValueError('Invalid run ID')
    return json.loads((results_dir()/f'{run_id}.json').read_text())


def list_results() -> list[dict]:
    directory = results_dir()
    if not directory.exists():
        return []
    results = []
    for path in sorted(directory.glob('*.json'), key=lambda p:p.stat().st_mtime, reverse=True):
        data = json.loads(path.read_text())
        results.append({k:data[k] for k in ('id','status','finished_at','model','dataset','metrics')})
    return results


def validate_dataset(dataset: dict) -> list[dict]:
    items = dataset['items']
    if not items or len({i['id'] for i in items}) != len(items):
        raise ValueError('Dataset must be nonempty with unique IDs')
    for item in items:
        for name in ('profile','role','prompt','expected_risk_categories','expected_action','expected_rules','correct_facts','allowed_citations','legitimate'):
            if name not in item:
                raise ValueError(f"Missing {name} in {item['id']}")
    return items


async def run_evaluation(mode: str = 'mock', dataset_path: Path | None = None,
                         report_path: Path | None = None) -> dict:
    # Lazy import allows the API to call the same runner without circular imports.
    from app.main import ChatRequest, chat, store
    from app.services.policy_store import PROFILES, load
    provider = os.getenv('MODEL_PROVIDER','mock')
    if mode not in ('mock','live') or (mode=='mock') != (provider=='mock'):
        raise ValueError('Mode must match MODEL_PROVIDER. Configure the server/CLI provider before a run.')
    if provider not in ('mock','openai','anthropic'):
        raise ValueError('Unsupported provider')
    if mode=='live' and (not os.getenv('MODEL_API_KEY') or not os.getenv('MODEL_NAME')):
        raise ValueError('Live evaluation requires server-side MODEL_API_KEY and MODEL_NAME')
    if not RUN_LOCK.acquire(blocking=False):
        raise RuntimeError('An evaluation is already running in this process')
    try:
        dataset_path = dataset_path or ROOT/'data/evaluation_set.json'
        dataset_bytes = dataset_path.read_bytes()
        dataset = json.loads(dataset_bytes)
        items = validate_dataset(dataset)
        policies = {p:load(p) for p in PROFILES}
        start = utc()
        rows = []
        for index, item in enumerate(items):
            row = {k:item[k] for k in ('id','profile','expected_risk_categories','expected_action','expected_rules','legitimate')}
            row.update(off=None,on=None,error=None,action_match=False)
            # Alternate order to reduce consistent cold-start/order bias.
            for enabled in ((False,True) if index%2==0 else (True,False)):
                key = 'on' if enabled else 'off'
                try:
                    response = await chat(ChatRequest(prompt=item['prompt'],profile=item['profile'],role=item['role'],guardrails=enabled))
                    if any(t['rule_id']=='ENGINE' or t.get('check_error') for t in response['rule_results']):
                        raise RuntimeError('Provider or guardrail execution failed; not a valid scored response')
                    if response['policy_pack_version'] != f"{item['profile']}-v{policies[item['profile']]['version']}":
                        raise RuntimeError('Policy version changed during evaluation')
                    row[key] = dict(response=response,violations=score(item,response,policies[item['profile']]),audit_complete=False)
                except Exception as exc:
                    # Do not persist exception strings that may contain credentials/provider bodies.
                    row['error'] = f'{key}: {type(exc).__name__}; inspect server configuration or checks'
            if row['on']:
                response = row['on']['response']
                adverse = [t for t in response['rule_results'] if t['status']!='pass' and t['rule_id']!='OUT-05']
                effective = 'allow' if response['final_action']=='modify' and not adverse else response['final_action']
                row['action_match'] = effective == item['expected_action']
            rows.append(row)
        chain = store.verify()
        entries = {r['id']:r for r in store.entries()}
        required = {'timestamp','profile','user_role','guardrails','original_input','redacted_input','raw_model_output','final_output','rule_results','final_action','latency_ms','policy_pack_version','model_name'}
        for row in rows:
            for key in ('off','on'):
                if row[key]:
                    response = row[key]['response']
                    saved = entries.get(response['id'],{})
                    row[key]['audit_complete'] = chain['intact'] and required.issubset(saved) and all(saved.get(k)==v for k,v in response.items())
        unchanged = all(digest(load(p))==digest(policies[p]) for p in PROFILES)
        report = dict(id=str(uuid4()),started_at=start,finished_at=utc(),
                      status='completed' if unchanged and not any(r['error'] for r in rows) else 'incomplete',
                      model={'provider':provider,'name':'mock' if provider=='mock' else os.environ['MODEL_NAME']},
                      dataset={'version':dataset['version'],'sha256':hashlib.sha256(dataset_bytes).hexdigest(),'items':len(items)},
                      policies={p:{'version':v['version'],'sha256':digest(v),'snapshot':v} for p,v in policies.items()},
                      policy_unchanged=unchanged, runtime={'python':platform.python_version(),'nemo':'0.12.0','colang':'1.0'},
                      audit_chain=chain,methodology=METHODOLOGY,rows=rows,metrics=aggregate(rows))
        directory = results_dir()
        directory.mkdir(parents=True,exist_ok=True)
        target = directory/f"{report['id']}.json"
        temporary = target.with_suffix('.tmp')
        temporary.write_text(json.dumps(report,indent=2)+'\n')
        temporary.replace(target)
        write_report(report, report_path or Path(os.getenv('EVAL_REPORT_PATH', str(ROOT.parent/'docs/evaluation-report.md'))))
        return report
    finally:
        RUN_LOCK.release()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--mode',choices=['mock','live'],default='mock')
    parser.add_argument('--dataset',type=Path)
    parser.add_argument('--report',type=Path)
    args = parser.parse_args()
    report = asyncio.run(run_evaluation(args.mode,args.dataset,args.report))
    print(json.dumps({k:report[k] for k in ('id','status','model','metrics')},indent=2))
    if report['status']!='completed':
        raise SystemExit(1)


if __name__ == '__main__':
    main()
