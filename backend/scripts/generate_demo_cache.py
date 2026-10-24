"""Generate actual mock comparisons for offline presentation, never invented metrics."""
import asyncio
import json
import os
from datetime import datetime, timezone
from app.routes.demo import compare, scenarios, CompareRequest
from app.services.policy_store import ROOT


async def main() -> None:
    if os.getenv('MODEL_PROVIDER','mock')!='mock':
        raise RuntimeError('Demo cache must be generated with the mock provider')
    results = {}
    for scenario in scenarios():
        result = await compare(CompareRequest(scenario_id=scenario['id']))
        result['cached'] = True
        results[scenario['id']] = result
    payload = {'generated_at':datetime.now(timezone.utc).isoformat(),'provider':'mock','scenarios':scenarios(),'results':results}
    content = json.dumps(payload,indent=2)+'\n'
    (ROOT/'data/cached_demo.json').write_text(content)
    destination = ROOT.parent/'frontend/public/cached-demo.json'
    destination.parent.mkdir(parents=True,exist_ok=True)
    destination.write_text(content)
    print(f'Generated {len(results)} mock comparison pairs')


if __name__=='__main__':
    asyncio.run(main())
