import re
from actions.base import Finding, pattern


def check(text: str, context: dict) -> Finding:
    return pattern(text, 'ignore.{0,40}(instructions|rules)|reveal.{0,30}system prompt|export.{0,30}client data|bypass.{0,30}(policy|access)|<\\s*system\\s*>', 'I cannot follow instructions that bypass policy or disclose protected information.', 'Possible direct or document-borne instruction attack.')
