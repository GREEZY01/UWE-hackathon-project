# Stage 2 complete file contents

## .env.example

```
MODEL_PROVIDER=mock
MODEL_NAME=
MODEL_API_KEY=
MODEL_BASE_URL=https://api.openai.com/v1
AUDIT_DB=/tmp/finguard.sqlite3

```

## .gitignore

```
__pycache__/
.pytest_cache/
*.sqlite3
.env
.venv/

```

## README.md

```
# FinGuard — Stage 2
Demo with fictional data. Not financial, legal or regulatory advice.

Python 3.11, NeMo Guardrails 0.12.0, Colang 1.0.

```sh
python3.11 -m venv .venv
.venv/bin/pip install -r backend/requirements.lock
cd backend
../.venv/bin/python -m pytest -q
../.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
```

In the prepared cloud machine use `/workspace/finguard-venv/bin/python` and
`/workspace/finguard-venv/bin/uvicorn` instead.

POST /chat with {"prompt":"guaranteed investment","guardrails":true}.
GET /health, /audit, /audit/verify. Only the client profile exists at this stage.
Export environment variables before starting; .env.example is a template and is not automatically loaded.
The default mock requires no key. Live providers require MODEL_PROVIDER=openai or anthropic,
MODEL_API_KEY and MODEL_NAME. OpenAI-compatible servers can override MODEL_BASE_URL.
Live providers have not been tested with credentials.

Actual NeMo input/output flows execute sensitive-data and misleading-language actions.
The initial sensitive-data action supports Luhn-valid cards, emails and UK sort codes.
Additional identifiers and checks are Stage 3 work. Mock responses deliberately contain risks.
An offline lexical index replaces NeMo's default embedding download; it does not provide semantic understanding.
The passthrough callback is verified against installed 0.12.0 internals and must be retested on upgrades.

Audit fields are always redacted using the supported patterns. Original input means its
redacted representation. No raw secret retention switch is enabled at this stage.
The response also redacts supported PII in OFF mode. This is an audit/privacy safeguard.
The chain detects edited records but cannot detect a fully rewritten chain or tail truncation
without an external trusted checkpoint. This is not a certified immutable store.
The role selector is demo metadata, not authentication. Do not expose this API publicly.
Mappings are illustrative, not legal advice. Humans remain accountable.

Dependencies: NVIDIA NeMo Guardrails (Apache-2.0), FastAPI (MIT), HTTPX (BSD-3-Clause),
Uvicorn (BSD-3-Clause), pytest (MIT), Pydantic (MIT); transitive packages are captured in requirements.lock.

```

## backend/actions/checks.py

```
import re


def luhn(value: str) -> bool:
    digits = [int(c) for c in value if c.isdigit()]
    return 13 <= len(digits) <= 19 and sum(
        d if i % 2 == 0 else (2*d-9 if d > 4 else 2*d)
        for i, d in enumerate(reversed(digits))
    ) % 10 == 0


def redact(text: str) -> tuple[str, list[str]]:
    kinds = []
    def card(match):
        if luhn(match.group()):
            kinds.append('card')
            return '[REDACTED_CARD]'
        return match.group()
    text = re.sub(r'(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)', card, text)
    for kind, pattern in [('email', r'\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b'),
                          ('sort_code', r'\b\d{2}-\d{2}-\d{2}\b')]:
        def replace(match):
            kinds.append(kind)
            return f'[REDACTED_{kind.upper()}]'
        text = re.sub(pattern, replace, text)
    return text, kinds


def result(rule: str, stage: str, status: str, explanation: str, evidence: list) -> dict:
    return dict(rule_id=rule, name={'IN-01':'Sensitive data','OUT-01':'Misleading language'}[rule],
                stage=stage, status=status, severity='high', explanation=explanation,
                regulation_references=['UK GDPR data minimisation' if stage == 'input' else 'FCA COBS fair, clear and not misleading'], evidence=evidence)


async def sensitive_data(context: dict) -> dict:
    cleaned, kinds = redact(context.get('user_message', ''))
    context['user_message'] = cleaned
    context['trace'].append(result('IN-01', 'input', 'modified' if kinds else 'pass',
                                  'Sensitive data redacted before model access.' if kinds else 'No supported sensitive patterns found.', kinds))
    return {'text': cleaned}


async def misleading(context: dict) -> dict:
    text = context.get('bot_message', '')
    matches = re.findall(r"guaranteed|risk-free|can't lose|certain to", text, re.I)
    cleaned = 'Returns are uncertain and you may lose money. Please review the product risks.' if matches else text
    context['trace'].append(result('OUT-01', 'output', 'modified' if matches else 'pass',
                                  'Replaced promissory wording.' if matches else 'No promissory wording found.', matches))
    return {'text': cleaned}

```

## backend/app/engine.py

```
from pathlib import Path
from nemoguardrails import LLMRails, RailsConfig
from actions.checks import sensitive_data, misleading
from app.model import generate


def make_engine():
    config = RailsConfig.from_path(str(Path(__file__).resolve().parents[1] / 'guardrails/client'))
    engine = LLMRails(config)
    engine.register_action(sensitive_data, name='sensitive_data')
    engine.register_action(misleading, name='misleading')
    async def passthrough(context, events=None):
        raw = await generate(context['user_message'])
        context['capture']['raw'] = raw
        context['capture']['redacted'] = context['user_message']
        return raw
    engine.llm_generation_actions.passthrough_fn = passthrough
    return engine

```

## backend/app/main.py

```
import os
import time
from datetime import datetime, timezone
from typing import Literal
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from actions.checks import redact
from app.engine import make_engine
from app.model import generate
from audit.store import AuditStore

app = FastAPI(title='FinGuard — Stage 2')
app.add_middleware(CORSMiddleware, allow_origins=['http://localhost:5173'], allow_methods=['GET','POST'], allow_headers=['Content-Type'])
store = AuditStore(os.getenv('AUDIT_DB', '/tmp/finguard.sqlite3'))
engine = make_engine()


class ChatRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=20000)
    profile: Literal['client'] = 'client'
    role: Literal['client', 'analyst', 'compliance_officer', 'staff'] = 'client'
    guardrails: bool = True


@app.get('/health')
def health():
    return {'status':'ok', 'nemo':'0.12.0', 'colang':'1.0', 'stage':2}


@app.post('/chat')
async def chat(request: ChatRequest):
    started = time.perf_counter()
    trace, capture = [], {}
    action = 'allow'
    try:
        if request.guardrails:
            response = await engine.generate_async(messages=[
                {'role':'context','content':{'trace':trace,'capture':capture}},
                {'role':'user','content':request.prompt}])
            final = response['content']
            action = 'modify' if any(r['status'] == 'modified' for r in trace) else 'allow'
            if len(trace) != 2:
                raise RuntimeError('Required rails did not complete')
        else:
            final = await generate(request.prompt)
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
                  rule_results=trace, final_action=action, latency_ms={'total':elapsed},
                  policy_pack_version='client-stage2-v1', model_name=os.getenv('MODEL_NAME','mock') if os.getenv('MODEL_PROVIDER','mock') != 'mock' else 'mock')
    audit_id = store.append(record)
    return dict(id=audit_id, **record)


@app.get('/audit')
def audit():
    return store.entries()


@app.get('/audit/verify')
def verify():
    return store.verify()

```

## backend/app/model.py

```
import os
import httpx


async def generate(prompt: str) -> str:
    provider = os.getenv('MODEL_PROVIDER', 'mock')
    if provider == 'mock':
        if any(word in prompt.lower() for word in ['return', 'money', 'invest', 'guarantee']):
            return 'This investment is guaranteed and risk-free. You can\'t lose.'
        return f'Northbridge Financial received your enquiry: {prompt}'
    if provider == 'openai':
        url = os.getenv('MODEL_BASE_URL', 'https://api.openai.com/v1') + '/chat/completions'
        headers = {'Authorization': f"Bearer {os.environ['MODEL_API_KEY']}"}
        body = {'model': os.environ['MODEL_NAME'], 'messages': [{'role':'user', 'content':prompt}]}
    elif provider == 'anthropic':
        url = 'https://api.anthropic.com/v1/messages'
        headers = {'x-api-key':os.environ['MODEL_API_KEY'], 'anthropic-version':'2023-06-01'}
        body = {'model':os.environ['MODEL_NAME'], 'max_tokens':512, 'messages':[{'role':'user','content':prompt}]}
    else:
        raise ValueError('Unsupported model provider')
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(url, headers=headers, json=body)
        response.raise_for_status()
        data = response.json()
    return data['choices'][0]['message']['content'] if provider == 'openai' else ''.join(x['text'] for x in data['content'] if x['type'] == 'text')

```

## backend/audit/store.py

```
import hashlib
import json
import sqlite3


class AuditStore:
    def __init__(self, path: str):
        self.path = path
        with self.connect() as db:
            db.execute('CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY, payload TEXT NOT NULL, previous TEXT NOT NULL, hash TEXT NOT NULL)')

    def connect(self):
        return sqlite3.connect(self.path, timeout=30)

    @staticmethod
    def digest(previous: str, payload: str) -> str:
        return hashlib.sha256((previous + payload).encode()).hexdigest()

    def append(self, record: dict) -> int:
        payload = json.dumps(record, sort_keys=True, separators=(',', ':'))
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            last = db.execute('SELECT hash FROM audit ORDER BY id DESC LIMIT 1').fetchone()
            previous = last[0] if last else '0'*64
            cursor = db.execute('INSERT INTO audit(payload,previous,hash) VALUES(?,?,?)',
                                (payload, previous, self.digest(previous, payload)))
            return cursor.lastrowid

    def entries(self) -> list[dict]:
        with self.connect() as db:
            return [dict(id=i, **json.loads(p), previous_hash=prev, hash=h)
                    for i,p,prev,h in db.execute('SELECT id,payload,previous,hash FROM audit ORDER BY id')]

    def verify(self) -> dict:
        previous = '0'*64
        with self.connect() as db:
            rows = db.execute('SELECT id,payload,previous,hash FROM audit ORDER BY id').fetchall()
        for i,p,prev,h in rows:
            if prev != previous or h != self.digest(prev,p):
                return {'intact':False, 'first_invalid_id':i, 'records':len(rows)}
            previous = h
        return {'intact':True, 'records':len(rows)}

```

## backend/guardrails/client/config.py

```
from nemoguardrails.embeddings.index import EmbeddingsIndex


class LexicalIndex(EmbeddingsIndex):
    """Local token-overlap index; not a semantic embedding model."""
    def __init__(self, **kwargs):
        self.items = []

    async def add_item(self, item):
        self.items.append(item)

    async def add_items(self, items):
        self.items.extend(items)

    async def search(self, text, max_results=5, threshold=None):
        tokens = set(text.lower().split())
        def score(item):
            other = set(item.text.lower().split())
            return len(tokens & other) / max(1, len(tokens | other))
        return [i for i in sorted(self.items, key=score, reverse=True)
                if score(i) >= (threshold or 0)][:max_results]


def init(app):
    app.register_embedding_search_provider('lexical', LexicalIndex)

```

## backend/guardrails/client/config.yml

```
models: []
colang_version: '1.0'
passthrough: true
rails:
  input:
    flows:
      - redact input
  output:
    flows:
      - clean output
core:
  embedding_search_provider:
    name: lexical

```

## backend/guardrails/client/rails.co

```
define flow redact input
  $checked = execute sensitive_data
  $user_message = $checked.text

define flow clean output
  $checked = execute misleading
  $bot_message = $checked.text

```

## backend/requirements.lock

```
aiohappyeyeballs==2.7.1
aiohttp==3.14.5
aiosignal==1.4.0
annotated-doc==0.0.5
annotated-types==0.8.0
annoy==1.17.3
anyio==4.15.1
attrs==26.1.0
certifi==2026.10.23
charset-normalizer==3.5.2
click==8.5.0
coloredlogs==15.0.1
dataclasses-json==0.6.7
distro==1.9.0
fastapi==0.162.0
fastembed==0.4.0
filelock==4.2.4
flatbuffers==25.12.19
frozenlist==1.8.0
fsspec==2026.9.0
h11==0.16.0
hf-xet==1.7.0
httpcore==1.0.9
httpcore2==2.16.0
httpx==0.28.1
httpx-sse==0.4.3
httpx2==2.16.0
huggingface-hub==0.36.2
humanfriendly==10.0
idna==3.20
iniconfig==2.3.1
jinja2==3.1.6
jsonpatch==1.36
jsonpointer==3.4
langchain==0.3.30
langchain-community==0.3.31
langchain-core==0.3.86
langchain-text-splitters==0.3.11
langsmith==0.14.12
lark==1.3.1
loguru==0.7.3
markdown-it-py==4.2.0
markupsafe==3.0.4
marshmallow==3.26.2
mdurl==0.1.2
ml-dtypes==0.5.4
mmh3==4.1.0
mpmath==1.3.0
multidict==7.2.0
mypy-extensions==1.1.0
nemoguardrails==0.12.0
nest-asyncio==1.6.0
numpy==1.26.4
onnx==1.23.2
onnxruntime==1.19.2
opentelemetry-api==1.45.1
orjson==3.13.0
packaging==25.0
pandas==2.3.3
pillow==10.4.0
pluggy==1.7.0
prompt-toolkit==3.0.53
propcache==0.5.4
protobuf==7.36.2
pydantic==2.14.1
pydantic-core==2.50.1
pydantic-settings==2.16.1
pygments==2.21.0
pystemmer==2.2.0.3
pytest==9.1.1
python-dateutil==3.0.0
python-dotenv==1.2.4
pytz==2026.5
pyyaml==6.0.3
requests==2.34.2
requests-toolbelt==1.0.0
rich==15.0.0
shellingham==1.5.4
simpleeval==1.0.8
six==1.17.0
sniffio==1.3.1
snowballstemmer==2.2.0
sqlalchemy==2.1.6
starlette==1.9.0
sympy==1.14.0
tenacity==9.2.1
tokenizers==0.23.3
tqdm==4.70.1
truststore==0.10.5
typer==0.27.3
typing-extensions==4.16.0
typing-inspect==0.9.0
typing-inspection==0.4.4
tzdata==2026.5
urllib3==2.8.0
uuid-utils==0.18.0
uvicorn==0.54.0
watchdog==6.0.0
wcwidth==0.9.3
websockets==17.3
xxhash==4.0.2
yarl==1.25.1
zstandard==0.25.0

```

## backend/requirements.txt

```
nemoguardrails==0.12.0
fastapi
httpx
uvicorn
pytest

```

## backend/tests/test_core.py

```
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
        assert len(on['rule_results']) == 2
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

```
