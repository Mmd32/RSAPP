# -*- coding: utf-8 -*-
"""
Checks that the indicator catalog is exactly the reference checklists:
every row of the store and mall workbooks in data/reference/ must exist in
data/catalog.json with the same code, zone, topic, statement and applicability
(13 retail sectors for stores, 5 mall types for malls), and the catalog may
hold nothing else. Run: python3 scripts/verify_catalog_against_reference.py
Exits non-zero on any difference.
"""
import json
import os
import sys

import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CATALOG = os.path.join(ROOT, "data/catalog.json")
SRC_CATALOG = os.path.join(ROOT, "src/data/catalog.json")
STORE_XLSX = os.path.join(ROOT, "data/reference/FR Checklist- Fashion-Nima.xlsx")
MALL_XLSX = os.path.join(ROOT, "data/reference/FR_Report_Mall V2Final Version.xlsx")

SECTORS = {"Fashion": "Fashion", "Shoe & Bag": "Shoe_Bag", "Watch & Jewelry": "Watch_Jewelry", "FMCG": "FMCG",
           "F&B": "F_B", "Hardware": "Hardware", "Homeware": "Homeware", "Beauty/Cosmetics": "Beauty_Cosmetics",
           "Electronics": "Electronics", "Entertainment": "Entertainment", "Sports": "Sports",
           "Specialty": "Specialty", "Services": "Services"}
MALL_TYPES = {"SM": "SM", "Neighborhood Shopping Center": "Neighborhood", "Community Mall": "Community",
              "Regional Mall": "Regional", "Super Regional Mall": "Super_Regional"}


def norm(value):
    return " ".join(str(value or "").replace("‌", " ").split())


def read_rows(path):
    ws = openpyxl.load_workbook(path, data_only=True).worksheets[0]
    header = [c.value for c in ws[1]]
    return [dict(zip(header, [c.value for c in row])) for row in ws.iter_rows(min_row=2) if row[1].value]


def check(template, rows, columns, field, catalog):
    problems = []
    indexed = {i["code"]: i for i in catalog["indicators"] if i["template"] == template}
    file_codes = {r["کد"] for r in rows}
    for code in sorted(file_codes - set(indexed)):
        problems.append(f"{template} {code}: in the workbook, missing from the catalog")
    for code in sorted(set(indexed) - file_codes):
        problems.append(f"{template} {code}: in the catalog, not in the workbook")
    for r in rows:
        ind = indexed.get(r["کد"])
        if not ind:
            continue
        for key, col in (("group", "گروه"), ("subject", "موضوع"), ("statement", "KPI")):
            if norm(ind[key]) != norm(r[col]):
                problems.append(f"{template} {r['کد']}: {key} differs ({ind[key]!r} vs {r[col]!r})")
        want = sorted(code for col, code in columns.items() if r.get(col) not in (None, ""))
        if want != sorted(ind[field]):
            problems.append(f"{template} {r['کد']}: {field} differs ({sorted(ind[field])} vs {want})")
        if ind.get("status") == "ARCHIVED":
            problems.append(f"{template} {r['کد']}: archived, but it is in the workbook")
    return problems, len(rows)


def main():
    with open(CATALOG, encoding="utf-8") as fh:
        catalog = json.load(fh)
    problems = []
    with open(CATALOG, "rb") as a, open(SRC_CATALOG, "rb") as b:
        if a.read() != b.read():
            problems.append("data/catalog.json and src/data/catalog.json differ")
    store_problems, store_n = check("STORE", read_rows(STORE_XLSX), SECTORS, "applicableBusinessTypes", catalog)
    mall_problems, mall_n = check("MALL", read_rows(MALL_XLSX), MALL_TYPES, "applicableMallTypes", catalog)
    problems += store_problems + mall_problems
    for p in problems[:40]:
        print("  ✗", p)
    if problems:
        print(f"{len(problems)} difference(s) between the catalog and the reference workbooks")
        sys.exit(1)
    print(f"catalog matches the reference workbooks exactly: {store_n} store and {mall_n} mall indicators")


main()
