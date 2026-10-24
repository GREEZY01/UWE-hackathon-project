import asyncio
import json
import os
from pathlib import Path
from typing import Literal
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from app.services.policy_store import ROOT, load
from eval.metrics import score

router = APIRouter(prefix='/demo', tags=['demo'])


class CompareRequest(BaseModel):
    scenario_id: str | None = None
    prompt: str | None = Field(default=None, min_length=1, max_length=20000)
    profile: Literal['client','research','compliance','staff'] = 'client'
    role: Literal['client','analyst','compliance_officer','staff'] = 'client'
    mode: Literal['mock','live'] = 'mock'


def scenarios() -> list[dict]:
    return json.loads((ROOT/'data/scenarios.json').read_text())


@router.get('/scenarios')
def scenario_list():
    return scenarios()


@router.post('/compare')
async def compare(request: CompareRequest):
    from app.main import chat, ChatRequest
    provider = os.getenv('MODEL_PROVIDER','mock')
    if (request.mode=='mock') != (provider=='mock'):
        raise HTTPException(400,'Selected mode does not match the configured server provider.')
    if request.mode=='live' and not (os.getenv('MODEL_API_KEY') and os.getenv('MODEL_NAME')):
        raise HTTPException(400,'Live mode requires credentials configured on the server.')
    if request.scenario_id:
        item = next((s for s in scenarios() if s['id']==request.scenario_id),None)
        if item is None:
            raise HTTPException(404,'Scenario not found')
    elif request.prompt:
        item = dict(id='custom',title='Custom comparison',profile=request.profile,role=request.role,
                    prompt=request.prompt,expected_risk_categories=[],correct_facts=[f for f in json.loads((ROOT/'data/approved_products.json').read_text())['facts'] if request.profile in f['profile']],allowed_citations=['NB-PRODUCTS','NB-RESEARCH-01'])
    else:
        raise HTTPException(422,'Choose a scenario or enter a prompt.')
    off, on = await asyncio.gather(*[chat(ChatRequest(prompt=item['prompt'],profile=item['profile'],role=item['role'],guardrails=enabled)) for enabled in (False,True)])
    if any(t['rule_id']=='ENGINE' or t.get('check_error') for response in (off,on) for t in response['rule_results']):
        raise HTTPException(503,'A provider or safety check failed. Use cached results or review server configuration.')
    policy = load(item['profile'])
    scores = {key:score(item,response,policy) for key,response in [('off',off),('on',on)]}
    # Unlabelled custom prompts cannot establish intent-based outcomes.
    if item['id']=='custom':
        for side in scores.values():
            for category in ('injection','mnpi','access','scope','vulnerability','explainability'):
                side[category] = None
    return dict(scenario_id=item['id'],off=off,on=on,scores=scores,
                removed_risks=[c for c,v in scores['off'].items() if v is True and scores['on'][c] is False],
                model={'provider':provider,'name':off['model_name']},cached=False,
                note='Independent heuristic scorecard; not a compliance guarantee. Unlabelled intent categories are N/A.')
