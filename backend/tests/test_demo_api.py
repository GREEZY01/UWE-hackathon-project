import asyncio
import json
import pytest
from fastapi.testclient import TestClient
from app.routes.demo import CompareRequest, compare, scenarios
from app.services.policy_store import ROOT


@pytest.fixture(autouse=True)
def isolate(monkeypatch,tmp_path):
    from app import main
    from audit.store import AuditStore
    monkeypatch.setenv('MODEL_PROVIDER','mock')
    monkeypatch.setenv('POLICY_DB',str(tmp_path/'policy.db'))
    monkeypatch.setattr(main,'store',AuditStore(str(tmp_path/'audit.db')))


def test_ten_comparisons_and_exports():
    from app.main import app
    client=TestClient(app)
    library=client.get('/demo/scenarios').json()
    assert len(library)>=10 and len({s['profile'] for s in library})==4
    for scenario in library:
        response=client.post('/demo/compare',json={'scenario_id':scenario['id']})
        assert response.status_code==200,response.text
        pair=response.json()
        assert not pair['cached'] and pair['model']['provider']=='mock'
        assert pair['off']['guardrails'] is False and pair['on']['guardrails'] is True
        assert pair['off']['id']!=pair['on']['id']
        if 'mnpi' in scenario['expected_risk_categories']:
            assert not pair['on']['model_called']
    assert client.get('/audit/verify').json()['records']==20
    selected=client.get('/audit?profile=client&action=modify').json()
    exported=client.get('/audit/export?format=json&profile=client&action=modify').json()
    assert selected and exported==selected
    assert 'previous_hash,hash' in client.get('/audit/export?format=csv').text
    assert client.get('/audit?date_from=2099-01-01').json()==[]


def test_custom_context_categories_are_unknown():
    result=asyncio.run(compare(CompareRequest(prompt='What is the account fee?')))
    assert result['scores']['on']['mnpi'] is None
    assert result['scores']['off']['injection'] is None


def test_live_and_invalid_scenario_rejected():
    from app.main import app
    client=TestClient(app)
    assert client.post('/demo/compare',json={'scenario_id':'client-07','mode':'live'}).status_code==400
    assert client.post('/demo/compare',json={'scenario_id':'missing'}).status_code==404
    assert client.post('/demo/compare',json={}).status_code==422


def test_cache_provenance():
    cache=json.loads((ROOT/'data/cached_demo.json').read_text())
    assert cache['provider']=='mock'
    assert set(cache['results'])=={s['id'] for s in scenarios()}
    for result in cache['results'].values():
        assert result['cached'] and result['model']['provider']=='mock'
        assert result['on']['policy_pack_version']
        assert result['on']['rule_results']
