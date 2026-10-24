import re
from actions.base import Finding, pattern


def check(text: str, context: dict) -> Finding:
    return pattern(text, 'suspicious activity report|\\bSAR\\b|reported.{0,30}(authorities|police)|investigating.{0,30}money laundering', 'We are reviewing your enquiry and will contact you through approved channels. Please refer this communication to the authorised compliance team.', 'Potential disclosure of a financial-crime investigation or reporting activity.')
