import re
from actions.base import Finding, pattern


def check(text: str, context: dict) -> Finding:
    return pattern(text, 'guaranteed|risk.free|can.t lose|certain to|definitely.{0,30}(profit|money|return)', 'Returns are uncertain and you may lose money. Review the approved product information.', 'Promissory wording replaced with general risk information.')
