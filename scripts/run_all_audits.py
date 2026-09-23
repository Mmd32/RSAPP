# -*- coding: utf-8 -*-
"""
run_all_audits.py
Master Test and Audit Runner for RSAPP Dynamic Assessment Engine.
Executes all 5 verification suites in sequence:
1. Excel Data & Row Counts Audit
2. Scenarios A-G Traceability & Domain Separation Audit
3. Snapshot Immutability Audit
4. Scoring Mathematical Formulas Audit
5. Reporting Dimensions & Journey Stage Audit
"""

import subprocess
import sys
import time

PYTHON_BIN = "/Users/mohammadreza/env/bin/python3"

SCRIPTS = [
    ("1. Excel Data Ingestion & Applicability Matrix", "scripts/audit_data_and_engine.py"),
    ("2. Scenarios A-G Traceability & Domain Separation", "scripts/audit_scenarios_and_traceability.py"),
    ("3. Snapshot Integrity & Immutability Test", "scripts/test_snapshot_integrity.py"),
    ("4. Scoring Engine Formulas & Unit Tests", "scripts/test_scoring_audit.py"),
    ("5. Reporting Dimensions & Customer Journey Mapping", "scripts/audit_reporting_dimensions.py"),
]

def main():
    print("=" * 80)
    print("   RSAPP DYNAMIC ASSESSMENT ENGINE - MASTER AUDIT SUITE EXECUTION")
    print("=" * 80)

    start_time = time.time()
    results = []

    for idx, (title, script) in enumerate(SCRIPTS, start=1):
        print(f"\n>>> RUNNING TEST SUITE {idx}/5: {title} ({script}) ...")
        t0 = time.time()
        res = subprocess.run([PYTHON_BIN, script], capture_output=True, text=True)
        dur = time.time() - t0

        if res.returncode == 0:
            print(f"    [PASSED] in {dur:.2f}s")
            results.append((title, "PASSED", dur, res.stdout))
        else:
            print(f"    [FAILED] in {dur:.2f}s with return code {res.returncode}")
            print("STDERR:")
            print(res.stderr)
            results.append((title, "FAILED", dur, res.stderr))

    total_dur = time.time() - start_time
    all_passed = all(r[1] == "PASSED" for r in results)

    print("\n" + "=" * 80)
    print("                     MASTER AUDIT SUMMARY REPORT")
    print("=" * 80)
    for title, status, dur, _ in results:
        badge = "[✓ PASSED]" if status == "PASSED" else "[✗ FAILED]"
        print(f"  {badge:<12} {title:<55} ({dur:.2f}s)")

    print("-" * 80)
    print(f"Total Execution Time: {total_dur:.2f}s")
    print(f"Final Outcome       : {'ALL SUITES PASSED (100% VERIFIED)' if all_passed else 'SOME SUITES FAILED'}")
    print("=" * 80)

    sys.exit(0 if all_passed else 1)

if __name__ == "__main__":
    main()
