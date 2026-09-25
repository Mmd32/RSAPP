# -*- coding: utf-8 -*-
"""
validator.py
Data & Rules Validation Engine for RSAPP.
Inspects database records, catalog, and rules for:
- ERROR: duplicate active codes, missing code, invalid foreign keys, invalid applicability, broken rule syntax
- WARNING: missing subject, unmapped reporting dimensions, needs_review flags, unexpected values
- INFO: summary counts and operational metrics
"""

import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
import sqlite3
import json
import os

DB_PATH = os.path.join(ROOT, "data/rsapp.db")
CATALOG_PATH = os.path.join(ROOT, "data/catalog.json")

def run_validation():
    print("=" * 80)
    print("RSAPP DATA & RULES VALIDATION ENGINE")
    print("=" * 80)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    errors = []
    warnings = []
    infos = []

    # 1. VALIDATE INDICATORS
    cursor.execute("SELECT id, code, assessment_type, group_id, subject_id, journey_stage_id, reporting_dimension_id, status FROM indicators")
    indicators = cursor.fetchall()
    infos.append(f"Total Indicators in Database: {len(indicators)}")

    seen_active_codes = {}
    for ind in indicators:
        ind_id, code, tpl, gid, sid, jsid, rdid, status = ind
        if not code or not code.strip():
            errors.append(f"ERROR: Indicator {ind_id} has empty code!")
        
        if status == 'ACTIVE':
            code_key = (tpl, code.strip())
            if code_key in seen_active_codes:
                errors.append(f"ERROR: Duplicate active code '{code}' in template '{tpl}' (IDs: {seen_active_codes[code_key]}, {ind_id})")
            else:
                seen_active_codes[code_key] = ind_id

        # FK checks
        cursor.execute("SELECT id FROM indicator_groups WHERE id = ?", (gid,))
        if not cursor.fetchone():
            errors.append(f"ERROR: Indicator {code} references non-existent group_id: {gid}")

        cursor.execute("SELECT id FROM subjects WHERE id = ?", (sid,))
        if not cursor.fetchone():
            errors.append(f"ERROR: Indicator {code} references non-existent subject_id: {sid}")

        cursor.execute("SELECT id FROM journey_stages WHERE id = ?", (jsid,))
        if not cursor.fetchone():
            errors.append(f"ERROR: Indicator {code} references non-existent journey_stage_id: {jsid}")

        cursor.execute("SELECT id FROM reporting_dimensions WHERE id = ?", (rdid,))
        if not cursor.fetchone():
            warnings.append(f"WARNING: Indicator {code} has unmapped reporting_dimension_id: {rdid}")

    # 2. VALIDATE APPLICABILITY
    cursor.execute("SELECT count(*) FROM indicator_applicabilities")
    app_cnt = cursor.fetchone()[0]
    infos.append(f"Total Indicator Applicability Mappings: {app_cnt}")

    cursor.execute("""
    SELECT a.id, a.indicator_id, a.business_type_code, a.mall_type_code
    FROM indicator_applicabilities a
    LEFT JOIN indicators i ON a.indicator_id = i.id
    WHERE i.id IS NULL
    """)
    orphan_apps = cursor.fetchall()
    if orphan_apps:
        errors.append(f"ERROR: Found {len(orphan_apps)} orphan applicability records with invalid indicator_id!")

    # 3. VALIDATE RULES MODEL
    cursor.execute("SELECT id, name, rule_type, rule_source, status, priority, conditions, effect FROM rules")
    rules = cursor.fetchall()
    infos.append(f"Total Rules Configured: {len(rules)}")

    valid_types = {'APPLICABILITY', 'EXCLUSION', 'DEPENDENCY', 'REQUIREMENT', 'SCORING'}
    valid_sources = {'IMPORTED', 'MANUAL', 'DERIVED', 'SYSTEM'}
    valid_statuses = {'DRAFT', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED'}
    valid_effects = {'INCLUDE', 'EXCLUDE', 'MAKE_REQUIRED', 'MAKE_OPTIONAL', 'AUTO_NA', 'SHOW_DEPENDENT', 'HIDE_DEPENDENT'}

    for r in rules:
        r_id, r_name, r_type, r_source, r_status, r_prio, r_conds, r_eff = r
        if r_type not in valid_types:
            errors.append(f"ERROR: Rule {r_id} has invalid rule_type: {r_type}")
        if r_source not in valid_sources:
            errors.append(f"ERROR: Rule {r_id} has invalid rule_source: {r_source}")
        if r_status not in valid_statuses:
            errors.append(f"ERROR: Rule {r_id} has invalid status: {r_status}")
        if r_eff not in valid_effects:
            errors.append(f"ERROR: Rule {r_id} has invalid effect: {r_eff}")
        try:
            json.loads(r_conds)
        except Exception as e:
            errors.append(f"ERROR: Rule {r_id} has corrupted JSON conditions: {e}")

    # 4. PRINT REPORT
    print("\n[VALIDATION SUMMARY]")
    print(f"  * Total ERRORS   : {len(errors)}")
    print(f"  * Total WARNINGS : {len(warnings)}")
    print(f"  * Total INFOS    : {len(infos)}")

    if errors:
        print("\n[CRITICAL ERRORS FOUND]:")
        for e in errors:
            print(f"  - {e}")

    if warnings:
        print("\n[WARNINGS]:")
        for w in warnings:
            print(f"  - {w}")

    print("\n[OPERATIONAL INFOS]:")
    for i in infos:
        print(f"  - {i}")

    is_valid = len(errors) == 0
    print("\n" + "=" * 80)
    print(f"VALIDATION STATUS: {'PASSED (Zero Errors)' if is_valid else 'FAILED'}")
    print("=" * 80)

    conn.close()
    return {"errors": errors, "warnings": warnings, "infos": infos, "is_valid": is_valid}

if __name__ == "__main__":
    run_validation()
