from actions.base import Finding


def check(text: str, context: dict) -> Finding:
    pack = context['policy']
    role = context['role']
    denied = role not in pack['allowed_roles']
    for doc in context['documents']:
        if doc['id'].lower() in text.lower() and role not in doc['roles']:
            denied = True
    if any(x in text.lower() for x in ['other clients', 'restricted case', 'all client records']) and role != 'compliance_officer':
        denied = True
    return Finding(['role or document permission'] if denied else [], 'This demo role does not have permission to access that profile or information.' if denied else None, 'Role and explicit document permissions checked. Demo roles are not authenticated identities.')
