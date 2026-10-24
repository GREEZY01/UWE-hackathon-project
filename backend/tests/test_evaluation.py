import asyncio
import copy
import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from eval.metrics import CATEGORIES, aggregate, rate, score, unsupported_figures
from eval.runner import ROOT, run_evaluation, validate_dataset
from app.services.policy_store import load


def test_numeric_oracle():
    facts=[{'entity':'easy saver','value':'4.6','unit':'percent'}]
    assert not unsupported_figures('Easy Saver pays 4.6 per cent. [NB-PRODUCTS]',facts)
    assert unsupported_figures('Fixed Saver pays 4.6%.',facts)
    assert unsupported_figures('Easy Saver pays 9.9%.',facts)
    assert not unsupported_figures('case alpha GBP 1,200',[{'entity':'case alpha','value':'1200','unit':'GBP'}])


def test_scorer_does_not_treat_generated_as_rate():
    item=json.loads((ROOT/'data/evaluation_set.json').read_text())['items'][20]
    response={'final_output':'A sourced answer is not available. AI-generated: verify before use.','final_action':'modify','model_called':True}
    assert not score(item,response,load('research'))['citations']
    response['final_output']='Easy Saver pays 4.6%.'
    assert score(item,response,load('research'))['citations']
    response['final_output']+=' [NB-PRODUCTS]'
    assert not score(item,response,load('research'))['citations']


def sample_row():
    clean=dict.fromkeys(CATEGORIES,False)
    risky={**clean,'advice':True}
    response={'final_action':'modify','model_called':True,'latency_ms':{'total':10},'rule_results':[]}
    return dict(id='one',profile='client',expected_risk_categories=['advice'],expected_rules=['OUT-02'],legitimate=False,action_match=True,
                off={'violations':risky,'response':copy.deepcopy(response),'audit_complete':True},
                on={'violations':clean,'response':copy.deepcopy(response),'audit_complete':True})


def test_metric_denominators_and_error_exclusion():
    row=sample_row()
    row['on']['response']['latency_ms']['total']=15
    error={**row,'off':None,'on':None,'error':'failed'}
    result=aggregate([row,error])
    overall=result['overall']
    assert overall['items']==2 and overall['paired_items']==1 and overall['errors']==1
    assert overall['content_violation']['off']==rate(1,1)
    assert overall['content_violation']['on']==rate(0,1)
    assert overall['average_added_latency_ms']==5
    assert overall['false_positive']['rate'] is None
    assert result['by_rule']['OUT-02']['catch_rate']==rate(1,1)
    assert result['by_rule']['IN-01']['catch_rate']['rate'] is None


def test_false_positive_not_disclosure():
    row=sample_row()
    row['legitimate']=True
    row['on']['response']['rule_results']=[{'rule_id':'OUT-05','stage':'output','status':'modified'}]
    assert aggregate([row])['overall']['false_positive']==rate(0,1)
    row['on']['response']['rule_results'].append({'rule_id':'IN-03','stage':'input','status':'blocked'})
    assert aggregate([row])['overall']['false_positive']==rate(1,1)


@pytest.fixture
def isolated(monkeypatch,tmp_path):
    from app import main
    from audit.store import AuditStore
    monkeypatch.setenv('MODEL_PROVIDER','mock')
    monkeypatch.setenv('POLICY_DB',str(tmp_path/'policies.db'))
    monkeypatch.setenv('EVAL_RESULTS_DIR',str(tmp_path/'runs'))
    monkeypatch.setenv('EVAL_REPORT_PATH',str(tmp_path/'report.md'))
    monkeypatch.setattr(main,'store',AuditStore(str(tmp_path/'audit.db')))
    return tmp_path


def test_full_evaluation_api(isolated):
    from app.main import app
    client=TestClient(app)
    response=client.post('/evaluation/run',json={'mode':'mock'})
    assert response.status_code==200
    report=response.json()
    assert report['status']=='completed'
    assert len(report['rows'])==80
    assert report['metrics']['overall']['paired_items']==80
    assert report['metrics']['overall']['audit_complete']['on']==rate(80,80)
    assert report['metrics']['overall']['audit_complete']['off']==rate(80,80)
    assert all(report['metrics']['by_profile'][p]['items']==20 for p in ('client','research','compliance','staff'))
    assert client.get('/evaluation/runs').json()[0]['id']==report['id']
    saved=client.get('/evaluation/runs/'+report['id']).json()
    assert saved['metrics']==report['metrics']
    assert 'mock / mock' in (isolated/'report.md').read_text()
    assert client.post('/evaluation/run',json={'mode':'live'}).status_code==400
    assert client.get('/evaluation/runs/not-a-uuid').status_code==404


def test_invalid_dataset():
    with pytest.raises(ValueError):
        validate_dataset({'items':[]})
    with pytest.raises(ValueError):
        validate_dataset({'items':[{'id':'same'},{'id':'same'}]})


def test_failed_calls_not_reported_as_safe(isolated,monkeypatch):
    from app import main
    async def failed(request):
        raise RuntimeError('do not store provider error details')
    monkeypatch.setattr(main,'chat',failed)
    dataset=json.loads((ROOT/'data/evaluation_set.json').read_text())
    dataset['items']=dataset['items'][:1]
    path=isolated/'dataset.json'
    path.write_text(json.dumps(dataset))
    report=asyncio.run(run_evaluation(dataset_path=path))
    assert report['status']=='incomplete'
    assert report['metrics']['overall']['paired_items']==0
    assert report['metrics']['overall']['content_violation']['on']['rate'] is None
    assert 'do not store provider' not in json.dumps(report)


def test_unnecessary_output_change_is_false_positive():
    row=sample_row()
    row['legitimate']=True
    row['off']['violations']=dict.fromkeys(CATEGORIES,False)
    row['on']['response']['rule_results']=[{'rule_id':'OUT-10','stage':'output','status':'modified'}]
    assert aggregate([row])['overall']['false_positive']==rate(1,1)
