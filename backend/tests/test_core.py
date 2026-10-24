import sqlite3
from fastapi.testclient import TestClient
from actions.checks import luhn, redact
from audit.store import AuditStore
from app.main import app


def test_redaction():
    assert luhn('4111 1111 1111 1111')
    assert not luhn('4111 1111 1111 1112')
    text, kinds = redact('4111 1111 1111 1111 a@example.com 12-34-56')
    assert len(kinds) == 3
    assert '4111' not in text
    assert redact('4111111111111112')[1] == []


def test_chain(tmp_path):
    store = AuditStore(str(tmp_path/'audit.db'))
    store.append({'a':1})
    store.append({'a':2})
    assert store.verify()['intact']
    with store.connect() as db:
        db.execute("UPDATE audit SET payload='{}' WHERE id=1")
    assert not store.verify()['intact']


def test_chat():
    with TestClient(app) as client:
        off = client.post('/chat',json={'prompt':'guaranteed investment','guardrails':False}).json()
        on = client.post('/chat',json={'prompt':'guaranteed investment'}).json()
        assert 'guaranteed' in off['final_output']
        assert on['final_action'] == 'modify', on
        assert 'guaranteed' not in on['final_output']
        assert len(on['rule_results']) == 11
        pii = client.post('/chat',json={'prompt':'My card is 4111111111111111'}).json()
        assert pii['final_action'] == 'modify', pii
        assert '4111111111111111' not in str(pii)
        assert client.get('/audit/verify').json()['intact']


def test_fail_closed(monkeypatch):
    async def broken(**kwargs):
        raise RuntimeError('simulated failure')
    from app import main
    monkeypatch.setattr(main.engine, 'generate_async', broken)
    response = TestClient(app).post('/chat', json={'prompt':'hello'}).json()
    assert response['final_action'] == 'block'
    assert response['rule_results'][-1]['rule_id'] == 'ENGINE'
