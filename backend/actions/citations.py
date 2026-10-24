import re
from actions.base import Finding


def check(text: str, context: dict) -> Finding:
    allowed = {d['id'] for d in context['documents'] if context['role'] in d['roles'] and not d.get('restricted')}
    clauses = [s for s in text.split('\n') if s.strip()]
    bad = [s for s in clauses if not any(f'[{doc}]' in s for doc in allowed)]
    return Finding(['uncited paragraph'] if bad else [], 'A sourced answer is not available. Please consult approved research documents and verify their support for each claim.' if bad else None, 'Each nonempty research paragraph requires an allowed source ID; this does not prove entailment.')
