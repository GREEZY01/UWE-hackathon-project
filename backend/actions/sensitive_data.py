"""Pattern detection with Luhn and IBAN checksum validation; no Presidio model."""
import re


def luhn(value: str) -> bool:
    digits = [int(c) for c in value if c.isdigit()]
    return 13 <= len(digits) <= 19 and len(set(digits)) > 1 and sum(
        d if i % 2 == 0 else (2*d-9 if d > 4 else 2*d)
        for i, d in enumerate(reversed(digits))
    ) % 10 == 0


def iban_valid(value: str) -> bool:
    value = re.sub(r'\s', '', value).upper()
    if not re.fullmatch(r'[A-Z]{2}\d{2}[A-Z0-9]{11,30}', value):
        return False
    rearranged = value[4:] + value[:4]
    return int(''.join(str(ord(c)-55) if c.isalpha() else c for c in rearranged)) % 97 == 1


def redact(text: str) -> tuple[str, list[str]]:
    kinds: list[str] = []
    patterns = [
        ('IBAN', r'\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]){11,30}\b', iban_valid),
        ('CARD', r'(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)', luhn),
        ('EMAIL', r'\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b', None),
        ('SORT_CODE', r'\b\d{2}-\d{2}-\d{2}\b', None),
        ('ACCOUNT', r'\b(?:account(?: number)?|a/c)\s*[:#]?\s*\d{8}\b', None),
        ('NI', r'\b[ABCEGHJ-PRSTW-Z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-D]\b', None),
        ('SSN', r'\b\d{3}-\d{2}-\d{4}\b', None),
        ('DOB', r'\b(?:dob|date of birth|born)\s*:?\s*(?:\d{1,4}[-/]\d{1,2}[-/]\d{1,4}|\d{1,2}\s+[A-Za-z]+\s+\d{4})\b', None),
        ('PHONE', r'(?<!\w)(?:\+\d{1,3}[ .-]?)?(?:\(?0?\d{2,4}\)?[ .-]?){2,3}\d{3,4}(?!\w)', None),
    ]
    for kind, pattern, validator in patterns:
        def replace(match: re.Match) -> str:
            value = match.group()
            if validator and not validator(value):
                return value
            if kind == 'PHONE' and not 10 <= len(re.sub(r'\D', '', value)) <= 12:
                return value
            kinds.append(kind.lower())
            return f'[REDACTED_{kind}]'
        text = re.sub(pattern, replace, text, flags=re.I)
    return text, kinds
