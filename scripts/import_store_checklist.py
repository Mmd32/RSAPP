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

Fashion per store format
------------------------
Fashion is not read from the sheets above any more. Each Fashion store format has its own workbook
(data/reference/FR_Checklist_Fashion_*.xlsx, visible sheet "Check List- Fashion", an X in the
format's column marks the KPIs that format is asked). The Fashion list is the union of the four
files in the order of the Shopping mall file (the other three are subsequences of it, checked on
import); every row records the formats whose file has it (applicableFormats). The hidden all-sector
sheet in those files is the same as in Nima's workbook, so the other 12 sectors are unchanged.
Blank topic cells in the format files are merged cells: they take the topic of the row above.

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
FORMAT_SHEET = "Check List- Fashion"
FORMAT_FILES = {  # LocationContext code -> workbook (listed in the order the formats are shown)
    "STREET_STORE": "data/reference/FR_Checklist_Fashion_Stand_alone.xlsx",
    "MALL_STORE": "data/reference/FR_Checklist_Fashion_Shopping_mall.xlsx",
    "SHOP_IN_SHOP": "data/reference/FR_Checklist_Fashion_Shop_in_Shop.xlsx",
    "KIOSK": "data/reference/FR_Checklist_Fashion_Kiosk.xlsx",
}
MASTER_FORMAT = "MALL_STORE"  # the file with every Fashion KPI, in the reading order

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


def key_of(value):
    return key(value)


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


def parse_matrix_workbook():
    """The Nima workbook's KPI list as plain rows: order, code, zone, topic, statement, sectors.

    The visible sheet is the Fashion checklist (full wording, the order people read). The hidden
    all-sector sheet also carries KPIs that only other sectors have (a column with an X marks the
    sectors a KPI applies to). Those rows are added too, in the place the all-sector sheet gives
    them (right after the last KPI before them that the visible sheet has), so every sector gets
    exactly the KPIs marked for it.
    """
    wf = openpyxl.load_workbook(XLSX)
    wv = openpyxl.load_workbook(XLSX, data_only=True)
    _, fashion = read_sheet(wf, wv, FASHION_SHEET)
    matrix_header, matrix = read_sheet(wf, wv, MATRIX_SHEET)
    f_idx, m_idx = occurrence_index(fashion), occurrence_index(matrix)
    topic_stats = resolve_topics(fashion, m_idx)
    resolve_topics(matrix, f_idx)

    def sectors_of(twin):
        found = [SECTORS[h] for h in matrix_header if h in SECTORS and twin.get(h) not in (None, "")]
        return found

    # A KPI can carry another code in the all-sector sheet (visible FI03 is FI02 there): the same
    # KPI then has the same wording once the topic is taken off, and the two are one KPI.
    renamed = {}
    claimed = set()
    for key, row in m_idx.items():
        if key in f_idx:
            continue
        text = clean(row["KPI"])
        hits = [k for k, v in f_idx.items()
                if k not in m_idx and k not in claimed and text and clean(v["KPI"]).endswith(text)
                and key_of(v["_topic"]) == key_of(row["_topic"])]
        if len(hits) == 1:
            renamed[hits[0]] = row
            claimed.add(hits[0])
    renamed_matrix = {id(r) for r in renamed.values()}

    rows = []
    for code_occ, row in f_idx.items():
        twin = m_idx.get(code_occ) or renamed.get(code_occ)
        sectors = ["Fashion"]
        if twin:
            sectors = sectors_of(twin)
            if "Fashion" not in sectors:
                sectors.insert(0, "Fashion")  # it is on the Fashion list, whatever the matrix says
        rows.append({"code": row["_code"], "group": row["_zone"], "subject": clean(row["_topic"]),
                     "statement": clean(row["KPI"]), "note": row["_note"], "sectors": sectors,
                     "in_matrix": twin is not None, "source": "checklist"})

    # KPIs only the all-sector sheet has, placed after the last matrix KPI before them that the visible sheet has.
    position = {(r["code"], n): i for i, r in enumerate(rows) for n in [1 + sum(1 for q in rows[:i] if q["code"] == r["code"])]}
    seen = collections.Counter()
    anchor = -1
    inserted_after = collections.defaultdict(int)
    extras = []
    for row in matrix:
        seen[row["_code"]] += 1
        key = (row["_code"], seen[row["_code"]])
        if key in f_idx:
            anchor = position[key]
            continue
        if id(row) in renamed_matrix:
            continue
        sectors = sectors_of(row)
        if not sectors:
            continue
        extras.append((anchor, {"code": row["_code"], "group": row["_zone"], "subject": clean(row["_topic"]),
                                "statement": clean(row["KPI"]), "note": row["_note"], "sectors": sectors,
                                "in_matrix": True, "source": "matrix"}))
    merged = []
    for i, r in enumerate(rows):
        merged.append(r)
        merged.extend(e for a, e in extras if a == i)
    merged = [e for a, e in extras if a == -1] + merged
    for n, r in enumerate(merged, start=1):
        r["order"] = n
    return merged, topic_stats


def parse_format_workbooks():
    """Fashion KPIs from the four store-format workbooks, one row per KPI in the master order."""
    per_format = {}
    for fmt, rel in FORMAT_FILES.items():
        path = os.path.join(ROOT, rel)
        wf, wv = openpyxl.load_workbook(path), openpyxl.load_workbook(path, data_only=True)
        _, rows = read_sheet(wf, wv, FORMAT_SHEET)
        per_format[fmt] = rows
    master = per_format[MASTER_FORMAT]
    order = [r["_code"] for r in master]
    if len(set(order)) != len(order):
        raise SystemExit("duplicate code in the master Fashion file")
    for fmt, rows in per_format.items():
        codes = [r["_code"] for r in rows]
        it = iter(order)
        if len(set(codes)) != len(codes) or not all(c in it for c in codes):
            raise SystemExit(f"{fmt}: codes repeat or are not in the master order")
    by_code = {}
    for fmt, rows in per_format.items():
        for r in rows:
            by_code.setdefault(r["_code"], {})[fmt] = r
    rows, previous_topic = [], None
    for code in order:
        variants = by_code[code]
        first = variants[MASTER_FORMAT]
        for field in ("KPI", "_zone"):
            if len({clean(v[field]) for v in variants.values()}) > 1:
                raise SystemExit(f"{code}: {field} differs between the format files")
        topic = next((clean(v["موضوع"]) for v in variants.values() if clean(v["موضوع"]) not in ("", "#REF!")), "")
        topic = topic or previous_topic
        previous_topic = topic
        note = next((v["_note"] for v in variants.values() if v["_note"]), "")
        rows.append({"code": code, "group": first["_zone"], "subject": topic, "statement": clean(first["KPI"]),
                     "note": note, "sectors": ["Fashion"], "formats": [f for f in FORMAT_FILES if f in variants],
                     "in_matrix": False, "source": "format"})
    return rows


def parse_workbook():
    """Every store KPI: the Fashion list of the format workbooks first, then the other sectors' KPIs.

    The Nima workbook rows keep their ids and order; Fashion is taken off them (the format workbooks
    are the Fashion list) and a row left with no sector at all is dropped.
    """
    matrix_rows, topic_stats = parse_matrix_workbook()
    n_checklist = n_matrix = 0
    n_visible = sum(1 for r in matrix_rows if r["source"] == "checklist")
    rest = []
    for row in matrix_rows:
        if row["source"] == "checklist":
            n_checklist += 1
            row["number"] = n_checklist
        else:
            n_matrix += 1
            row["number"] = n_visible + n_matrix
        row["sectors"] = [s for s in row["sectors"] if s != "Fashion"]
        if row["sectors"]:
            row["formats"] = []
            rest.append(row)
    fashion = parse_format_workbooks()
    for n, row in enumerate(fashion, start=1):
        row["number"] = n
    merged = fashion + rest
    for n, row in enumerate(merged, start=1):
        row["order"] = n
    return merged, topic_stats


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
    # Ids stay as they were for the Nima rows (IND_FR_, numbered in that workbook's order); the Fashion
    # format rows are IND_FF_ in the Shopping mall file's order.
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
            "id": f"IND_FF_{row['number']:04d}" if row["source"] == "format" else f"IND_FR_{row['number']:04d}",
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
            **({"applicableFormats": row["formats"]} if row["formats"] else {}),
            **({"auditorNote": row["note"]} if row["note"] else {}),
        })

    fashion_only = [r["code"] for r in rows if not r["in_matrix"] and r["source"] != "format"]
    by_source = collections.Counter(r["source"] for r in rows)
    by_zone_count = collections.Counter(i["group"] for i in store)
    print(f"{len(store)} store indicators ({dict(by_source)}):", dict(by_zone_count))
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
