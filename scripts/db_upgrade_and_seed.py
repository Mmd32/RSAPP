# -*- coding: utf-8 -*-
"""
db_upgrade_and_seed.py
Adds missing relational tables to rsapp.db:
- rules (with full provenance: id, name, rule_source, status, reason, created_by, created_at)
- users (auditors, supervisors, admins)
- reporting_dimensions (journey stages mapped relationally)
And seeds them with verified data.
"""

import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
import sqlite3
import json
import os

DB_PATH = os.path.join(ROOT, "data/rsapp.db")
CATALOG_PATH = os.path.join(ROOT, "data/catalog.json")

def upgrade_and_seed():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("PRAGMA foreign_keys = ON;")

    # 1. Create rules table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS rules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        rule_source TEXT CHECK(rule_source IN ('IMPORTED', 'MANUAL', 'DERIVED', 'SYSTEM')) NOT NULL,
        status TEXT CHECK(status IN ('DRAFT', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED')) NOT NULL,
        reason TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL
    );
    """)

    # 2. Create users table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT CHECK(role IN ('AUDITOR', 'SUPERVISOR', 'ADMIN')) NOT NULL,
        created_at TEXT NOT NULL
    );
    """)

    # 3. Create reporting_dimensions table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS reporting_dimensions (
        id TEXT PRIMARY KEY,
        template_id TEXT NOT NULL REFERENCES assessment_templates(id),
        code TEXT NOT NULL,
        name_fa TEXT NOT NULL,
        display_order INTEGER NOT NULL
    );
    """)

    # Seed Rules with verified Provenance
    rules_data = [
        (
            "RULE_TEMPLATE_ISOLATION",
            "تفکیک قطعی دامنه ارزیابی فروشگاه از مرکز خرید",
            "SYSTEM",
            "APPROVED",
            "شاخص‌های مرکز خرید هرگز به فروشگاه و بالعکس تخصیص نمی‌یابند مگر با تعریف جداگانه در همان تمپلیت",
            "SYSTEM_ARCHITECT",
            "2026-09-22T00:00:00Z"
        ),
        (
            "RULE_STORE_BASE_EXCEL",
            "شمول پایه صنف بر اساس ماتریس اکسل",
            "IMPORTED",
            "APPROVED",
            "تطبیق علامت X در ستون صنف فروشگاه در فایل مرجع FR Checklist- Fashion-Nima.xlsx",
            "EXCEL_INGESTION_PIPELINE",
            "2026-09-22T00:00:00Z"
        ),
        (
            "RULE_LOC_STREET_01",
            "حذف شاخص‌های مختص راهرو و کریدور مال در فروشگاه خیابانی",
            "MANUAL",
            "APPROVED",
            "فروشگاه خیابانی فاقد راهرو، کریدور، پله‌برقی و نقشه طبقات مال است",
            "RETAIL_EXPERTS_COMMITTEE",
            "2026-09-22T00:00:00Z"
        ),
        (
            "RULE_LOC_MALL_FS08",
            "حذف شاخص دید از معبر خیابان (FS08) در فروشگاه داخل مال",
            "MANUAL",
            "APPROVED",
            "تابلوی فروشگاه داخل مال در کریدور داخلی قرار دارد نه در فاصله ۱۵ تا ۲۰ متری معبر شهری",
            "RETAIL_EXPERTS_COMMITTEE",
            "2026-09-22T00:00:00Z"
        ),
        (
            "RULE_LOC_FC_01",
            "حذف شاخص‌های ریتیل سنتی در غرفه فودکورت",
            "MANUAL",
            "APPROVED",
            "غرفه فودکورت فاقد اتاق پرو، مانکن، ویترین لباس و تابلوی معبر بیرونی است",
            "RETAIL_EXPERTS_COMMITTEE",
            "2026-09-22T00:00:00Z"
        ),
        (
            "RULE_ATTR_NO_FITTING",
            "حذف شاخص‌های اتاق پرو در فروشگاه بدون پرو",
            "DERIVED",
            "APPROVED",
            "فروشگاه در ویژگی‌ها اعلام کرده که فاقد اتاق پرو است (FFR02 تا FFR06)",
            "DYNAMIC_PROFILE_BUILDER",
            "2026-09-22T00:00:00Z"
        ),
        (
            "RULE_ATTR_NO_SHOWCASE",
            "حذف شاخص‌های ویترین شیشه‌ای در فروشگاه فاقد ویترین",
            "DERIVED",
            "APPROVED",
            "فروشگاه اعلام کرده فاقد ویترین بیرونی است (FW02 تا FW06)",
            "DYNAMIC_PROFILE_BUILDER",
            "2026-09-22T00:00:00Z"
        ),
        (
            "RULE_ATTR_NO_MANNEQUINS",
            "حذف شاخص‌های مانکن در فروشگاه فاقد مانکن",
            "DERIVED",
            "APPROVED",
            "فروشگاه فاقد مانکن نمایشی است (کدهای FMA)",
            "DYNAMIC_PROFILE_BUILDER",
            "2026-09-22T00:00:00Z"
        ),
        (
            "RULE_ATTR_NO_ELEVATOR",
            "حذف شاخص‌های آسانسور و پله طبقات در فروشگاه فاقد آسانسور",
            "DERIVED",
            "APPROVED",
            "فروشگاه تک‌طبقه یا فاقد پله و آسانسور داخلی است (FAFE01 تا FAFE04)",
            "DYNAMIC_PROFILE_BUILDER",
            "2026-09-22T00:00:00Z"
        ),
        (
            "RULE_MALL_BASE_EXCEL",
            "شمول مقیاس مرکز خرید بر اساس ماتریس اکسل",
            "IMPORTED",
            "APPROVED",
            "تطبیق علامت X در ستون مقیاس مرکز خرید در فایل مرجع FR_Report_Mall V2Final Version.xlsx",
            "EXCEL_INGESTION_PIPELINE",
            "2026-09-22T00:00:00Z"
        ),
        (
            "RULE_MALL_SM_SCALE",
            "حذف تجهیزات فراتر از ظرفیت در مرکز خرید محلی/پایه (SM)",
            "MANUAL",
            "APPROVED",
            "مرکز خرید پایه (SM) فاقد تجهیزات مگامال نظیر پارکینگ هوشمند پیشرفته و تفریحات منطقه‌ای است",
            "MALL_ASSESSMENT_COMMITTEE",
            "2026-09-22T00:00:00Z"
        )
    ]

    cursor.executemany("""
    INSERT OR REPLACE INTO rules (id, name, rule_source, status, reason, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    """, rules_data)

    # Seed Default Users
    users_data = [
        ("USR_01", "auditor_nima", "نیما رضوانی (ارزیاب ارشد)", "AUDITOR", "2026-09-22T00:00:00Z"),
        ("USR_02", "sup_sara", "سارا احمدی (سرپرست بازرسی)", "SUPERVISOR", "2026-09-22T00:00:00Z"),
        ("USR_03", "admin_sys", "مدیر سیستم ارزیابی", "ADMIN", "2026-09-22T00:00:00Z")
    ]
    cursor.executemany("""
    INSERT OR REPLACE INTO users (id, username, full_name, role, created_at)
    VALUES (?, ?, ?, ?, ?)
    """, users_data)

    # Seed Reporting Dimensions
    store_stages = [
        ("DIM_S_01", "T_STORE", "BEFORE_ARRIVAL", "پیش از ورود و دسترسی", 1),
        ("DIM_S_02", "T_STORE", "APPROACH", "مواجهه، تابلو و نما", 2),
        ("DIM_S_03", "T_STORE", "ENTER", "ورودی و درب", 3),
        ("DIM_S_04", "T_STORE", "NAVIGATE", "گردش داخل و قفسه‌ها", 4),
        ("DIM_S_05", "T_STORE", "EXPLORE", "کاوش کالا و ویترین", 5),
        ("DIM_S_06", "T_STORE", "EVALUATE", "ارزیابی کالا و پرو", 6),
        ("DIM_S_07", "T_STORE", "STAFF", "تعامل با کارکنان", 7),
        ("DIM_S_08", "T_STORE", "PURCHASE", "صف و صندوق", 8),
        ("DIM_S_09", "T_STORE", "PACKAGING", "بسته‌بندی و تحویل", 9),
        ("DIM_S_10", "T_STORE", "AFTER_SALES", "خروج و خدمات پس از فروش", 10),
    ]

    mall_stages = [
        ("DIM_M_01", "T_MALL", "ARRIVAL", "دسترسی و مجاورت", 1),
        ("DIM_M_02", "T_MALL", "PARKING", "پارکینگ خودروها", 2),
        ("DIM_M_03", "T_MALL", "ENTRANCE", "ورودی و آستانه", 3),
        ("DIM_M_04", "T_MALL", "WAYFINDING", "علائم و مسیریابی", 4),
        ("DIM_M_05", "T_MALL", "VERTICAL_TRANSPORT", "پله‌برقی و آسانسور", 5),
        ("DIM_M_06", "T_MALL", "CIRCULATION", "راهروها و گردش", 6),
        ("DIM_M_07", "T_MALL", "PUBLIC_SPACE", "فضاهای عمومی", 7),
        ("DIM_M_08", "T_MALL", "FACILITIES", "سرویس‌ها و رفاهیات", 8),
        ("DIM_M_09", "T_MALL", "FOOD_BEVERAGE", "فودکورت و رستوران", 9),
        ("DIM_M_10", "T_MALL", "CUSTOMER_SERVICE", "امور مشتریان و CRM", 10),
        ("DIM_M_11", "T_MALL", "SAFETY", "امنیت و ایمنی", 11),
        ("DIM_M_12", "T_MALL", "STAFF", "کارکنان و بهره‌برداری", 12),
        ("DIM_M_13", "T_MALL", "EXIT", "خروج و تخلیه", 13),
    ]

    cursor.executemany("""
    INSERT OR REPLACE INTO reporting_dimensions (id, template_id, code, name_fa, display_order)
    VALUES (?, ?, ?, ?, ?)
    """, store_stages + mall_stages)

    conn.commit()

    # Also update catalog.json so client has access to rules and provenance
    with open(CATALOG_PATH, "r", encoding="utf-8") as f:
        catalog = json.load(f)

    catalog["rules"] = [
        {
            "id": r[0],
            "name": r[1],
            "rule_source": r[2],
            "status": r[3],
            "reason": r[4],
            "created_by": r[5],
            "created_at": r[6]
        }
        for r in rules_data
    ]
    catalog["reporting_dimensions"] = [
        {
            "id": d[0],
            "template": d[1],
            "code": d[2],
            "name": d[3],
            "displayOrder": d[4]
        }
        for d in (store_stages + mall_stages)
    ]

    with open(CATALOG_PATH, "w", encoding="utf-8") as f:
        json.dump(catalog, f, ensure_ascii=False, indent=2)

    # Output count of all tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    all_tables = [r[0] for r in cursor.fetchall() if r[0] != "sqlite_sequence"]
    
    print("Database tables upgraded and seeded successfully:")
    for t in sorted(all_tables):
        cursor.execute(f"SELECT count(*) FROM {t}")
        print(f"  - {t:<30}: {cursor.fetchone()[0]} records")

    conn.close()

if __name__ == "__main__":
    upgrade_and_seed()
