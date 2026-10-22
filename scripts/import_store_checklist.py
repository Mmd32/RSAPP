# -*- coding: utf-8 -*-
"""
Imports the store checklist from Nima's workbook (data/reference/FR Checklist- Fashion-Nima.xlsx)
into data/catalog.json and src/data/catalog.json. Mall indicators and all rules are left alone.

The workbook has two sheets:

  "Check List"         visible, the Fashion checklist, one row per KPI with the full wording.
  "Check List-V5 (2)"  hidden, every sector (13 X columns) but with shortened wording.

What is taken from where:
  * The indicator list, order, codes, zone, topic and statement come from "Check List".
  * Which sectors a KPI applies to comes from the same code in "Check List-V5 (2)".
    Fashion always applies (it is the Fashion list). A KPI that has no row in V5 gets Fashion only.
  * Excel notes (the red triangles) on a KPI cell become that KPI's auditor note. Notes on the code
    column only spell out what a code prefix means ("Floor Signboard") and are not imported.
  * Nothing is written by this script: no wording, no weights.

Reading quirks of the workbook (both are properties of the file, not choices made here):
  * The zone column is a "same as the row above" formula chain that is broken (#REF!) in places.
    The zone is the last literal zone label above the row (the sheet is ordered in zone blocks).
  * Some topic cells are broken too. The topic is then taken from the same code in the other sheet,
    and failing that from the row above (the same fill-down convention).

The catalog also carries two internal classification fields the workbook does not have:
journeyStage and reportingDimension (they drive the legacy 8-dimension radar and the order of
the form). They are copied from the previous catalog row with the same code, else from the previous
rows with the same topic, else from the zone. The report prints how many rows used each source.

Run: python3 scripts/import_store_checklist.py [--dry-run]
"""
import collections
import json
import os
import re
import sys

import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XLSX = os.path.join(ROOT, "data/reference/FR Checklist- Fashion-Nima.xlsx")
FILES = [os.path.join(ROOT, "data/catalog.json"), os.path.join(ROOT, "src/data/catalog.json")]
FASHION_SHEET, MATRIX_SHEET = "Check List", "Check List-V5 (2)"
HEADER_ROW = 8

SECTORS = {"Fashion": "Fashion", "Shoe & Bag": "Shoe_Bag", "Watch & Jewelry": "Watch_Jewelry", "FMCG": "FMCG",
           "F&B": "F_B", "Hardware": "Hardware", "Homeware": "Homeware", "Beauty/Cosmetics": "Beauty_Cosmetics",
           "Electronics": "Electronics", "Entertainment": "Entertainment", "Sports": "Sports",
           "Specialty": "Specialty", "Services": "Services"}
ZONE_RE = re.compile(r"(FLOOR|SERVICES|TEAM|PRODUCT|CASH)")


def clean(value):
    """Collapse whitespace; keep half-spaces (ZWNJ) and every other character as written."""
    return " ".join(str(value or "").split())


def note_of(cell):
    """Text of an Excel note on the KPI cell, without the author's name Excel puts in front."""
    comment = cell.comment
    if not comment:
        return ""
    text = (comment.text or "").strip()
    author = (comment.author or "").strip()
    if author and text.startswith(author):
        text = text[len(author):].lstrip(" :\n\t")
    return clean(text)


def key(value):
    return re.sub(r"[\s‌()/.\-–]+", "", clean(value))


def read_sheet(wb_formulas, wb_values, name):
    wf, wv = wb_formulas[name], wb_values[name]
    header = [clean(c.value) for c in wv[HEADER_ROW]]
    zone = None
    rows = []
    for r in range(HEADER_ROW + 1, wv.max_row + 1):
        label = wf.cell(r, 1).value
        if isinstance(label, str) and not label.startswith("="):
            m = ZONE_RE.search(label)
            if m:
                zone = m.group(1)
        code = wv.cell(r, 2).value
        if not code:
            continue  # label-only rows carry no KPI
        row = {header[i]: wv.cell(r, i + 1).value for i in range(len(header)) if header[i]}
        row.update(_row=r, _zone=zone, _code=clean(code), _note=note_of(wf.cell(r, 4)))
        rows.append(row)
    return header, rows


def occurrence_index(rows):
    seen = collections.Counter()
    out = {}
    for row in rows:
        seen[row["_code"]] += 1
        out[(row["_code"], seen[row["_code"]])] = row
    return out


def resolve_topics(rows, other_by_code):
    """Fills unreadable topic cells; returns how many came from the other sheet / the row above."""
    stats = collections.Counter()
    previous = None
    seen = collections.Counter()
    for row in rows:
        seen[row["_code"]] += 1
        topic = clean(row.get("موضوع"))
        if topic in ("", "#REF!"):
            twin = other_by_code.get((row["_code"], seen[row["_code"]]))
            twin_topic = clean(twin.get("موضوع")) if twin else ""
            if twin_topic and twin_topic != "#REF!":
                topic, source = twin_topic, "other sheet"
            else:
                topic, source = previous, "row above"
            stats[source] += 1
        row["_topic"] = topic
        previous = topic
    return stats


def parse_workbook():
    """The workbook's KPI list as plain rows: order, code, zone, topic, statement, sectors."""
    wf = openpyxl.load_workbook(XLSX)
    wv = openpyxl.load_workbook(XLSX, data_only=True)
    _, fashion = read_sheet(wf, wv, FASHION_SHEET)
    matrix_header, matrix = read_sheet(wf, wv, MATRIX_SHEET)
    f_idx, m_idx = occurrence_index(fashion), occurrence_index(matrix)
    topic_stats = resolve_topics(fashion, m_idx)
    resolve_topics(matrix, f_idx)
    rows = []
    for n, (code_occ, row) in enumerate(f_idx.items(), start=1):
        twin = m_idx.get(code_occ)
        sectors = ["Fashion"]
        if twin:
            sectors = [SECTORS[h] for h in matrix_header if h in SECTORS and twin.get(h) not in (None, "")]
            if "Fashion" not in sectors:
                sectors.insert(0, "Fashion")  # it is on the Fashion list, whatever V5 says
        rows.append({"order": n, "code": row["_code"], "group": row["_zone"], "subject": clean(row["_topic"]),
                     "statement": clean(row["KPI"]), "note": row["_note"], "sectors": sectors,
                     "in_matrix": twin is not None})
    return rows, topic_stats


def main(dry_run):
    rows, topic_stats = parse_workbook()

    with open(FILES[0], encoding="utf-8") as fh:
        catalog = json.load(fh)
    previous = [i for i in catalog["indicators"] if i["template"] == "STORE"]
    by_code = {}
    for ind in previous:
        by_code.setdefault(ind["code"], ind)
    by_topic = collections.defaultdict(list)
    by_zone = collections.defaultdict(list)
    for ind in previous:
        by_topic[key(ind["subject"])].append(ind)
        by_zone[ind["group"]].append(ind)

    def majority(items, field):
        return collections.Counter(i[field] for i in items).most_common(1)[0][0]

    source = collections.Counter()
    store = []
    for row in rows:
        old = by_code.get(row["code"])
        if old and key(old["subject"]) == key(row["subject"]):
            origin, donor = "same code and topic", old
        elif by_topic.get(key(row["subject"])):
            origin, donor = "same topic", by_topic[key(row["subject"])]
        else:
            origin, donor = "same zone", by_zone[row["group"]]
        source[origin] += 1
        if isinstance(donor, dict):
            stage, dim = donor["journeyStage"], donor["reportingDimension"]
            photo, comment, weight = donor["requiresPhoto"], donor["requiresComment"], donor["weight"]
        else:
            stage, dim = majority(donor, "journeyStage"), majority(donor, "reportingDimension")
            photo, comment, weight = False, False, 1.0
        store.append({
            "id": f"IND_FR_{row['order']:04d}",
            "code": row["code"],
            "template": "STORE",
            "group": row["group"],
            "subject": row["subject"],
            "journeyStage": stage,
            "reportingDimension": dim,
            "originalText": row["statement"],
            "statement": row["statement"],
            "status": "ACTIVE",
            "version": 1,
            "weight": weight,
            "requiresPhoto": photo,
            "requiresComment": comment,
            "displayOrder": row["order"],
            "applicableBusinessTypes": row["sectors"],
            "applicableMallTypes": [],
            **({"auditorNote": row["note"]} if row["note"] else {}),
        })

    fashion_only = [r["code"] for r in rows if not r["in_matrix"]]
    by_zone_count = collections.Counter(i["group"] for i in store)
    print(f"{len(store)} store indicators from '{FASHION_SHEET}':", dict(by_zone_count))
    print("unreadable topic cells filled from:", dict(topic_stats))
    print("no row in the all-sector sheet (Fashion only):", fashion_only)
    print("journeyStage / reportingDimension / weight taken from:", dict(source))
    if dry_run:
        return
    for path in FILES:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
        data["indicators"] = store + [i for i in data["indicators"] if i["template"] != "STORE"]
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(json.dumps(data, ensure_ascii=False, indent=2))
    print("written:", ", ".join(os.path.relpath(p, ROOT) for p in FILES))


if __name__ == "__main__":
    main("--dry-run" in sys.argv)
