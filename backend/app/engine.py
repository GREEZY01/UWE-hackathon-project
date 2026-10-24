import time
import os
from app.judge import InputJudge
from nemoguardrails.library.self_check.input_check.actions import self_check_input
from nemoguardrails.actions.actions import ActionResult
from pathlib import Path
from nemoguardrails import LLMRails, RailsConfig
from actions.registry import input_checks, output_checks
from app.model import generate


def make_engine(profile: str = 'client') -> LLMRails:
    config = RailsConfig.from_path(str(Path(__file__).resolve().parents[1] / 'guardrails' / profile))
    engine = LLMRails(config)
    async def checked_input(context: dict) -> dict:
        outcome = await input_checks(context)
        state = context['state']
        rule = next(r for r in state['policy']['rules'] if r['id']=='IN-02')
        if not rule['enabled'] or outcome['terminal']:
            return outcome
        started = time.perf_counter()
        try:
            verdict = await self_check_input(
                llm_task_manager=engine.runtime.llm_task_manager,
                context={'user_message':outcome['text']}, llm=InputJudge(), config=config)
            allowed = verdict.return_value if isinstance(verdict, ActionResult) else verdict
            if not isinstance(allowed, bool):
                raise ValueError('Invalid self-check result')
            failed = False
        except Exception:
            allowed, failed = False, True
        trace = next(r for r in state['trace'] if r['rule_id']=='IN-02')
        trace['method'] = 'patterns + NeMo self-check (' + ('deterministic mock' if os.getenv('MODEL_PROVIDER','mock')=='mock' else 'model judge') + ')'
        trace['latency_ms'] += (time.perf_counter()-started)*1000
        if not allowed:
            trace.update(detected=True, check_error=failed,
                         explanation='Self-check failed closed.' if failed else 'NeMo self-check identified an instruction attack.',
                         evidence=['self-check error' if failed else 'unsafe self-check verdict'])
            action = 'block' if failed else rule['action']
            trace['status'] = {'allow':'pass','log':'pass','modify':'modified','block':'blocked','escalate':'escalated'}[action]
            if action in ('modify','block','escalate'):
                outcome = {'text':'I cannot process this input safely. Please contact an authorised colleague.', 'terminal':action in ('block','escalate')}
                state['redacted'] = outcome['text']
                state['input_terminal'] = outcome['terminal']
        return outcome
    engine.register_action(checked_input, name='finguard_input')
    engine.register_action(output_checks, name='finguard_output')
    async def passthrough(context: dict, events=None) -> str:
        state = context['state']
        if state.get('input_terminal'):
            return state['redacted']
        started = time.perf_counter()
        raw = await generate(context['user_message'], state['policy']['system_prompt'])
        state['raw'] = raw
        state['model_ms'] = (time.perf_counter()-started)*1000
        state['model_called'] = True
        return raw
    # Verified against 0.12.0 source and integration tests; internal hook, retest on upgrade.
    engine.llm_generation_actions.passthrough_fn = passthrough
    return engine
