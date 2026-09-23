# -*- coding: utf-8 -*-
"""
audit_data_and_engine.py
Direct verification script for RSAPP Dynamic Assessment Engine.
Audits Excel files directly, checks formulas, rows, codes, applicability columns,
and reconciles the Fashion anomaly equation.
"""

import openpyxl
import re
import os
import sqlite3
import json

STORE_EXCEL_PATH = "/Users/mohammadreza/Desktop/RSAPP/data/reference/FR Checklist- Fashion-Nima.xlsx"
MALL_EXCEL_PATH = "/Users/mohammadreza/Desktop/RSAPP/data/reference/FR_Report_Mall V2Final Version.xlsx"
DB_PATH = "/Users/mohammadreza/Desktop/RSAPP/data/rsapp.db"

def normalize_text(text):
    if not text:
        return ""
    t = str(text).strip()
    t = re.sub(r'[\u200c\s]+', ' ', t)
    t = t.replace('ي', 'ی').replace('ك', 'ک')
    return t.strip()

def audit_store_excel():
    print("=" * 80)
    print("AUDIT SECTION 1 & 2: STORE EXCEL AUDIT")
    print("=" * 80)
    
    wb_raw = openpyxl.load_workbook(STORE_EXCEL_PATH, data_only=False)
    wb_data = openpyxl.load_workbook(STORE_EXCEL_PATH, data_only=True)
    
    ws_raw = wb_raw.active
    ws_data = wb_data.active
    
    total_physical_rows = ws_raw.max_row
    total_physical_cols = ws_raw.max_column
    headers = [cell.value for cell in ws_raw[1]]
    
    parsed_rows = []
    codes = []
    blank_codes = []
    dup_codes = {}
    ref_errors = []
    
    raw_subjects = set()
    normalized_subjects = set()
    raw_groups = set()
    
    # Track empty or malformed rows
    completely_blank_rows = []
    header_rows = [1]
    
    # Applicability columns: index 4 to 16 (0-indexed)
    bt_cols = {
        4: "Fashion",
        5: "Shoe & Bag",
        6: "Watch & Jewelry",
        7: "FMCG",
        8: "F&B",
        9: "Hardware",
        10: "Homeware",
        11: "Beauty/Cosmetics",
        12: "Electronics",
        13: "Entertainment",
        14: "Sports",
        15: "Specialty",
        16: "Services"
    }
    
    bt_stats = {bt: {"X": 0, "blank": 0, "unexpected": [], "indicators_with_X": [], "indicators_without_X": []} for bt in bt_cols.values()}
    
    for r_idx in range(2, total_physical_rows + 1):
        row_raw = [ws_raw.cell(row=r_idx, column=c).value for c in range(1, total_physical_cols + 1)]
        row_data = [ws_data.cell(row=r_idx, column=c).value for c in range(1, total_physical_cols + 1)]
        
        if not any(row_raw):
            completely_blank_rows.append(r_idx)
            continue
            
        group_val = row_data[0]
        code_val = row_data[1]
        subj_val = row_data[2]
        kpi_val = row_data[3]
        
        # Check broken formulas / #REF! in both raw formula and evaluated value
        has_ref = False
        for c_idx, cell_val in enumerate(row_raw):
            s_val = str(cell_val or '')
            if "#REF!" in s_val:
                has_ref = True
                ref_errors.append((r_idx, c_idx + 1, s_val, "raw_formula"))
        for c_idx, cell_val in enumerate(row_data):
            s_val = str(cell_val or '')
            if "#REF!" in s_val:
                has_ref = True
                ref_errors.append((r_idx, c_idx + 1, s_val, "evaluated_value"))
                
        code_str = str(code_val).strip() if code_val is not None else ""
        if not code_str:
            blank_codes.append(r_idx)
        else:
            if code_str in dup_codes:
                dup_codes[code_str].append(r_idx)
            else:
                dup_codes[code_str] = [r_idx]
            codes.append(code_str)
            
        if group_val:
            raw_groups.add(normalize_text(group_val))
        if subj_val:
            raw_subjects.add(str(subj_val).strip())
            normalized_subjects.add(normalize_text(subj_val))
            
        # Applicability
        for c_idx, bt_name in bt_cols.items():
            cell_val = row_data[c_idx]
            val_clean = str(cell_val).strip().upper() if cell_val is not None else ""
            if val_clean == "X":
                bt_stats[bt_name]["X"] += 1
                bt_stats[bt_name]["indicators_with_X"].append(code_str or f"ROW_{r_idx}")
            elif val_clean == "":
                bt_stats[bt_name]["blank"] += 1
                bt_stats[bt_name]["indicators_without_X"].append(code_str or f"ROW_{r_idx}")
            else:
                bt_stats[bt_name]["unexpected"].append((r_idx, code_str, cell_val))
                bt_stats[bt_name]["indicators_without_X"].append(code_str or f"ROW_{r_idx}")
                
        parsed_rows.append({
            "row_idx": r_idx,
            "group": group_val,
            "code": code_str,
            "subject": subj_val,
            "kpi": kpi_val,
            "has_ref": has_ref
        })
        
    unique_codes = set(codes)
    actual_duplicates = {k: v for k, v in dup_codes.items() if len(v) > 1}
    
    print(f"Store Excel Physical Worksheet Rows : {total_physical_rows}")
    print(f"Store Excel Header Rows             : {len(header_rows)} (Row 1)")
    print(f"Store Excel Completely Blank Rows    : {len(completely_blank_rows)} {completely_blank_rows}")
    print(f"Store Excel Parsed Indicator Rows    : {len(parsed_rows)}")
    print(f"Store Unique Indicator Codes         : {len(unique_codes)}")
    print(f"Store Duplicate Codes Detected       : {len(actual_duplicates)} {actual_duplicates}")
    print(f"Store Blank Codes                    : {len(blank_codes)} {blank_codes}")
    print(f"Store Broken Formulas / #REF!        : {len(ref_errors)} occurrences")
    print(f"Store Distinct Excel Groups          : {len(raw_groups)} -> {sorted(list(raw_groups))}")
    print(f"Store Distinct Raw Subjects          : {len(raw_subjects)}")
    print(f"Store Distinct Normalized Subjects   : {len(normalized_subjects)}")
    print(f"Store Business Type Columns Audited  : {len(bt_cols)}")
    
    return {
        "total_physical_rows": total_physical_rows,
        "parsed_rows": parsed_rows,
        "unique_codes": unique_codes,
        "duplicates": actual_duplicates,
        "blank_codes": blank_codes,
        "ref_errors": ref_errors,
        "groups": raw_groups,
        "subjects": normalized_subjects,
        "bt_stats": bt_stats
    }

def audit_mall_excel():
    print("\n" + "=" * 80)
    print("AUDIT SECTION 1 & 2: MALL EXCEL AUDIT")
    print("=" * 80)
    
    wb_raw = openpyxl.load_workbook(MALL_EXCEL_PATH, data_only=False)
    wb_data = openpyxl.load_workbook(MALL_EXCEL_PATH, data_only=True)
    
    ws_raw = wb_raw.active
    ws_data = wb_data.active
    
    total_physical_rows = ws_raw.max_row
    total_physical_cols = ws_raw.max_column
    headers = [cell.value for cell in ws_raw[1]]
    
    parsed_rows = []
    codes = []
    blank_codes = []
    dup_codes = {}
    ref_errors = []
    
    raw_subjects = set()
    normalized_subjects = set()
    raw_groups = set()
    
    completely_blank_rows = []
    header_rows = [1]
    
    mt_cols = {
        4: "SM",
        5: "Neighborhood",
        6: "Community",
        7: "Regional",
        8: "Super_Regional"
    }
    
    mt_stats = {mt: {"X": 0, "blank": 0, "unexpected": [], "indicators_with_X": [], "indicators_without_X": []} for mt in mt_cols.values()}
    
    for r_idx in range(2, total_physical_rows + 1):
        row_raw = [ws_raw.cell(row=r_idx, column=c).value for c in range(1, total_physical_cols + 1)]
        row_data = [ws_data.cell(row=r_idx, column=c).value for c in range(1, total_physical_cols + 1)]
        
        if not any(row_raw):
            completely_blank_rows.append(r_idx)
            continue
            
        group_val = row_data[0]
        code_val = row_data[1]
        subj_val = row_data[2]
        kpi_val = row_data[3]
        
        has_ref = False
        for c_idx, cell_val in enumerate(row_raw):
            s_val = str(cell_val or '')
            if "#REF!" in s_val:
                has_ref = True
                ref_errors.append((r_idx, c_idx + 1, s_val, "raw_formula"))
        for c_idx, cell_val in enumerate(row_data):
            s_val = str(cell_val or '')
            if "#REF!" in s_val:
                has_ref = True
                ref_errors.append((r_idx, c_idx + 1, s_val, "evaluated_value"))
                
        code_str = str(code_val).strip() if code_val is not None else ""
        if not code_str:
            blank_codes.append(r_idx)
        else:
            if code_str in dup_codes:
                dup_codes[code_str].append(r_idx)
            else:
                dup_codes[code_str] = [r_idx]
            codes.append(code_str)
            
        if group_val:
            raw_groups.add(normalize_text(group_val))
        if subj_val:
            raw_subjects.add(str(subj_val).strip())
            normalized_subjects.add(normalize_text(subj_val))
            
        # Applicability
        for c_idx, mt_name in mt_cols.items():
            cell_val = row_data[c_idx]
            val_clean = str(cell_val).strip().upper() if cell_val is not None else ""
            if val_clean == "X":
                mt_stats[mt_name]["X"] += 1
                mt_stats[mt_name]["indicators_with_X"].append(code_str or f"ROW_{r_idx}")
            elif val_clean == "":
                mt_stats[mt_name]["blank"] += 1
                mt_stats[mt_name]["indicators_without_X"].append(code_str or f"ROW_{r_idx}")
            else:
                mt_stats[mt_name]["unexpected"].append((r_idx, code_str, cell_val))
                mt_stats[mt_name]["indicators_without_X"].append(code_str or f"ROW_{r_idx}")
                
        parsed_rows.append({
            "row_idx": r_idx,
            "group": group_val,
            "code": code_str,
            "subject": subj_val,
            "kpi": kpi_val,
            "has_ref": has_ref
        })
        
    unique_codes = set(codes)
    actual_duplicates = {k: v for k, v in dup_codes.items() if len(v) > 1}
    
    print(f"Mall Excel Physical Worksheet Rows  : {total_physical_rows}")
    print(f"Mall Excel Header Rows              : {len(header_rows)} (Row 1)")
    print(f"Mall Excel Completely Blank Rows     : {len(completely_blank_rows)} {completely_blank_rows}")
    print(f"Mall Excel Parsed Indicator Rows     : {len(parsed_rows)}")
    print(f"Mall Unique Indicator Codes          : {len(unique_codes)}")
    print(f"Mall Duplicate Codes Detected        : {len(actual_duplicates)} {actual_duplicates}")
    print(f"Mall Blank Codes                     : {len(blank_codes)} {blank_codes}")
    print(f"Mall Broken Formulas / #REF!         : {len(ref_errors)} occurrences")
    print(f"Mall Distinct Excel Groups           : {len(raw_groups)} -> {sorted(list(raw_groups))}")
    print(f"Mall Distinct Raw Subjects           : {len(raw_subjects)}")
    print(f"Mall Distinct Normalized Subjects    : {len(normalized_subjects)}")
    print(f"Mall Mall Type Columns Audited       : {len(mt_cols)}")
    
    return {
        "total_physical_rows": total_physical_rows,
        "parsed_rows": parsed_rows,
        "unique_codes": unique_codes,
        "duplicates": actual_duplicates,
        "blank_codes": blank_codes,
        "ref_errors": ref_errors,
        "groups": raw_groups,
        "subjects": normalized_subjects,
        "mt_stats": mt_stats
    }

if __name__ == "__main__":
    s_res = audit_store_excel()
    m_res = audit_mall_excel()
