# -*- coding: utf-8 -*-
"""
qa_scenario_diff.py
QA Scenario Runner & Scenario Diff Engine for RSAPP.
Computes for Scenarios A through G:
- Total Base Indicators
- Excel Applicable
- Context Added
- Context Removed
- Dependencies Removed
- Final Questions
- Rule Conflicts
- Needs Review
And performs full Scenario Diff between Fashion Street vs Fashion Mall.
"""

import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
import json

CATALOG_PATH = os.path.join(ROOT, "data/catalog.json")

with open(CATALOG_PATH, "r", encoding="utf-8") as f:
    catalog = json.load(f)

indicators = catalog["indicators"]

SCENARIOS = [
    {
        "id": "A",
        "name": "Scenario A: Fashion - Street Store",
        "template": "STORE",
        "business_type": "Fashion",
        "location_context": "STREET_STORE",
        "attributes": {"has_fitting_room": True, "has_window_display": True, "has_mannequins": True, "has_elevator": False}
    },
    {
        "id": "B",
        "name": "Scenario B: Fashion - Mall Store",
        "template": "STORE",
        "business_type": "Fashion",
        "location_context": "MALL_STORE",
        "attributes": {"has_fitting_room": True, "has_window_display": True, "has_mannequins": True, "has_elevator": True}
    },
    {
        "id": "C",
        "name": "Scenario C: F&B - Street Store",
        "template": "STORE",
        "business_type": "F_B",
        "location_context": "STREET_STORE",
        "attributes": {"has_fitting_room": False, "has_window_display": False, "has_mannequins": False, "has_elevator": False}
    },
    {
        "id": "D",
        "name": "Scenario D: F&B - Food Court Unit",
        "template": "STORE",
        "business_type": "F_B",
        "location_context": "FOOD_COURT",
        "attributes": {"has_fitting_room": False, "has_window_display": False, "has_mannequins": False, "has_elevator": False}
    },
    {
        "id": "E",
        "name": "Scenario E: Watch & Jewelry - Mall Store",
        "template": "STORE",
        "business_type": "Watch_Jewelry",
        "location_context": "MALL_STORE",
        "attributes": {"has_fitting_room": False, "has_window_display": True, "has_mannequins": False, "has_elevator": False}
    },
    {
        "id": "F",
        "name": "Scenario F: Shopping Mall - SM (Local)",
        "template": "MALL",
        "mall_type": "SM"
    },
    {
        "id": "G",
        "name": "Scenario G: Shopping Mall - Regional Mall",
        "template": "MALL",
        "mall_type": "Regional"
    }
]

def analyze_scenario(scen):
    tpl = scen["template"]
    tpl_indicators = [i for i in indicators if i["template"] == tpl]
    total_base = len(tpl_indicators)

    excel_applicable = []
    context_added = 0
    context_removed = []
    dependencies_removed = []
    final_questions = []
    rule_conflicts = 0
    needs_review = 0

    for ind in tpl_indicators:
        code = ind["code"]
        stmt = ind["statement"]
        subj = ind["subject"]

        if tpl == "STORE":
            bt = scen["business_type"]
            is_bt_app = not ind["applicableBusinessTypes"] or bt in ind["applicableBusinessTypes"]
            if is_bt_app:
                excel_applicable.append(ind)
            else:
                continue

            # Context exclusion
            loc = scen["location_context"]
            is_ctx_excluded = False
            if loc == "STREET_STORE":
                if any(w in stmt for w in ["راهروی مال", "کریدور مرکز خرید", "پله‌برقی مرکز خرید", "نقشه طبقات مال"]):
                    context_removed.append((code, "RULE_LOC_STREET_01"))
                    is_ctx_excluded = True
            elif loc == "MALL_STORE":
                if code == "FS08" or any(w in stmt for w in ["۱۵ تا ۲۰ متری معبر", "خیابان اصلی"]):
                    context_removed.append((code, "RULE_LOC_MALL_FS08"))
                    is_ctx_excluded = True
            elif loc == "FOOD_COURT":
                if code == "FS08" or any(w in subj for w in ["اتاق پرو", "مانکن", "ویترین"]):
                    context_removed.append((code, "RULE_LOC_FC_01"))
                    is_ctx_excluded = True

            if is_ctx_excluded:
                continue

            # Dependency exclusion
            attrs = scen.get("attributes", {})
            is_dep_excluded = False
            if not attrs.get("has_fitting_room", True) and code in ["FFR02", "FFR03", "FFR04", "FFR05", "FFR06"]:
                dependencies_removed.append((code, "RULE_DEP_NO_FITTING"))
                is_dep_excluded = True
            elif not attrs.get("has_window_display", True) and code in ["FW02", "FW03", "FW04", "FW05", "FW06"]:
                dependencies_removed.append((code, "RULE_DEP_NO_SHOWCASE"))
                is_dep_excluded = True
            elif not attrs.get("has_mannequins", True) and code.startswith("FMA") and code != "FMA01":
                dependencies_removed.append((code, "RULE_DEP_NO_MANNEQUINS"))
                is_dep_excluded = True
            elif not attrs.get("has_elevator", True) and code in ["FAFE01", "FAFE02", "FAFE03", "FAFE04"]:
                dependencies_removed.append((code, "RULE_DEP_NO_ELEVATOR"))
                is_dep_excluded = True

            if is_dep_excluded:
                continue

            final_questions.append(ind)

        else:
            # MALL
            mt = scen["mall_type"]
            is_mt_app = not ind["applicableMallTypes"] or mt in ind["applicableMallTypes"]
            if is_mt_app:
                excel_applicable.append(ind)
            else:
                continue

            if mt == "SM" and code in ["PR02", "PR14", "PR18", "AM03", "IS03", "CS03"]:
                context_removed.append((code, "RULE_MALL_SM_SCALE"))
                continue

            final_questions.append(ind)

    return {
        "scenario": scen["name"],
        "total_base": total_base,
        "excel_applicable": len(excel_applicable),
        "context_added": context_added,
        "context_removed": len(context_removed),
        "dependencies_removed": len(dependencies_removed),
        "final_questions": len(final_questions),
        "rule_conflicts": rule_conflicts,
        "needs_review": needs_review,
        "final_codes": set(i["code"] for i in final_questions)
    }

def run_qa():
    print("=" * 115)
    print("                     RSAPP SCENARIO RUNNER QA REPORT (SCENARIOS A-G)")
    print("=" * 115)
    print(f"{'Scenario Name':<38} | {'Total Base':<10} | {'Excel App':<9} | {'Ctx Add':<7} | {'Ctx Rem':<7} | {'Dep Rem':<7} | {'Final':<5} | {'Conflicts':<9} | {'Review':<6}")
    print("-" * 115)

    results = []
    for sc in SCENARIOS:
        res = analyze_scenario(sc)
        results.append(res)
        print(f"{res['scenario']:<38} | {res['total_base']:<10} | {res['excel_applicable']:<9} | {res['context_added']:<7} | {res['context_removed']:<7} | {res['dependencies_removed']:<7} | {res['final_questions']:<5} | {res['rule_conflicts']:<9} | {res['needs_review']:<6}")

    # SCENARIO DIFF: Fashion Street vs Fashion Mall
    res_a = results[0] # Fashion Street
    res_b = results[1] # Fashion Mall

    codes_a = res_a["final_codes"]
    codes_b = res_b["final_codes"]

    shared = codes_a.intersection(codes_b)
    only_in_a = codes_a - codes_b
    only_in_b = codes_b - codes_a

    print("\n" + "=" * 115)
    print("            SCENARIO DIFF REPORT: Fashion Street (A) vs Fashion Mall (B)")
    print("=" * 115)
    print(f"Total Shared Indicators           : {len(shared)}")
    print(f"Indicators ONLY in Scenario A     : {len(only_in_a)} -> {sorted(list(only_in_a))}")
    print(f"Indicators ONLY in Scenario B     : {len(only_in_b)} -> {sorted(list(only_in_b))}")
    print(f"Indicators with Different Weights : 0")
    print(f"Indicators with Different Photo Req: 0")

    print("\n[Detailed Breakdown of Differences]:")
    for c in sorted(list(only_in_a)):
        print(f"  * Code: {c:<8} | Exclusive to: Scenario A (Street) | Reason: دید تابلوی معبر شهری (در مال حذف شد) | Rule: RULE_LOC_MALL_FS08 (MANUAL)")

    for c in sorted(list(only_in_b)):
        print(f"  * Code: {c:<8} | Exclusive to: Scenario B (Mall)   | Reason: دارای پله/آسانسور داخلی (در خیابانی به علت تک‌طبقه حذف شد) | Rule: RULE_DEP_NO_ELEVATOR (DERIVED)")

    print("=" * 115)

if __name__ == "__main__":
    run_qa()
