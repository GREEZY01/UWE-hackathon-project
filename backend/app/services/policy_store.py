import json
import os
import sqlite3
from pathlib import Path
from threading import RLock
from pydantic import BaseModel, Field
from typing import Literal

ROOT = Path(__file__).resolve().parents[2]
LOCK = RLock()
PROFILES = ('client', 'research', 'compliance', 'staff')


class RuleEdit(BaseModel):
    enabled: bool | None = None
    min_matches: int | None = Field(default=None, ge=1, le=20)
    action: Literal['allow','modify','block','escalate','log'] | None = None


class PolicyEdit(BaseModel):
    expected_version: int = Field(ge=1)
    rules: dict[str, RuleEdit]


def database():
    db = sqlite3.connect(os.getenv('POLICY_DB', '/tmp/finguard-policies.sqlite3'), timeout=30)
    db.execute('CREATE TABLE IF NOT EXISTS versions(profile TEXT, version INTEGER, payload TEXT, PRIMARY KEY(profile, version))')
    return db


def load(profile: str) -> dict:
    if profile not in PROFILES:
        raise ValueError('Unknown profile')
    base = json.loads((ROOT/'policies'/f'{profile}.json').read_text())
    with database() as db:
        row = db.execute('SELECT payload FROM versions WHERE profile=? ORDER BY version DESC LIMIT 1', (profile,)).fetchone()
    return json.loads(row[0]) if row else base


def update(profile: str, edit: PolicyEdit) -> dict:
    with LOCK, database() as db:
        db.execute('BEGIN IMMEDIATE')
        pack = json.loads((ROOT/'policies'/f'{profile}.json').read_text())
        row = db.execute('SELECT payload FROM versions WHERE profile=? ORDER BY version DESC LIMIT 1', (profile,)).fetchone()
        if row:
            pack = json.loads(row[0])
        if pack['version'] != edit.expected_version:
            raise ValueError('Policy changed; reload before editing')
        known = {r['id'] for r in pack['rules']}
        if set(edit.rules) - known:
            raise ValueError('Unknown rule ID')
        for rule in pack['rules']:
            change = edit.rules.get(rule['id'])
            if change:
                if change.enabled is not None:
                    rule['enabled'] = change.enabled
                if change.action is not None:
                    rule['action'] = change.action
                if change.min_matches is not None:
                    rule['thresholds']['min_matches'] = change.min_matches
        pack['version'] += 1
        db.execute('INSERT INTO versions VALUES(?,?,?)', (profile, pack['version'], json.dumps(pack)))
        return pack
