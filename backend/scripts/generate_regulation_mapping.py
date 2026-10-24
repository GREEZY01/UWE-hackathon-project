import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
lines = ['# Regulation mapping', '', 'Illustrative, not legal advice. Applicability depends on jurisdiction, permissions and deployment.', '', '| Profile | Rule | Framework | Rationale |', '|---|---|---|---|']
for path in sorted((root/'policies').glob('*.json')):
    pack = json.loads(path.read_text())
    for rule in pack['rules']:
        if rule['enabled']:
            for mapping in rule['regulations']:
                lines.append(f"| {pack['profile']} | {rule['id']} | {mapping['reference']} | {mapping['explanation']} |")
(root.parent/'docs/regulation-mapping.md').write_text('\n'.join(lines)+'\n')
