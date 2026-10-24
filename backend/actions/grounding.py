"""Conservative entity/value/unit matching; not semantic fact verification."""
import re
from decimal import Decimal
from actions.base import Finding

NUMBER = re.compile(r'(?P<currency>GBP|£|USD|\$)?\s*(?P<value>\d[\d,]*(?:\.\d+)?)\s*(?P<unit>%|per cent|percent|months)?', re.I)


def check(text: str, context: dict) -> Finding:
    evidence = []
    # Source identifiers are labels, not financial figures.
    cleaned = re.sub(r'\[NB-[A-Z0-9-]+\]', '', text)
    for sentence in re.split(r'(?<=[.!?])\s+|\n', cleaned):
        for match in NUMBER.finditer(sentence):
            value = Decimal(match['value'].replace(',', ''))
            unit = 'GBP' if match['currency'] in ('GBP','£') else 'percent' if match['unit'] and match['unit'].lower() in ('%','per cent','percent') else match['unit'] or 'number'
            supported = any(context['profile'] in f['profile'] and f['entity'] in sentence.lower() and Decimal(f['value']) == value and f['unit'] == unit for f in context['facts'])
            if not supported:
                evidence.append(match.group().strip())
    return Finding(evidence, 'I cannot verify these figures against the approved fictional data. Please consult the approved source or a human reviewer.' if evidence else None, 'Unsupported or ambiguous figures withheld; matching requires entity, value, unit and profile.')
