import re
from actions.base import Finding, pattern


def check(text: str, context: dict) -> Finding:
    return pattern(text, 'you should (buy|invest|sell)|I recommend you (invest|buy)|put your savings (into|in)', 'I can provide general product information. For a personal recommendation, consult an appropriately regulated adviser.', 'Personalised recommendation exceeds the advice boundary.')
