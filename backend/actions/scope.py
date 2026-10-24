import re
from actions.base import Finding


def check(text: str, context: dict) -> Finding:
    if re.search(r'\b(weather|recipe|football|write a poem|gaming tips)\b', text, re.I):
        return Finding(['out-of-scope topic'], 'I can help with this profile’s financial-services topics. Please ask a question within that scope.', 'Known out-of-scope intent detected; scope classification is heuristic.')
    return Finding(explanation='No known out-of-scope intent found; open-ended requests are not fully classified.')
