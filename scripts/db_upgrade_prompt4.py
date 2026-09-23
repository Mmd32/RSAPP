#!/usr/bin/env python3
"""
RSAPP Prompt 4: Database Upgrade and Seed for SQLite
Adds:
- organizations
- corrective_actions
- action_audit_logs
- action_evidence_photos
"""

import sqlite3
import os
import json
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'rsapp.db')

def upgrade_db():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    print("[1/4] Creating organizations table...")
    cur.execute('''
        CREATE TABLE IF NOT EXISTS organizations (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            code TEXT UNIQUE NOT NULL,
            brands TEXT NOT NULL, -- JSON array
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL
        )
    ''')

    print("[2/4] Creating corrective_actions table...")
    cur.execute('''
        CREATE TABLE IF NOT EXISTS corrective_actions (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            finding_id TEXT NOT NULL,
            indicator_code TEXT NOT NULL,
            visit_id TEXT NOT NULL,
            branch_id TEXT NOT NULL,
            branch_name TEXT NOT NULL,
            brand_name TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            priority TEXT NOT NULL,
            status TEXT NOT NULL,
            owner TEXT,
            department TEXT NOT NULL,
            due_date TEXT NOT NULL,
            root_cause TEXT,
            resolution_note TEXT,
            completion_date TEXT,
            verified_by TEXT,
            verified_at TEXT,
            verification_note TEXT,
            reopen_count INTEGER NOT NULL DEFAULT 0,
            created_by TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    ''')

    print("[3/4] Creating action_audit_logs table...")
    cur.execute('''
        CREATE TABLE IF NOT EXISTS action_audit_logs (
            id TEXT PRIMARY KEY,
            action_id TEXT NOT NULL,
            who TEXT NOT NULL,
            user_role TEXT NOT NULL,
            what TEXT NOT NULL,
            from_status TEXT NOT NULL,
            to_status TEXT NOT NULL,
            details TEXT,
            created_at TEXT NOT NULL
        )
    ''')

    print("[4/4] Creating action_evidence_photos table...")
    cur.execute('''
        CREATE TABLE IF NOT EXISTS action_evidence_photos (
            id TEXT PRIMARY KEY,
            action_id TEXT NOT NULL,
            photo_type TEXT NOT NULL,
            url TEXT NOT NULL,
            caption TEXT,
            storage_key TEXT,
            created_at TEXT NOT NULL
        )
    ''')

    # Seed Default Organization
    now = datetime.now().isoformat()
    cur.execute('''
        INSERT OR IGNORE INTO organizations (id, name, code, brands, is_active, created_at)
        VALUES (?, ?, ?, ?, 1, ?)
    ''', ('org_retail_holding', 'هلدینگ ریتیل سلوشنز', 'RS_HOLDING', json.dumps(['ZARA', 'LC Waikiki', 'کوروش مال']), now))

    conn.commit()
    conn.close()
    print("Database upgrade for Prompt 4 completed successfully.")

if __name__ == '__main__':
    upgrade_db()
