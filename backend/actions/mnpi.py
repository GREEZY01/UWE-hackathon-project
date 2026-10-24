import re
from actions.base import Finding, pattern


def check(text: str, context: dict) -> Finding:
    return pattern(text, 'unannounced|unreleased earnings|not public yet|inside information|non.public.{0,20}(merger|acquisition|earnings)', 'Potential inside information detected. Do not share or trade on it; contact compliance.', 'Potential MNPI requires compliance review before any model call.')
