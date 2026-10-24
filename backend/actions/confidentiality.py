import re
from actions.base import Finding
from actions.sensitive_data import redact


def check(text: str, context: dict) -> Finding:
    cleaned, kinds = redact(text)
    confidential = bool(re.search(r'internal.only|confidential client|other client.s|NB-RESTRICTED', text, re.I))
    evidence = kinds + (['restricted content marker'] if confidential else [])
    return Finding(evidence, 'I cannot disclose personal or restricted information. Please use authorised channels.' if evidence else None, 'Checks supported PII patterns and explicit restricted-content markers only.')
