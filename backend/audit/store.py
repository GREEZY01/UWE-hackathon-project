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
