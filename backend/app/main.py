import os
import time
from datetime import datetime, timezone
from typing import Literal
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from actions.sensitive_data import redact
import json
from app.services.policy_store import load, update, PolicyEdit, ROOT, PROFILES
from app.engine import make_engine
from app.model import generate
from audit.store import AuditStore

app = FastAPI(title='FinGuard — Stage 5')
app.add_middleware(CORSMiddleware, allow_origins=['http://localhost:5173'], allow_methods=['GET','POST','PUT'], allow_headers=['Content-Type'])
store = AuditStore(os.getenv('AUDIT_DB', '/tmp/finguard.sqlite3'))
engines = {p: make_engine(p) for p in PROFILES}
engine = engines['client']


class ChatRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=20000)
    profile: Literal['client','research','compliance','staff'] = 'client'
    role: Literal['client', 'analyst', 'compliance_officer', 'staff'] = 'client'
    guardrails: bool = True


@app.get('/health')
def health():
    return {'status':'ok', 'nemo':'0.12.0', 'colang':'1.0', 'stage':5, 'provider':os.getenv('MODEL_PROVIDER','mock'), 'live_available':os.getenv('MODEL_PROVIDER','mock')!='mock' and bool(os.getenv('MODEL_API_KEY')) and bool(os.getenv('MODEL_NAME'))}


@app.post('/chat')
async def chat(request: ChatRequest):
    started = time.perf_counter()
    trace, capture = [], {}
    policy = load(request.profile)
    state = dict(policy=policy, profile=request.profile, role=request.role, original=redact(request.prompt)[0],
                 trace=trace, documents=json.loads((ROOT/'data/research_documents.json').read_text()),
                 facts=json.loads((ROOT/'data/approved_products.json').read_text())['facts'], model_called=False)

    action = 'allow'
    try:
        if request.guardrails:
            response = await engines[request.profile].generate_async(messages=[
                {'role':'context','content':{'state':state}},
                {'role':'user','content':request.prompt}])
            final = response['content']
            capture = {'raw':state.get('raw',''), 'redacted':state.get('redacted','')}
            statuses = {r['status'] for r in trace}
            action = 'escalate' if 'escalated' in statuses else 'block' if 'blocked' in statuses else 'modify' if 'modified' in statuses else 'allow'
            expected = {r['id'] for r in policy['rules'] if r['enabled'] and (not state.get('input_terminal') or r['stage']=='input')}
            if not expected.issubset({r['rule_id'] for r in trace}):
                raise RuntimeError('Required rails did not complete')
        else:
            final = await generate(request.prompt, policy['system_prompt'])
            capture = {'raw':final, 'redacted':request.prompt}
    except Exception:
        final = 'Unable to complete the required safety checks. Please contact a human colleague.'
        action = 'block'
        trace.append(dict(rule_id='ENGINE', name='Safety availability', stage='input', status='blocked', severity='high', explanation='Provider or required check failed; response withheld.', regulation_references=[], evidence=[]))
    elapsed = (time.perf_counter()-started)*1000
    record = dict(timestamp=datetime.now(timezone.utc).isoformat(), profile=request.profile,
                  user_role=request.role, guardrails=request.guardrails,
                  original_input=redact(request.prompt)[0], redacted_input=redact(capture.get('redacted',request.prompt))[0],
                  raw_model_output=redact(capture.get('raw',''))[0], final_output=redact(final)[0],
                  rule_results=trace, final_action=action, latency_ms={'total':elapsed, 'input':sum(r.get('latency_ms',0) for r in trace if r['stage']=='input'), 'model':state.get('model_ms',0), 'output':sum(r.get('latency_ms',0) for r in trace if r['stage']=='output')}, model_called=state['model_called'] if request.guardrails else True,
                  policy_pack_version=f'{request.profile}-v{policy["version"]}', model_name=os.getenv('MODEL_NAME','mock') if os.getenv('MODEL_PROVIDER','mock') != 'mock' else 'mock')
    audit_id = store.append(record)
    return dict(id=audit_id, **record)


def filtered_audit(profile=None, action=None, rule=None, severity=None, date_from=None, date_to=None):
    return [r for r in store.entries() if
            (not profile or r['profile']==profile) and
            (not action or r['final_action']==action) and
            (not rule or any(t['rule_id']==rule for t in r['rule_results'])) and
            (not severity or any(t['severity']==severity for t in r['rule_results'])) and
            (not date_from or r['timestamp'][:10]>=date_from) and
            (not date_to or r['timestamp'][:10]<=date_to)]


@app.get('/audit')
def audit(profile: str | None=None, action: str | None=None, rule: str | None=None,
          severity: str | None=None, date_from: str | None=None, date_to: str | None=None):
    return filtered_audit(profile,action,rule,severity,date_from,date_to)


@app.get('/audit/export')
def export_audit(format: Literal['json','csv']='json', profile: str | None=None,
                 action: str | None=None, rule: str | None=None, severity: str | None=None,
                 date_from: str | None=None, date_to: str | None=None):
    import csv
    import io
    from fastapi.responses import Response
    rows=filtered_audit(profile,action,rule,severity,date_from,date_to)
    if format=='json':
        return Response(json.dumps(rows,indent=2),media_type='application/json',headers={'Content-Disposition':'attachment; filename=finguard-audit.json'})
    output=io.StringIO()
    fields=['id','timestamp','profile','user_role','guardrails','original_input','redacted_input','raw_model_output','final_output','rule_results','final_action','latency_ms','policy_pack_version','model_name','previous_hash','hash']
    writer=csv.DictWriter(output,fieldnames=fields)
    writer.writeheader()
    for row in rows:
        cells={k:json.dumps(row.get(k)) if isinstance(row.get(k),(dict,list)) else row.get(k,'') for k in fields}
        cells={k:("'"+v if isinstance(v,str) and v.startswith(('=','+','-','@')) else v) for k,v in cells.items()}
        writer.writerow(cells)
    return Response(output.getvalue(),media_type='text/csv',headers={'Content-Disposition':'attachment; filename=finguard-audit.csv'})


@app.get('/audit/verify')
def verify():
    return store.verify()


@app.get('/policies')
def policies():
    return [load(p) for p in PROFILES]


@app.get('/policies/{profile}')
def policy(profile: str):
    if profile not in PROFILES:
        raise HTTPException(404, 'Unknown profile')
    return load(profile)


@app.put('/policies/{profile}')
def edit_policy(profile: str, edit: PolicyEdit):
    if profile not in PROFILES:
        raise HTTPException(404, 'Unknown profile')
    try:
        return update(profile, edit)
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc


from eval.routes import router as evaluation_router
app.include_router(evaluation_router)


from app.routes.demo import router as demo_router
app.include_router(demo_router)
