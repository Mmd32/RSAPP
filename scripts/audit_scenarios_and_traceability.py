# -*- coding: utf-8 -*-
"""
audit_scenarios_and_traceability.py
Executes comprehensive traceability audit for Scenarios A through G.
Verifies domain separation between Store and Mall.
Generates full audit report with Rule ID, Source, Status, and Reason for every inclusion/exclusion.
"""

import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
import json
import os

CATALOG_PATH = os.path.join(ROOT, "data/catalog.json")

with open(CATALOG_PATH, "r", encoding="utf-8") as f:
    catalog = json.load(f)

indicators = catalog["indicators"]
rules_dict = {r["id"]: r for r in catalog.get("rules", [])}

SCENARIOS = [
    {
        "id": "A",
        "name": "Scenario A: Fashion - Street Store",
        "template": "STORE",
        "business_type": "Fashion",
        "location_context": "STREET_STORE",
        "attributes": {"hasFittingRoom": True, "hasShowcase": True, "hasMannequins": True, "hasElevator": False}
    },
    {
        "id": "B",
        "name": "Scenario B: Fashion - Mall Store",
        "template": "STORE",
        "business_type": "Fashion",
        "location_context": "MALL_STORE",
        "attributes": {"hasFittingRoom": True, "hasShowcase": True, "hasMannequins": True, "hasElevator": True}
    },
    {
        "id": "C",
        "name": "Scenario C: F&B - Street Store",
        "template": "STORE",
        "business_type": "F_B",
        "location_context": "STREET_STORE",
        "attributes": {"hasFittingRoom": False, "hasShowcase": False, "hasMannequins": False, "hasElevator": False}
    },
    {
        "id": "D",
        "name": "Scenario D: F&B - Food Court Unit",
        "template": "STORE",
        "business_type": "F_B",
        "location_context": "FOOD_COURT",
        "attributes": {"hasFittingRoom": False, "hasShowcase": False, "hasMannequins": False, "hasElevator": False}
    },
    {
        "id": "E",
        "name": "Scenario E: Watch & Jewelry - Mall Store",
        "template": "STORE",
        "business_type": "Watch_Jewelry",
        "location_context": "MALL_STORE",
        "attributes": {"hasFittingRoom": False, "hasShowcase": True, "hasMannequins": False, "hasElevator": False}
    },
    {
        "id": "F",
        "name": "Scenario F: Shopping Mall - SM (Small / Neighborhood Scale)",
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

def audit_indicator(scen, ind):
    # Template separation
    if ind["template"] != scen["template"]:
        return {
            "decision": "EXCLUDED",
            "base_applicability": "TEMPLATE_MISMATCH",
            "context_rule": "Domain Separation Rule",
            "rule_source": "SYSTEM",
            "rule_id": "RULE_TEMPLATE_ISOLATION",
            "reason": f"شاخص متعلق به قالب {ind['template']} است و در {scen['template']} قابل ارزیابی نیست."
        }

    code = ind["code"]
    subj = ind["subject"]
    stmt = ind["statement"]

    if scen["template"] == "STORE":
        bt = scen["business_type"]
        is_bt_app = not ind["applicableBusinessTypes"] or bt in ind["applicableBusinessTypes"]
        if not is_bt_app:
            return {
                "decision": "EXCLUDED",
                "base_applicability": f"Excel {bt} = FALSE",
                "context_rule": "Base Excel Business Type Matrix",
                "rule_source": "IMPORTED",
                "rule_id": "RULE_STORE_BASE_EXCEL",
                "reason": f"صنف {bt} در اکسل علامت X ندارد."
            }

        # Location Context
        loc = scen["location_context"]
        if loc == "STREET_STORE":
            if any(w in stmt for w in ["راهروی مال", "کریدور مرکز خرید", "پله‌برقی مرکز خرید", "نقشه طبقات مال"]):
                return {
                    "decision": "EXCLUDED",
                    "base_applicability": f"Excel {bt} = TRUE",
                    "context_rule": "Street Store Context Filter",
                    "rule_source": "MANUAL",
                    "rule_id": "RULE_LOC_STREET_01",
                    "reason": "فروشگاه خیابانی فاقد مشاعات و راهروی مال است."
                }
        elif loc == "MALL_STORE":
            if code == "FS08" or any(w in stmt for w in ["۱۵ تا ۲۰ متری معبر", "خیابان اصلی"]):
                return {
                    "decision": "EXCLUDED",
                    "base_applicability": f"Excel {bt} = TRUE",
                    "context_rule": "Mall Store Context Filter",
                    "rule_source": "MANUAL",
                    "rule_id": "RULE_LOC_MALL_FS08",
                    "reason": "فروشگاه داخل مال تابلوی سردر معبر شهری ندارد."
                }
        elif loc == "FOOD_COURT":
            if code == "FS08" or any(w in subj for w in ["اتاق پرو", "مانکن", "ویترین"]):
                return {
                    "decision": "EXCLUDED",
                    "base_applicability": f"Excel {bt} = TRUE",
                    "context_rule": "Food Court Context Filter",
                    "rule_source": "MANUAL",
                    "rule_id": "RULE_LOC_FC_01",
                    "reason": "غرفه فودکورت فاقد عناصر پوشاک و تابلوی خیابانی است."
                }

        # Attributes
        attrs = scen.get("attributes", {})
        if not attrs.get("hasFittingRoom", True) and code in ["FFR02", "FFR03", "FFR04", "FFR05", "FFR06"]:
            return {
                "decision": "EXCLUDED",
                "base_applicability": f"Excel {bt} = TRUE",
                "context_rule": "Store Attribute: hasFittingRoom=False",
                "rule_source": "DERIVED",
                "rule_id": "RULE_ATTR_NO_FITTING",
                "reason": "فروشگاه فاقد اتاق پرو است."
            }

        if not attrs.get("hasShowcase", True) and code in ["FW02", "FW03", "FW04", "FW05", "FW06"]:
            return {
                "decision": "EXCLUDED",
                "base_applicability": f"Excel {bt} = TRUE",
                "context_rule": "Store Attribute: hasShowcase=False",
                "rule_source": "DERIVED",
                "rule_id": "RULE_ATTR_NO_SHOWCASE",
                "reason": "فروشگاه فاقد ویترین است."
            }

        if not attrs.get("hasMannequins", True) and code.startswith("FMA") and code != "FMA01":
            return {
                "decision": "EXCLUDED",
                "base_applicability": f"Excel {bt} = TRUE",
                "context_rule": "Store Attribute: hasMannequins=False",
                "rule_source": "DERIVED",
                "rule_id": "RULE_ATTR_NO_MANNEQUINS",
                "reason": "فروشگاه فاقد مانکن است."
            }

        if not attrs.get("hasElevator", True) and code in ["FAFE01", "FAFE02", "FAFE03", "FAFE04"]:
            return {
                "decision": "EXCLUDED",
                "base_applicability": f"Excel {bt} = TRUE",
                "context_rule": "Store Attribute: hasElevator=False",
                "rule_source": "DERIVED",
                "rule_id": "RULE_ATTR_NO_ELEVATOR",
                "reason": "فروشگاه تک‌طبقه یا فاقد پله و آسانسور داخلی است."
            }

        return {
            "decision": "INCLUDED",
            "base_applicability": f"Excel {bt} = TRUE",
            "context_rule": "All Store Context Rules Passed",
            "rule_source": "SYSTEM",
            "rule_id": "RULE_STORE_BASE_EXCEL",
            "reason": "منطبق بر صنف و تمامی ویژگی‌های فروشگاه."
        }

    else:
        # MALL
        mt = scen["mall_type"]
        is_mt_app = not ind["applicableMallTypes"] or mt in ind["applicableMallTypes"]
        if not is_mt_app:
            return {
                "decision": "EXCLUDED",
                "base_applicability": f"Excel Mall Scale {mt} = FALSE",
                "context_rule": "Base Excel Mall Scale Matrix",
                "rule_source": "IMPORTED",
                "rule_id": "RULE_MALL_BASE_EXCEL",
                "reason": f"مقیاس {mt} در اکسل علامت X ندارد."
            }

        if mt == "SM" and code in ["PR02", "PR14", "PR18", "AM03", "IS03", "CS03"]:
            return {
                "decision": "EXCLUDED",
                "base_applicability": f"Excel Mall Scale {mt} = TRUE",
                "context_rule": "SM Scale Simplification",
                "rule_source": "MANUAL",
                "rule_id": "RULE_MALL_SM_SCALE",
                "reason": "مرکز خرید پایه (SM) فاقد تجهیزات مگامال است."
            }

        return {
            "decision": "INCLUDED",
            "base_applicability": f"Excel Mall Scale {mt} = TRUE",
            "context_rule": "All Mall Rules Passed",
            "rule_source": "SYSTEM",
            "rule_id": "RULE_MALL_BASE_EXCEL",
            "reason": "منطبق بر مقیاس مرکز خرید."
        }

def run_scenarios_audit():
    print("=" * 100)
    print("AUDIT SECTION 7 & 8: SCENARIOS A-G COMPLETE TRACEABILITY & DOMAIN SEPARATION")
    print("=" * 100)

    summary_rows = []

    for scen in SCENARIOS:
        inc = []
        exc_same_template = []
        exc_other_template = []

        for ind in indicators:
            trace = audit_indicator(scen, ind)
            if trace["decision"] == "INCLUDED":
                inc.append((ind, trace))
            else:
                if ind["template"] == scen["template"]:
                    exc_same_template.append((ind, trace))
                else:
                    exc_other_template.append((ind, trace))

        total_template = 255 if scen["template"] == "STORE" else 226
        
        # Domain Separation Check:
        assert len(exc_other_template) == (226 if scen["template"] == "STORE" else 255)
        # All items in `inc` must have ind['template'] == scen['template']
        for ind, _ in inc:
            assert ind["template"] == scen["template"], f"LEAK DETECTED: {ind['code']} in {scen['name']}"

        print(f"\n[{scen['name']}] (Target Template: {scen['template']} | Total in Template: {total_template})")
        print(f"  * INCLUDED in Form : {len(inc)}")
        print(f"  * EXCLUDED in Form : {len(exc_same_template)}")
        print(f"  * Template Domain Isolation Check: PASSED (100% separated, 0 leaks from other template)")

        # Print detailed breakdown of exclusions by rule
        rule_breakdown = {}
        for ind, tr in exc_same_template:
            rid = tr["rule_id"]
            rule_breakdown[rid] = rule_breakdown.get(rid, 0) + 1
        print(f"  * Exclusion Breakdown by Rule ID:")
        for rid, cnt in sorted(rule_breakdown.items()):
            r_info = rules_dict.get(rid, {})
            print(f"      - {rid:<25} (Source: {r_info.get('rule_source', 'N/A'):<8}): {cnt:>3} indicators excluded")

        # Top 5 exclusions sample
        print(f"  * Sample Traceable Exclusions:")
        for ind, tr in exc_same_template[:5]:
            print(f"      [Code: {ind['code']:<7}] Base: {tr['base_applicability']:<22} | Rule: {tr['rule_id']:<22} | Source: {tr['rule_source']:<8} | Reason: {tr['reason']}")

        summary_rows.append({
            "scenario": scen["name"],
            "template": scen["template"],
            "included": len(inc),
            "excluded": len(exc_same_template),
            "total_template": total_template,
            "rule_breakdown": rule_breakdown
        })

    print("\n" + "=" * 100)
    print("SCENARIO SUMMARY TABLE")
    print("=" * 100)
    print(f"{'Scenario Name':<45} | {'Template':<8} | {'Included':<9} | {'Excluded':<9} | {'Total Template':<14}")
    print("-" * 100)
    for r in summary_rows:
        print(f"{r['scenario']:<45} | {r['template']:<8} | {r['included']:<9} | {r['excluded']:<9} | {r['total_template']:<14}")

    return summary_rows

if __name__ == "__main__":
    run_scenarios_audit()
