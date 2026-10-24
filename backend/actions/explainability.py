import re
from actions.base import Finding


def check(text: str, context: dict) -> Finding:
    decision = bool(re.search(r'decision|approve|reject|decline|eligib|case', context['original'], re.I))
    missing = decision and not re.search(r'Factors used:\s*\S', text, re.I)
    return Finding(['missing decision factors'] if missing else [], text + '\n\nFactors used: not established from verified evidence. No decision should be made until a human reviewer documents the relevant factors.' if missing else None, 'Decision-support answers require an explicit factors note; this is a format check, not reasoning verification.')
