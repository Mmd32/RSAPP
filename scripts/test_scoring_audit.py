#!/usr/bin/env python3
"""
Automated Audit & Verification Test Suite for PROMPT 3:
Scoring, Analytics, Radar Chart & Professional Report Engine.
"""

import sys
import os
import json
import urllib.request
import urllib.error

def print_header(title):
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80)

def test_scoring_audit():
    print_header("PROMPT 3: SCORING ENGINE, RADAR & REPORT AUDIT SUITE")
    
    # Check catalog and sample data
    with open('src/data/catalog.json') as f:
        catalog = json.load(f)
    indicators = catalog.get('indicators', [])
    print(f"• Loaded catalog: {len(indicators)} indicators")

    # 1. Test Sample Real Visit Dataset Verification (Requirement 21)
    print("\n[Audit 1: Sample Real Visit Dataset Verification (Requirement 21)]")
    with open('data/visits.json') as f:
        visits_data = json.load(f)
    
    sample_visit = visits_data.get('visit_sample_enterprise_01')
    assert sample_visit is not None, "Sample visit 'visit_sample_enterprise_01' must exist in data/visits.json"
    
    sample_indicators = sample_visit.get('indicators', [])
    sample_responses = sample_visit.get('responses', {})
    
    applicable_count = len(sample_indicators)
    print(f"  ✓ Applicable indicators count: {applicable_count} (Requirement: >= 50)")
    assert applicable_count >= 50, f"Applicable count {applicable_count} is less than 50"
    
    friction_count = 0
    critical_count = 0
    high_count = 0
    photo_count = 0
    na_count = 0
    clean_count = 0
    
    for ind_id, resp in sample_responses.items():
        state = resp.get('answerState')
        photos = resp.get('photos', [])
        photo_count += len(photos)
        
        if state == 'FRICTION':
            friction_count += 1
            sev = resp.get('severity')
            if sev == 'CRITICAL':
                critical_count += 1
            elif sev == 'HIGH':
                high_count += 1
        elif state == 'NOT_APPLICABLE':
            na_count += 1
        elif state == 'NO_FRICTION':
            clean_count += 1
            
    print(f"  ✓ Total Frictions count: {friction_count} (Requirement: >= 15)")
    assert friction_count >= 15, f"Friction count {friction_count} is less than 15"
    
    print(f"  ✓ Critical Frictions count: {critical_count} (Requirement: >= 3)")
    assert critical_count >= 3, f"Critical count {critical_count} is less than 3"
    
    print(f"  ✓ Evidence Photos count: {photo_count} (Requirement: >= 10)")
    assert photo_count >= 10, f"Photo count {photo_count} is less than 10"
    
    print(f"  ✓ Clean count: {clean_count}, N/A count: {na_count}")
    assert na_count > 0, "Must contain N/A indicators to test denominator exclusion"

    # 2. Test Backend API Scoring Endpoints (Requirements 1, 22)
    print("\n[Audit 2: Backend API Scoring Endpoints & Parity (Requirement 22)]")
    api_base = "http://localhost:3001"
    
    # Test /api/scoring/profiles
    try:
        req = urllib.request.Request(f"{api_base}/api/scoring/profiles")
        with urllib.request.urlopen(req, timeout=5) as res:
            profiles = json.loads(res.read().decode('utf-8'))
            print(f"  ✓ GET /api/scoring/profiles returned {len(profiles)} configurable profiles:")
            for p in profiles:
                print(f"    - {p['id']}: {p['name']} (Formula: {p['overallFormula']}, Rounding: {p['roundingMethod']})")
            assert len(profiles) >= 3, "Expected at least 3 scoring profiles registered"
    except Exception as e:
        print(f"  ✗ Failed to fetch profiles from API: {e}")
        sys.exit(1)

    # Test /api/scoring/calculate
    try:
        calc_payload = json.dumps({
            "indicators": sample_indicators,
            "responses": sample_responses,
            "assessmentType": "STORE",
            "profileId": "profile_rs_consulting_v1"
        }).encode('utf-8')
        
        req = urllib.request.Request(
            f"{api_base}/api/scoring/calculate",
            data=calc_payload,
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=5) as res:
            calc_summary = json.loads(res.read().decode('utf-8'))
            api_overall_score = calc_summary.get('overallScore')
            print(f"  ✓ POST /api/scoring/calculate calculated Overall Score: {api_overall_score}")
    except Exception as e:
        print(f"  ✗ Failed to execute /api/scoring/calculate: {e}")
        sys.exit(1)

    # Test GET /api/visits/visit_sample_enterprise_01
    try:
        req = urllib.request.Request(f"{api_base}/api/visits/visit_sample_enterprise_01")
        with urllib.request.urlopen(req, timeout=5) as res:
            visit_api = json.loads(res.read().decode('utf-8'))
            persisted_overall_score = visit_api.get('overallScore')
            print(f"  ✓ GET /api/visits/visit_sample_enterprise_01 returned score: {persisted_overall_score}")
    except Exception as e:
        print(f"  ✗ Failed to fetch visit from API: {e}")
        sys.exit(1)

    # Cross-validation equality assertion (Requirement 22)
    print("\n[Audit 3: Mathematical Cross-Validation Parity (Requirement 22)]")
    print(f"  * Persisted Visit Score  : {persisted_overall_score}")
    print(f"  * Calculated API Score   : {api_overall_score}")
    assert persisted_overall_score == api_overall_score, (
        f"Score mismatch: persisted ({persisted_overall_score}) != api ({api_overall_score})"
    )
    print("  ✓ EXACT MATHEMATICAL PARITY VERIFIED across API, Visit, and Scoring Engine!")

    # 3. Test Applicable Denominator Rule (Requirement 3)
    print("\n[Audit 4: Strict N/A Denominator Exclusion (Requirement 3)]")
    dim_details = calc_summary.get('dimensionDetails', [])
    assert len(dim_details) == 8, f"Expected 8 dimensions, got {len(dim_details)}"
    
    for d in dim_details:
        app_count = d['applicableCount']
        f_count = d['frictionCount']
        c_count = d['cleanCount']
        na = d['naCount']
        tot_weight = d['totalWeight']
        max_penalty = d['maxPossiblePenaltiesSum']
        sev_penalty = d['severityPenaltiesSum']
        raw_score = d['rawScore']
        norm_score = d['normalizedScore']
        
        # In our engine, applicableCount is cleanCount + frictionCount, N/A is EXCLUDED
        assert app_count == f_count + c_count, (
            f"Denominator error in {d['dimensionKey']}: applicableCount ({app_count}) != clean ({c_count}) + friction ({f_count})"
        )
        if app_count > 0:
            expected_raw = round(100.0 * (1.0 - (sev_penalty / max_penalty)), 2)
            assert abs(raw_score - expected_raw) < 0.05, (
                f"Formula error in {d['dimensionKey']}: rawScore ({raw_score}) != expected ({expected_raw})"
            )
        print(f"  ✓ Dimension {d['dimensionKey']:12} -> Answered: {app_count:2}, N/A: {na}, Frictions: {f_count}, Clean: {c_count:2} => Score: {norm_score}%")

    # 4. Test Explainable Priority Index (Requirement 11)
    print("\n[Audit 5: Explainable Priority Index Formula & Sorting (Requirement 11)]")
    prioritized = calc_summary.get('prioritizedFindings', [])
    assert len(prioritized) == friction_count, f"Expected {friction_count} prioritized findings, got {len(prioritized)}"
    
    # Check sorting descending
    for i in range(len(prioritized) - 1):
        p1 = prioritized[i]['priorityIndex']
        p2 = prioritized[i+1]['priorityIndex']
        assert p1 >= p2, f"Prioritized findings not sorted descending: index {i} ({p1}) < index {i+1} ({p2})"
        
    top3 = prioritized[:3]
    print(f"  Top 3 Critical Prioritized Findings:")
    for idx, item in enumerate(top3, 1):
        print(f"    {idx}. [{item['indicator']['code']}] {item['indicator']['subject']}")
        print(f"       Priority Index: {item['priorityIndex']} | Formula: {item['priorityFormula']}")
        assert "شدت" in item['priorityFormula'], "Formula explanation must be transparently documented"

    # 5. Test Radar Series Multi-Series Structure (Requirements 7, 8)
    print("\n[Audit 6: Multi-Series Radar Integrity (Requirements 7, 8)]")
    radar_series = calc_summary.get('radarSeries', [])
    print(f"  ✓ Radar series count: {len(radar_series)}")
    series_ids = [s['id'] for s in radar_series]
    print(f"  ✓ Available series IDs: {series_ids}")
    assert 'current_visit' in series_ids, "Radar must contain 'current_visit' series"
    assert 'previous_visit' in series_ids, "Radar must contain 'previous_visit' series"
    assert 'brand_average' in series_ids, "Radar must contain 'brand_average' series"
    
    for s in radar_series:
        for dim_key, score in s['scores'].items():
            assert 0 <= score <= 100, f"Radar score out of range (0-100): {dim_key} = {score}"

    # 6. Test Strengths & Positive Results (Requirement 13)
    print("\n[Audit 7: Strengths & Positive Performance Areas (Requirement 13)]")
    strengths = calc_summary.get('strengths', [])
    print(f"  ✓ Identified {len(strengths)} high-performing dimensions (Score >= 80%):")
    for s in strengths:
        print(f"    - {s['nameFa']} ({s['dimensionKey']}): {s['score']}% ({s['cleanCount']} clean indicators)")
        assert s['score'] >= 80, "Strengths must only include dimensions with score >= 80%"
        assert s['cleanCount'] > 0, "Strengths must be based on actual verified clean indicators"

    print("\n" + "=" * 80)
    print("  ALL AUDIT CHECKS PASSED SUCCESSFULLY (100% COMPLIANCE WITH PROMPT 3)")
    print("=" * 80 + "\n")

if __name__ == '__main__':
    test_scoring_audit()
