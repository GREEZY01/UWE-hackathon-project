from dataclasses import dataclass, field
import re


@dataclass
class Finding:
    evidence: list[str] = field(default_factory=list)
    replacement: str | None = None
    explanation: str = 'No matching risk found by this check.'


def pattern(text: str, expression: str, replacement: str, explanation: str) -> Finding:
    matches = [m.group() for m in re.finditer(expression, text, re.I | re.S)]
    return Finding(matches, replacement if matches else None, explanation if matches else 'No matching risk found by this pattern check.')
