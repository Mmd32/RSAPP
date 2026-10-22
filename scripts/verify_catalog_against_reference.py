# -*- coding: utf-8 -*-
"""
Checks that the indicator catalog is exactly the reference workbooks in data/reference/:

  store  FR Checklist- Fashion-Nima.xlsx  (read with the same code the importer uses:
         scripts/import_store_checklist.py) - every KPI, in order, with code, zone, topic,
         statement and the sectors it applies to, and nothing else active.
  mall   FR_Report_Mall V2Final Version.xlsx - every row with code, zone, topic, statement
         and the mall types it applies to.

It also requires data/catalog.json and src/data/catalog.json to be identical.
Run: python3 scripts/verify_catalog_against_reference.py   (exit 1 on any difference)
"""
import importlib.util
import json
import os
import sys

import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CATALOG = os.path.join(ROOT, "data/catalog.json")
SRC_CATALOG = os.path.join(ROOT, "src/data/catalog.json")
MALL_XLSX = os.path.join(ROOT, "data/reference/FR_Report_Mall V2Final Version.xlsx")
MALL_TYPES = {"SM": "SM", "Neighborhood Shopping Center": "Neighborhood", "Community Mall": "Community",
              "Regional Mall": "Regional", "Super Regional Mall": "Super_Regional"}

spec = importlib.util.spec_from_file_location("import_store_checklist", os.path.join(ROOT, "scripts/import_store_checklist.py"))
importer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(importer)


def norm(value):
    return " ".join(str(value or "").replace("‌", " ").split())


def check_store(catalog):
    problems = []
    expected, _ = importer.parse_workbook()
    actual = sorted((i for i in catalog["indicators"] if i["template"] == "STORE" and i.get("status") != "ARCHIVED"),
                    key=lambda i: i["displayOrder"])
    if len(actual) != len(expected):
        problems.append(f"STORE: {len(actual)} active indicators in the catalog, {len(expected)} in the workbook")
    for want, got in zip(expected, actual):
        tag = f"STORE #{want['order']} {want['code']}"
        for field, have in (("code", got["code"]), ("group", got["group"]), ("subject", got["subject"]),
                            ("statement", got["statement"])):
            if norm(have) != norm(want[field]):
                problems.append(f"{tag}: {field} differs ({have!r} vs {want[field]!r})")
        if norm(got.get("auditorNote", "")) != norm(want["note"]):
            problems.append(f"{tag}: auditor note differs ({got.get('auditorNote', '')!r} vs {want['note']!r})")
        if sorted(got["applicableBusinessTypes"]) != sorted(want["sectors"]):
            problems.append(f"{tag}: sectors differ ({sorted(got['applicableBusinessTypes'])} vs {sorted(want['sectors'])})")
    return problems, len(expected)


def check_mall(catalog):
    problems = []
    ws = openpyxl.load_workbook(MALL_XLSX, data_only=True).worksheets[0]
    header = [c.value for c in ws[1]]
    rows = [dict(zip(header, [c.value for c in r])) for r in ws.iter_rows(min_row=2) if r[1].value]
    indexed = {i["code"]: i for i in catalog["indicators"] if i["template"] == "MALL"}
    file_codes = {r["کد"] for r in rows}
    for code in sorted(file_codes - set(indexed)):
        problems.append(f"MALL {code}: in the workbook, missing from the catalog")
    for code in sorted(set(indexed) - file_codes):
        problems.append(f"MALL {code}: in the catalog, not in the workbook")
    for r in rows:
        ind = indexed.get(r["کد"])
        if not ind:
            continue
        for key, col in (("group", "گروه"), ("subject", "موضوع"), ("statement", "KPI")):
            if norm(ind[key]) != norm(r[col]):
                problems.append(f"MALL {r['کد']}: {key} differs ({ind[key]!r} vs {r[col]!r})")
        want = sorted(code for col, code in MALL_TYPES.items() if r.get(col) not in (None, ""))
        if want != sorted(ind["applicableMallTypes"]):
            problems.append(f"MALL {r['کد']}: mall types differ ({sorted(ind['applicableMallTypes'])} vs {want})")
        if ind.get("status") == "ARCHIVED":
            problems.append(f"MALL {r['کد']}: archived, but it is in the workbook")
    return problems, len(rows)


def main():
    with open(CATALOG, encoding="utf-8") as fh:
        catalog = json.load(fh)
    problems = []
    with open(CATALOG, "rb") as a, open(SRC_CATALOG, "rb") as b:
        if a.read() != b.read():
            problems.append("data/catalog.json and src/data/catalog.json differ")
    store_problems, store_n = check_store(catalog)
    mall_problems, mall_n = check_mall(catalog)
    problems += store_problems + mall_problems
    for p in problems[:40]:
        print("  ✗", p)
    if problems:
        print(f"{len(problems)} difference(s) between the catalog and the reference workbooks")
        sys.exit(1)
    print(f"catalog matches the reference workbooks exactly: {store_n} store and {mall_n} mall indicators")


main()
