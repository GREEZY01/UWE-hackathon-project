from actions.base import Finding


def check(text: str, context: dict) -> Finding:
    disclosure = context['policy']['disclosure']
    missing = disclosure not in text
    return Finding(['missing disclosure'] if missing else [], text + '\n\n' + disclosure if missing else None, 'Profile disclosure appended when absent.')
