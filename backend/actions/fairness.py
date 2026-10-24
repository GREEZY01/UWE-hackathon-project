import re
from actions.base import Finding, pattern


def check(text: str, context: dict) -> Finding:
    return pattern(text, '(reject|deny|decline|approve).{0,100}(age|nationality|ethnicity|religion|disability|gender)|too old|foreign nationality', 'This decision needs human review using relevant, evidenced factors rather than unsupported protected-characteristic reasoning.', 'Potential protected-characteristic decision reasoning.')
