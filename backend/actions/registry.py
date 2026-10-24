import importlib
import time
from actions.base import Finding
from actions.sensitive_data import redact

MODULES = dict(zip(['IN-02','IN-03','IN-04','IN-05','OUT-01','OUT-02','OUT-03','OUT-04','OUT-05','OUT-06','OUT-07','OUT-08','OUT-09','OUT-10'], ['injection','scope','mnpi','access_control','misleading_language','advice','grounding','citations','disclosures','vulnerability','confidentiality','fairness','tipping_off','explainability']))
# Disclosures last so later replacements cannot remove them.
ORDER = ['IN-01','IN-02','IN-03','IN-04','IN-05','OUT-01','OUT-02','OUT-03','OUT-04','OUT-06','OUT-07','OUT-08','OUT-09','OUT-10','OUT-05']


def run(stage: str, text: str, context: dict) -> dict:
    state = context['state']
    pack = state['policy']
    checks = {r['id']: r for r in pack['rules']}
    # Inspect the original output for every risk, even after a prior rule replaces it.
    original = text
    terminal = False
    for rid in ORDER:
        rule = checks[rid]
        if rule['stage'] != stage or not rule['enabled']:
            continue
        started = time.perf_counter()
        failed = False
        try:
            if rid == 'IN-01':
                cleaned, evidence = redact(text)
                finding = Finding(evidence, cleaned, 'Supported sensitive identifiers redacted before model access.')
            else:
                module = importlib.import_module('actions.' + MODULES[rid])
                finding = module.check(text if rid in ('OUT-05','OUT-10') else original, state)
            fired = len(finding.evidence) >= rule['thresholds']['min_matches']
            action = rule['action'] if fired else 'allow'
            status = {'allow':'pass','log':'pass','modify':'modified','block':'blocked','escalate':'escalated'}[action]
        except Exception:
            failed = True
            finding = Finding(['check execution error'], 'A required check failed. Please contact an authorised human reviewer.', 'Check failed; response withheld.')
            action, status = 'block', 'blocked'
            fired = True
        if fired and action in ('modify','block','escalate'):
            if not terminal or rid == 'OUT-05':
                text = finding.replacement or 'This request requires authorised human review.'
            if action in ('block','escalate'):
                terminal = True
        state['trace'].append(dict(rule_id=rid, name=rule['description'], stage=stage,
            status=status, severity=rule['severity'], explanation=finding.explanation,
            regulation_references=rule['regulations'], evidence=[redact(str(e))[0] for e in finding.evidence],
            detected=fired, configured_action=rule['action'], check_error=failed,
            latency_ms=(time.perf_counter()-started)*1000, method='deterministic/pattern'))
    if stage == 'input':
        state['redacted'] = text
        state['input_terminal'] = terminal
    return {'text':text, 'terminal':terminal}


async def input_checks(context: dict) -> dict:
    return run('input', context['user_message'], context)


async def output_checks(context: dict) -> dict:
    return run('output', context['bot_message'], context)
