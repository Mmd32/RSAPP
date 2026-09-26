# -*- coding: utf-8 -*-
"""
migrate_v2.py
Rebuilds and migrates RSAPP SQLite Database to Architecture V2:
- Clean Indicator Bank with dual text (original_text + normalized_text), status, version
- Dedicated JourneyStage and ReportingDimension entities
- Complete Rule model (id, name, rule_type, rule_source, status, priority, conditions, effect, reason)
- Snapshot table storing full historical state
- Visit Audit Trail table storing profile, applied rules, selected/excluded codes, and conflict logs
- Exports clean catalog.json
"""

import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
import os
import re
import json
import sqlite3
import openpyxl

STORE_EXCEL_PATH = os.path.join(ROOT, "data/reference/FR Checklist- Fashion-Nima.xlsx")
MALL_EXCEL_PATH = os.path.join(ROOT, "data/reference/FR_Report_Mall V2Final Version.xlsx")
DB_PATH = os.path.join(ROOT, "data/rsapp.db")
CATALOG_PATH = os.path.join(ROOT, "data/catalog.json")
SRC_CATALOG_PATH = os.path.join(ROOT, "src/data/catalog.json")

def normalize_text(text):
    if not text:
        return ""
    t = str(text).strip()
    t = re.sub(r'[\u200c\s]+', ' ', t)
    t = t.replace('ي', 'ی').replace('ك', 'ک')
    return t.strip()

def build_schema(conn):
    cursor = conn.cursor()
    cursor.executescript("""
    PRAGMA foreign_keys = ON;

    DROP TABLE IF EXISTS visit_audit_trails;
    DROP TABLE IF EXISTS evidence_photos;
    DROP TABLE IF EXISTS visit_responses;
    DROP TABLE IF EXISTS visit_indicator_snapshots;
    DROP TABLE IF EXISTS visits;
    DROP TABLE IF EXISTS indicator_applicabilities;
    DROP TABLE IF EXISTS indicators;
    DROP TABLE IF EXISTS rules;
    DROP TABLE IF EXISTS subjects;
    DROP TABLE IF EXISTS indicator_groups;
    DROP TABLE IF EXISTS reporting_dimensions;
    DROP TABLE IF EXISTS journey_stages;
    DROP TABLE IF EXISTS store_formats;
    DROP TABLE IF EXISTS location_contexts;
    DROP TABLE IF EXISTS mall_types;
    DROP TABLE IF EXISTS business_types;
    DROP TABLE IF EXISTS assessment_templates;
    DROP TABLE IF EXISTS users;

    -- 1. Assessment Templates
    CREATE TABLE assessment_templates (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        name_fa TEXT NOT NULL
    );

    -- 2. Business Types
    CREATE TABLE business_types (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        name_fa TEXT NOT NULL,
        name_en TEXT NOT NULL,
        display_order INTEGER NOT NULL,
        is_active BOOLEAN DEFAULT 1
    );

    -- 3. Mall Types
    CREATE TABLE mall_types (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        name_fa TEXT NOT NULL,
        display_order INTEGER NOT NULL,
        is_active BOOLEAN DEFAULT 1
    );

    -- 4. Location Contexts
    CREATE TABLE location_contexts (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        name_fa TEXT NOT NULL,
        description TEXT
    );

    -- 5. Store Formats
    CREATE TABLE store_formats (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        name_fa TEXT NOT NULL
    );

    -- 6. Journey Stages
    CREATE TABLE journey_stages (
        id TEXT PRIMARY KEY,
        template_id TEXT NOT NULL REFERENCES assessment_templates(id),
        code TEXT NOT NULL,
        name_fa TEXT NOT NULL,
        name_en TEXT NOT NULL,
        display_order INTEGER NOT NULL,
        UNIQUE(template_id, code)
    );

    -- 7. Reporting Dimensions
    CREATE TABLE reporting_dimensions (
        id TEXT PRIMARY KEY,
        template_id TEXT NOT NULL REFERENCES assessment_templates(id),
        code TEXT NOT NULL,
        name_fa TEXT NOT NULL,
        name_en TEXT NOT NULL,
        display_order INTEGER NOT NULL,
        UNIQUE(template_id, code)
    );

    -- 8. Indicator Groups (Excel Macro Groups)
    CREATE TABLE indicator_groups (
        id TEXT PRIMARY KEY,
        template_id TEXT NOT NULL REFERENCES assessment_templates(id),
        code TEXT NOT NULL,
        name_fa TEXT NOT NULL,
        display_order INTEGER NOT NULL
    );

    -- 9. Subjects
    CREATE TABLE subjects (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL REFERENCES indicator_groups(id),
        code TEXT NOT NULL,
        original_name TEXT NOT NULL,
        normalized_name TEXT NOT NULL
    );

    -- 10. Rules Model
    CREATE TABLE rules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        rule_type TEXT CHECK(rule_type IN ('APPLICABILITY', 'EXCLUSION', 'DEPENDENCY', 'REQUIREMENT', 'SCORING')) NOT NULL,
        rule_source TEXT CHECK(rule_source IN ('IMPORTED', 'MANUAL', 'DERIVED', 'SYSTEM')) NOT NULL,
        status TEXT CHECK(status IN ('DRAFT', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED')) NOT NULL,
        priority INTEGER NOT NULL DEFAULT 50,
        conditions TEXT NOT NULL, -- JSON
        effect TEXT CHECK(effect IN ('INCLUDE', 'EXCLUDE', 'MAKE_REQUIRED', 'MAKE_OPTIONAL', 'AUTO_NA', 'SHOW_DEPENDENT', 'HIDE_DEPENDENT')) NOT NULL,
        reason TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    -- 11. Indicators (Clean Master Bank with Dual Text)
    CREATE TABLE indicators (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL,
        assessment_type TEXT CHECK(assessment_type IN ('STORE', 'MALL')) NOT NULL,
        group_id TEXT NOT NULL REFERENCES indicator_groups(id),
        subject_id TEXT NOT NULL REFERENCES subjects(id),
        journey_stage_id TEXT NOT NULL REFERENCES journey_stages(id),
        reporting_dimension_id TEXT NOT NULL REFERENCES reporting_dimensions(id),
        original_text TEXT NOT NULL,
        normalized_text TEXT NOT NULL,
        description TEXT,
        status TEXT CHECK(status IN ('DRAFT', 'NEEDS_REVIEW', 'ACTIVE', 'ARCHIVED')) DEFAULT 'ACTIVE' NOT NULL,
        version INTEGER DEFAULT 1 NOT NULL,
        weight REAL DEFAULT 1.0 NOT NULL,
        requires_photo BOOLEAN DEFAULT 0,
        requires_comment BOOLEAN DEFAULT 1,
        display_order INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    -- 12. Indicator Applicabilities (Base Excel Matrix)
    CREATE TABLE indicator_applicabilities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        indicator_id TEXT NOT NULL REFERENCES indicators(id),
        business_type_code TEXT,
        mall_type_code TEXT,
        is_applicable BOOLEAN DEFAULT 1
    );

    -- 13. Users
    CREATE TABLE users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT CHECK(role IN ('AUDITOR', 'SUPERVISOR', 'ADMIN')) NOT NULL,
        created_at TEXT NOT NULL
    );

    -- 14. Visits
    CREATE TABLE visits (
        id TEXT PRIMARY KEY,
        visit_code TEXT UNIQUE NOT NULL,
        brand_name TEXT NOT NULL,
        branch_name TEXT NOT NULL,
        assessment_type TEXT NOT NULL,
        business_type_code TEXT,
        location_context_code TEXT NOT NULL,
        store_format_code TEXT,
        mall_type_code TEXT,
        auditor_name TEXT NOT NULL,
        supervisor_name TEXT,
        status TEXT NOT NULL DEFAULT 'IN_PROGRESS',
        overall_score REAL,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 15. Visit Indicator Snapshots (Immutable Audit Copies)
    CREATE TABLE visit_indicator_snapshots (
        id TEXT PRIMARY KEY,
        visit_id TEXT NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
        indicator_id TEXT NOT NULL REFERENCES indicators(id),
        indicator_version INTEGER NOT NULL,
        code TEXT NOT NULL,
        text TEXT NOT NULL,
        subject TEXT NOT NULL,
        group_name TEXT NOT NULL,
        journey_stage TEXT NOT NULL,
        reporting_dimension TEXT NOT NULL,
        weight REAL NOT NULL,
        requirements TEXT NOT NULL, -- JSON
        applicability_reason TEXT NOT NULL,
        scoring_profile TEXT NOT NULL, -- JSON
        created_at TEXT NOT NULL
    );

    -- 16. Visit Responses
    CREATE TABLE visit_responses (
        id TEXT PRIMARY KEY,
        visit_id TEXT NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
        snapshot_id TEXT NOT NULL UNIQUE REFERENCES visit_indicator_snapshots(id),
        answer_state TEXT NOT NULL, -- NO_FRICTION, FRICTION, NOT_APPLICABLE, UNANSWERED, POSITIVE_REWARD, NEUTRAL
        observation_type TEXT,      -- FRICTION, REWARD, NEUTRAL
        severity TEXT,              -- LOW, MEDIUM, HIGH, CRITICAL
        comment TEXT,
        recommendation TEXT,
        is_flagged BOOLEAN DEFAULT 0,
        answered_at DATETIME
    );

    -- 17. Evidence Photos
    CREATE TABLE evidence_photos (
        id TEXT PRIMARY KEY,
        visit_id TEXT NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
        response_id TEXT NOT NULL REFERENCES visit_responses(id) ON DELETE CASCADE,
        file_path TEXT NOT NULL,
        caption TEXT,
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 18. Visit Audit Trails
    CREATE TABLE visit_audit_trails (
        id TEXT PRIMARY KEY,
        visit_id TEXT NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
        profile_snapshot TEXT NOT NULL, -- JSON
        rules_applied TEXT NOT NULL, -- JSON
        selected_indicators TEXT NOT NULL, -- JSON
        excluded_indicators TEXT NOT NULL, -- JSON
        conflicts_logged TEXT NOT NULL, -- JSON
        created_at TEXT NOT NULL
    );
    """)
    conn.commit()

def run_migration():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    build_schema(conn)

    # 1. Base Metadata
    cursor.executemany("INSERT INTO assessment_templates VALUES (?,?,?)", [
        ("T_STORE", "STORE", "ارزیابی فروشگاه"),
        ("T_MALL", "MALL", "ارزیابی مرکز خرید")
    ])

    business_types = [
        ("BT_01", "Fashion", "پوشاک", "Fashion", 1),
        ("BT_02", "Shoe_Bag", "کیف و کفش", "Shoe & Bag", 2),
        ("BT_03", "Watch_Jewelry", "ساعت و جواهر", "Watch & Jewelry", 3),
        ("BT_04", "FMCG", "کالاهای تندمصرف", "FMCG", 4),
        ("BT_05", "F_B", "غذا و نوشیدنی", "F&B", 5),
        ("BT_06", "Hardware", "ابزار و یراق", "Hardware", 6),
        ("BT_07", "Homeware", "لوازم خانگی", "Homeware", 7),
        ("BT_08", "Beauty_Cosmetics", "آرایشی و زیبایی", "Beauty/Cosmetics", 8),
        ("BT_09", "Electronics", "الکترونیک و دیجیتال", "Electronics", 9),
        ("BT_10", "Entertainment", "سرگرمی و اسباب‌بازی", "Entertainment", 10),
        ("BT_11", "Sports", "لوازم ورزشی", "Sports", 11),
        ("BT_12", "Specialty", "تخصصی و خاص", "Specialty", 12),
        ("BT_13", "Services", "خدمات و پشتیبانی", "Services", 13)
    ]
    cursor.executemany("INSERT INTO business_types VALUES (?,?,?,?,?,1)", business_types)

    mall_types = [
        ("MT_01", "SM", "مرکز خرید عمومی / پایه (SM)", 1),
        ("MT_02", "Neighborhood", "مرکز خرید محلی (Neighborhood)", 2),
        ("MT_03", "Community", "مرکز خرید منطقه‌ای (Community)", 3),
        ("MT_04", "Regional", "مرکز خرید منطقه‌ای بزرگ (Regional)", 4),
        ("MT_05", "Super_Regional", "ابر مرکز خرید فرامنطقه‌ای (Super Regional)", 5)
    ]
    cursor.executemany("INSERT INTO mall_types VALUES (?,?,?,?,1)", mall_types)

    location_contexts = [
        ("LC_01", "STREET_STORE", "فروشگاه خیابانی (Street Store)", "واحدهای مستقل مستقر در معابر و خیابان‌های شهری"),
        ("LC_02", "MALL_STORE", "فروشگاه داخل مال (Mall Store)", "واحدهای مستقر در راهروها یا طبقات مراکز تجاری"),
        ("LC_03", "FOOD_COURT", "واحد فودکورت (Food Court Unit)", "غرفه‌های مستقر در سالن غذاخوری مراکز خرید"),
        ("LC_04", "STANDALONE", "فروشگاه مستقل بزرگ (Standalone)", "مجموعه‌های مستقل بین‌شهری یا بزرگ مقیاس"),
        ("LC_05", "SHOP_IN_SHOP", "شاپ این شاپ (Shop-in-Shop)", "غرفه‌های مستقر درون فروشگاه‌های بزرگ"),
        ("LC_06", "KIOSK", "کیوسک (Kiosk)", "کیوسک‌های جزیره‌ای در معابر یا فضاهای باز")
    ]
    cursor.executemany("INSERT INTO location_contexts VALUES (?,?,?,?)", location_contexts)

    store_formats = [
        ("SF_01", "FLAGSHIP", "شعبه پرچمدار (Flagship)"),
        ("SF_02", "CHAIN", "شعبه زنجیره‌ای استاندارد (Chain)"),
        ("SF_03", "BOUTIQUE", "بوتیک و فروشگاه کوچک (Boutique)"),
        ("SF_04", "KIOSK", "کیوسک و غرفه (Kiosk)"),
        ("SF_05", "SHOP_IN_SHOP", "شاپ این شاپ (Shop-in-Shop)")
    ]
    cursor.executemany("INSERT INTO store_formats VALUES (?,?,?)", store_formats)

    # Journey Stages (STORE: 10 stages, MALL: 13 stages)
    journey_stages = [
        ("JS_S_01", "T_STORE", "BEFORE_ARRIVAL", "پیش از ورود و دسترسی", "Before Arrival & Access", 1),
        ("JS_S_02", "T_STORE", "APPROACH", "مواجهه، تابلو و نما", "Approach, Signage & Facade", 2),
        ("JS_S_03", "T_STORE", "ENTRY", "ورودی و آستانه درب", "Entry & Threshold", 3),
        ("JS_S_04", "T_STORE", "NAVIGATION", "گردش داخل، راهروها و قفسه‌ها", "Navigation & Circulation", 4),
        ("JS_S_05", "T_STORE", "EXPLORATION", "کاوش کالا، ویترین و چیدمان", "Product Exploration & Display", 5),
        ("JS_S_06", "T_STORE", "EVALUATION", "ارزیابی کالا و اتاق پرو", "Evaluation & Fitting", 6),
        ("JS_S_07", "T_STORE", "STAFF_INTERACTION", "تعامل با کارکنان و مشاوره", "Staff Interaction", 7),
        ("JS_S_08", "T_STORE", "PURCHASE", "صف، صندوق و پرداخت", "Queue & Checkout", 8),
        ("JS_S_09", "T_STORE", "EXIT", "بسته‌بندی و تحویل کالا", "Packaging & Handover", 9),
        ("JS_S_10", "T_STORE", "AFTER_SALES", "خروج و خدمات پس از فروش", "Exit & After Sales", 10),

        ("JS_M_01", "T_MALL", "ARRIVAL", "دسترسی و مجاورت شهری", "Urban Arrival & Access", 1),
        ("JS_M_02", "T_MALL", "PARKING", "پارکینگ خودروها", "Vehicle Parking", 2),
        ("JS_M_03", "T_MALL", "ENTRY", "ورودی و درگاه‌ها", "Entrances & Portals", 3),
        ("JS_M_04", "T_MALL", "WAYFINDING", "علائم و مسیریابی", "Signage & Wayfinding", 4),
        ("JS_M_05", "T_MALL", "VERTICAL_TRANSPORT", "پله‌برقی و آسانسورها", "Vertical Transportation", 5),
        ("JS_M_06", "T_MALL", "CIRCULATION", "راهروها و ویدها", "Corridors & Circulation", 6),
        ("JS_M_07", "T_MALL", "PUBLIC_SPACE", "فضاهای عمومی و استراحت", "Public Space & Rest Areas", 7),
        ("JS_M_08", "T_MALL", "FACILITIES", "سرویس‌های بهداشتی و رفاهی", "Restrooms & Welfare", 8),
        ("JS_M_09", "T_MALL", "FOOD_BEVERAGE", "فودکورت و رستوران‌ها", "Food Court & Dining", 9),
        ("JS_M_10", "T_MALL", "CUSTOMER_SERVICE", "اطلاعات، CRM و خدمات مشتریان", "Information & CRM", 10),
        ("JS_M_11", "T_MALL", "SAFETY", "ایمنی، حراست و فوریت‌ها", "Safety & Security", 11),
        ("JS_M_12", "T_MALL", "STAFF_OPERATIONS", "عملیات و کارکنان بهره‌برداری", "Operations & Staff", 12),
        ("JS_M_13", "T_MALL", "EXIT", "خروج و تخلیه", "Exit & Departure", 13)
    ]
    cursor.executemany("INSERT INTO journey_stages VALUES (?,?,?,?,?,?)", journey_stages)

    # Reporting Dimensions (Separate entity from groups)
    reporting_dimensions = [
        ("RD_S_01", "T_STORE", "ACCESS", "دسترسی و تابلو", "Access & Facade", 1),
        ("RD_S_02", "T_STORE", "NAVIGATION", "مسیریابی و فضای داخلی", "Store Navigation", 2),
        ("RD_S_03", "T_STORE", "ENVIRONMENT", "محیط فیزیکی و بهداشت", "Store Environment", 3),
        ("RD_S_04", "T_STORE", "PRODUCT", "نمایش و ارزیابی کالا", "Product Presentation", 4),
        ("RD_S_05", "T_STORE", "PEOPLE", "کارکنان و مشاوره فروش", "Staff & Service", 5),
        ("RD_S_06", "T_STORE", "CHECKOUT", "صندوق و سرعت پرداخت", "Checkout & Cashier", 6),
        ("RD_S_07", "T_STORE", "AFTER_SALES", "خدمات پس از فروش و مرجوعی", "After Sales", 7),

        ("RD_M_01", "T_MALL", "ARRIVAL_PARKING", "دسترسی و پارکینگ", "Arrival & Parking", 1),
        ("RD_M_02", "T_MALL", "WAYFINDING_SIGNAGE", "علائم و مسیریابی", "Wayfinding & Signage", 2),
        ("RD_M_03", "T_MALL", "FACILITIES_HYGIENE", "نظافت و سرویس‌های بهداشتی", "Hygiene & Amenities", 3),
        ("RD_M_04", "T_MALL", "VERTICAL_TRANSPORT", "پله‌برقی و آسانسور", "Vertical Circulation", 4),
        ("RD_M_05", "T_MALL", "CUSTOMER_SERVICE", "امور مشتریان و مستأجران", "Customer Service & Tenants", 5),
        ("RD_M_06", "T_MALL", "SAFETY_SECURITY", "امنیت و ایمنی", "Safety & Security", 6),
        ("RD_M_07", "T_MALL", "DINING_ENTERTAINMENT", "فودکورت و امکانات رفاهی", "Dining & Leisure", 7)
    ]
    cursor.executemany("INSERT INTO reporting_dimensions VALUES (?,?,?,?,?,?)", reporting_dimensions)

    # 2. SEED RULES ARCHITECTURE
    rules_data = [
        (
            "RULE_TEMPLATE_ISOLATION",
            "تفکیک قطعی دامنه ارزیابی فروشگاه از مرکز خرید",
            "EXCLUSION",
            "SYSTEM",
            "APPROVED",
            100,
            json.dumps({"match": "template_mismatch"}),
            "EXCLUDE",
            "شاخص‌های مرکز خرید هرگز به فروشگاه و بالعکس تخصیص نمی‌یابند.",
            "SYSTEM_ARCHITECT",
            "2026-09-22T00:00:00Z",
            "2026-09-22T00:00:00Z"
        ),
        (
            "RULE_STORE_BASE_EXCEL",
            "شمول پایه صنف بر اساس ماتریس اکسل",
            "APPLICABILITY",
            "IMPORTED",
            "APPROVED",
            25,
            json.dumps({"field": "applicableBusinessTypes", "operator": "contains", "value": "$profile.business_type"}),
            "INCLUDE",
            "تطبیق علامت X در ستون صنف فروشگاه در فایل مرجع FR Checklist- Fashion-Nima.xlsx",
            "EXCEL_INGESTION_PIPELINE",
            "2026-09-22T00:00:00Z",
            "2026-09-22T00:00:00Z"
        ),
        (
            "RULE_LOC_STREET_01",
            "حذف شاخص‌های مختص راهرو و کریدور مال در فروشگاه خیابانی",
            "EXCLUSION",
            "MANUAL",
            "APPROVED",
            50,
            json.dumps({"locationContext": "STREET_STORE", "keywords": ["راهروی مال", "کریدور مرکز خرید", "پله‌برقی مرکز خرید", "نقشه طبقات مال"]}),
            "EXCLUDE",
            "فروشگاه خیابانی فاقد راهرو، کریدور، پله‌برقی و نقشه طبقات مال است",
            "RETAIL_EXPERTS_COMMITTEE",
            "2026-09-22T00:00:00Z",
            "2026-09-22T00:00:00Z"
        ),
        (
            "RULE_LOC_MALL_FS08",
            "حذف شاخص دید از معبر خیابان (FS08) در فروشگاه داخل مال",
            "EXCLUSION",
            "MANUAL",
            "APPROVED",
            100, # Explicit Manual rule > location default
            json.dumps({"locationContext": "MALL_STORE", "codes": ["FS08"]}),
            "EXCLUDE",
            "تابلوی فروشگاه داخل مال در کریدور داخلی قرار دارد نه در فاصله ۱۵ تا ۲۰ متری معبر شهری",
            "RETAIL_EXPERTS_COMMITTEE",
            "2026-09-22T00:00:00Z",
            "2026-09-22T00:00:00Z"
        ),
        (
            "RULE_LOC_FC_01",
            "حذف شاخص‌های ریتیل سنتی در غرفه فودکورت",
            "EXCLUSION",
            "MANUAL",
            "APPROVED",
            50,
            json.dumps({"locationContext": "FOOD_COURT", "codes": ["FS08"], "subjectKeywords": ["اتاق پرو", "مانکن", "ویترین"]}),
            "EXCLUDE",
            "غرفه فودکورت فاقد اتاق پرو، مانکن، ویترین لباس و تابلوی معبر بیرونی است",
            "RETAIL_EXPERTS_COMMITTEE",
            "2026-09-22T00:00:00Z",
            "2026-09-22T00:00:00Z"
        ),
        (
            "RULE_DEP_NO_FITTING",
            "حذف وابستگی اتاق پرو در صورت فقدان اتاق پرو",
            "DEPENDENCY",
            "DERIVED",
            "APPROVED",
            75,
            json.dumps({"attribute": "has_fitting_room", "equals": False, "targetCodes": ["FFR02", "FFR03", "FFR04", "FFR05", "FFR06"]}),
            "EXCLUDE",
            "فروشگاه در مشخصات اعلام کرده که فاقد اتاق پرو است (FFR02 تا FFR06)",
            "DYNAMIC_PROFILE_BUILDER",
            "2026-09-22T00:00:00Z",
            "2026-09-22T00:00:00Z"
        ),
        (
            "RULE_DEP_NO_SHOWCASE",
            "حذف وابستگی ویترین شیشه‌ای در فروشگاه فاقد ویترین",
            "DEPENDENCY",
            "DERIVED",
            "APPROVED",
            75,
            json.dumps({"attribute": "has_window_display", "equals": False, "targetCodes": ["FW02", "FW03", "FW04", "FW05", "FW06"]}),
            "EXCLUDE",
            "فروشگاه اعلام کرده فاقد ویترین بیرونی است (FW02 تا FW06)",
            "DYNAMIC_PROFILE_BUILDER",
            "2026-09-22T00:00:00Z",
            "2026-09-22T00:00:00Z"
        ),
        (
            "RULE_DEP_NO_MANNEQUINS",
            "حذف وابستگی مانکن در فروشگاه فاقد مانکن",
            "DEPENDENCY",
            "DERIVED",
            "APPROVED",
            75,
            json.dumps({"attribute": "has_mannequins", "equals": False, "prefix": "FMA", "except": "FMA01"}),
            "EXCLUDE",
            "فروشگاه فاقد مانکن نمایشی است (کدهای FMA)",
            "DYNAMIC_PROFILE_BUILDER",
            "2026-09-22T00:00:00Z",
            "2026-09-22T00:00:00Z"
        ),
        (
            "RULE_DEP_NO_ELEVATOR",
            "حذف وابستگی آسانسور و پله در فروشگاه فاقد آسانسور و پله",
            "DEPENDENCY",
            "DERIVED",
            "APPROVED",
            75,
            json.dumps({"attribute": "has_elevator", "equals": False, "targetCodes": ["FAFE01", "FAFE02", "FAFE03", "FAFE04"]}),
            "EXCLUDE",
            "فروشگاه تک‌طبقه یا فاقد پله و آسانسور داخلی است (FAFE01 تا FAFE04)",
            "DYNAMIC_PROFILE_BUILDER",
            "2026-09-22T00:00:00Z",
            "2026-09-22T00:00:00Z"
        ),
        (
            "RULE_MALL_BASE_EXCEL",
            "شمول مقیاس مرکز خرید بر اساس ماتریس اکسل",
            "APPLICABILITY",
            "IMPORTED",
            "APPROVED",
            25,
            json.dumps({"field": "applicableMallTypes", "operator": "contains", "value": "$profile.mall_type"}),
            "INCLUDE",
            "تطبیق علامت X در ستون مقیاس مرکز خرید در فایل مرجع FR_Report_Mall V2Final Version.xlsx",
            "EXCEL_INGESTION_PIPELINE",
            "2026-09-22T00:00:00Z",
            "2026-09-22T00:00:00Z"
        ),
        (
            "RULE_MALL_SM_SCALE",
            "حذف تجهیزات مگامال در مرکز خرید پایه (SM)",
            "EXCLUSION",
            "MANUAL",
            "APPROVED",
            50,
            json.dumps({"mallType": "SM", "targetCodes": ["PR02", "PR14", "PR18", "AM03", "IS03", "CS03"]}),
            "EXCLUDE",
            "مرکز خرید پایه (SM) فاقد تجهیزات مگامال نظیر پارکینگ هوشمند پیشرفته و تفریحات منطقه‌ای است",
            "MALL_ASSESSMENT_COMMITTEE",
            "2026-09-22T00:00:00Z",
            "2026-09-22T00:00:00Z"
        ),
        # Test Draft Rule to prove Draft rules are ignored
        (
            "RULE_DRAFT_TEST_01",
            "قانون پیش‌نویس تایید نشده تستی",
            "EXCLUSION",
            "MANUAL",
            "DRAFT",
            90,
            json.dumps({"codes": ["FS01"]}),
            "EXCLUDE",
            "این قانون در وضعیت DRAFT است و نباید روی فرم پروداکشن اثر بگذارد",
            "TEST_SUITE",
            "2026-09-22T00:00:00Z",
            "2026-09-22T00:00:00Z"
        )
    ]
    cursor.executemany("""
    INSERT INTO rules (id, name, rule_type, rule_source, status, priority, conditions, effect, reason, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, rules_data)

    # 3. SEED STORE INDICATORS
    wb_s = openpyxl.load_workbook(STORE_EXCEL_PATH, data_only=True)
    ws_s = wb_s.active
    bt_cols_map = {
        4: "Fashion", 5: "Shoe_Bag", 6: "Watch_Jewelry", 7: "FMCG",
        8: "F_B", 9: "Hardware", 10: "Homeware", 11: "Beauty_Cosmetics",
        12: "Electronics", 13: "Entertainment", 14: "Sports",
        15: "Specialty", 16: "Services"
    }

    groups_map = {}
    subjects_map = {}

    for r_idx, row in enumerate(ws_s.iter_rows(min_row=2, values_only=True), start=2):
        if not any(row):
            continue
        raw_group, raw_code, raw_subj, raw_kpi = row[0], row[1], row[2], row[3]
        code = str(raw_code).strip()
        group_norm = normalize_text(raw_group) or "عمومی"
        subj_norm = normalize_text(raw_subj) or "سایر موارد"
        original_kpi = str(raw_kpi or '').strip()
        normalized_kpi = normalize_text(raw_kpi)

        if group_norm not in groups_map:
            g_id = f"GRP_S_{len(groups_map) + 1}"
            groups_map[group_norm] = g_id
            cursor.execute("INSERT INTO indicator_groups VALUES (?,?,?,?,?)",
                           (g_id, "T_STORE", g_id, group_norm, len(groups_map)))
        g_id = groups_map[group_norm]

        subj_key = (g_id, subj_norm)
        if subj_key not in subjects_map:
            sub_id = f"SUB_S_{len(subjects_map) + 1}"
            subjects_map[subj_key] = sub_id
            cursor.execute("INSERT INTO subjects VALUES (?,?,?,?,?)",
                           (sub_id, g_id, sub_id, str(raw_subj or ''), subj_norm))
        sub_id = subjects_map[subj_key]

        # Determine Journey Stage ID
        if any(w in subj_norm for w in ["تابلو", "پنجره", "نما", "بیرونی", "معبر"]):
            js_id = "JS_S_02" # APPROACH
            rd_id = "RD_S_01" # ACCESS
        elif any(w in subj_norm for w in ["ورودی", "خروجی", "درب", "گیت"]):
            js_id = "JS_S_03" # ENTRY
            rd_id = "RD_S_01" # ACCESS
        elif any(w in subj_norm for w in ["سقف", "کف", "دیوار", "راهرو", "پله", "آسانسور"]):
            js_id = "JS_S_04" # NAVIGATION
            rd_id = "RD_S_02" # NAVIGATION
        elif any(w in subj_norm for w in ["ویترین", "مانکن", "نمایش کالا", "نور"]):
            js_id = "JS_S_05" # EXPLORATION
            rd_id = "RD_S_04" # PRODUCT
        elif any(w in subj_norm for w in ["پرو", "آینه", "محصول", "سایز", "دوخت", "منو"]):
            js_id = "JS_S_06" # EVALUATION
            rd_id = "RD_S_04" # PRODUCT
        elif any(w in subj_norm for w in ["پرسنل", "کارکنان", "رفتار", "دانش"]):
            js_id = "JS_S_07" # STAFF_INTERACTION
            rd_id = "RD_S_05" # PEOPLE
        elif any(w in subj_norm for w in ["صندوق", "صف", "پرداخت", "فاکتور", "مالیات"]):
            js_id = "JS_S_08" # PURCHASE
            rd_id = "RD_S_06" # CHECKOUT
        elif any(w in subj_norm for w in ["بسته", "تگ"]):
            js_id = "JS_S_09" # EXIT
            rd_id = "RD_S_06" # CHECKOUT
        elif any(w in subj_norm for w in ["مرجوع", "تعویض", "شکایت", "خدمات"]):
            js_id = "JS_S_10" # AFTER_SALES
            rd_id = "RD_S_07" # AFTER_SALES
        else:
            js_id = "JS_S_04"
            rd_id = "RD_S_03"

        ind_id = f"IND_S_{r_idx:04d}"
        weight = 1.5 if any(w in normalized_kpi for w in ["ایمنی", "آتش", "برق", "شکستگی", "سرقت"]) else 1.0
        req_photo = 1 if any(w in subj_norm for w in ["تابلو", "ویترین", "کف", "دیوار", "مانکن", "اتاق پرو"]) else 0

        cursor.execute("""
        INSERT INTO indicators (
            id, code, assessment_type, group_id, subject_id, journey_stage_id, reporting_dimension_id,
            original_text, normalized_text, description, status, version, weight,
            requires_photo, requires_comment, display_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 1, ?, ?, ?, ?, ?, ?)
        """, (
            ind_id, code, "STORE", g_id, sub_id, js_id, rd_id,
            original_kpi, normalized_kpi, f"شاخص ارزیابی عملیاتی {code}", weight,
            req_photo, 1, r_idx, "2026-09-22T00:00:00Z", "2026-09-22T00:00:00Z"
        ))

        for col_idx, bt_code in bt_cols_map.items():
            val = str(row[col_idx] or '').strip().upper()
            if val == "X":
                cursor.execute("INSERT INTO indicator_applicabilities (indicator_id, business_type_code, is_applicable) VALUES (?,?,?)",
                               (ind_id, bt_code, 1))

    # 4. SEED MALL INDICATORS
    wb_m = openpyxl.load_workbook(MALL_EXCEL_PATH, data_only=True)
    ws_m = wb_m.active
    mall_types_cols_map = {
        4: "SM", 5: "Neighborhood", 6: "Community", 7: "Regional", 8: "Super_Regional"
    }

    for r_idx, row in enumerate(ws_m.iter_rows(min_row=2, values_only=True), start=2):
        if not any(row):
            continue
        raw_group, raw_code, raw_subj, raw_kpi = row[0], row[1], row[2], row[3]
        code = str(raw_code).strip()
        group_norm = normalize_text(raw_group) or "امکانات عمومی مال"
        subj_norm = normalize_text(raw_subj) or "سایر بخش‌ها"
        original_kpi = str(raw_kpi or '').strip()
        normalized_kpi = normalize_text(raw_kpi)

        if group_norm not in groups_map:
            g_id = f"GRP_M_{len(groups_map) + 1}"
            groups_map[group_norm] = g_id
            cursor.execute("INSERT INTO indicator_groups VALUES (?,?,?,?,?)",
                           (g_id, "T_MALL", g_id, group_norm, len(groups_map)))
        g_id = groups_map[group_norm]

        subj_key = (g_id, subj_norm)
        if subj_key not in subjects_map:
            sub_id = f"SUB_M_{len(subjects_map) + 1}"
            subjects_map[subj_key] = sub_id
            cursor.execute("INSERT INTO subjects VALUES (?,?,?,?,?)",
                           (sub_id, g_id, sub_id, str(raw_subj or ''), subj_norm))
        sub_id = subjects_map[subj_key]

        # Determine Mall Journey Stage ID
        if any(w in subj_norm for w in ["دسترسی", "مسیریابی", "تاکسی"]):
            js_id = "JS_M_01" # ARRIVAL
            rd_id = "RD_M_01" # ARRIVAL_PARKING
        elif "پارکینگ" in subj_norm:
            js_id = "JS_M_02" # PARKING
            rd_id = "RD_M_01" # ARRIVAL_PARKING
        elif "ورودی" in subj_norm:
            js_id = "JS_M_03" # ENTRY
            rd_id = "RD_M_02" # WAYFINDING_SIGNAGE
        elif any(w in subj_norm for w in ["علائم", "نقشه", "راهنما"]):
            js_id = "JS_M_04" # WAYFINDING
            rd_id = "RD_M_02" # WAYFINDING_SIGNAGE
        elif any(w in subj_norm for w in ["پله", "آسانسور"]):
            js_id = "JS_M_05" # VERTICAL_TRANSPORT
            rd_id = "RD_M_04" # VERTICAL_TRANSPORT
        elif any(w in subj_norm for w in ["سرویس بهداشتی", "مادر و کودک", "رفاهی"]):
            js_id = "JS_M_08" # FACILITIES
            rd_id = "RD_M_03" # FACILITIES_HYGIENE
        elif any(w in subj_norm for w in ["فودکورت", "رستوران"]):
            js_id = "JS_M_09" # FOOD_BEVERAGE
            rd_id = "RD_M_07" # DINING_ENTERTAINMENT
        elif any(w in subj_norm for w in ["کانتر", "اطلاعات", "شکایات", "مستأجر"]):
            js_id = "JS_M_10" # CUSTOMER_SERVICE
            rd_id = "RD_M_05" # CUSTOMER_SERVICE
        elif any(w in subj_norm for w in ["حراست", "انتظامات", "ایمنی"]):
            js_id = "JS_M_11" # SAFETY
            rd_id = "RD_M_06" # SAFETY_SECURITY
        else:
            js_id = "JS_M_06" # CIRCULATION
            rd_id = "RD_M_02"

        ind_id = f"IND_M_{r_idx:04d}"
        weight = 1.5 if "پارکینگ" in subj_norm or "ایمنی" in subj_norm else 1.0
        req_photo = 1 if any(w in subj_norm for w in ["پارکینگ", "ورودی", "سرویس بهداشتی", "پله"]) else 0

        cursor.execute("""
        INSERT INTO indicators (
            id, code, assessment_type, group_id, subject_id, journey_stage_id, reporting_dimension_id,
            original_text, normalized_text, description, status, version, weight,
            requires_photo, requires_comment, display_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 1, ?, ?, ?, ?, ?, ?)
        """, (
            ind_id, code, "MALL", g_id, sub_id, js_id, rd_id,
            original_kpi, normalized_kpi, f"شاخص ارزیابی مرکز خرید {code}", weight,
            req_photo, 1, r_idx, "2026-09-22T00:00:00Z", "2026-09-22T00:00:00Z"
        ))

        for col_idx, mt_code in mall_types_cols_map.items():
            val = str(row[col_idx] or '').strip().upper()
            if val == "X":
                cursor.execute("INSERT INTO indicator_applicabilities (indicator_id, mall_type_code, is_applicable) VALUES (?,?,?)",
                               (ind_id, mt_code, 1))

    # 5. SEED USERS
    cursor.executemany("INSERT INTO users VALUES (?,?,?,?,?)", [
        ("USR_01", "auditor_nima", "نیما رضوانی (ارزیاب ارشد)", "AUDITOR", "2026-09-22T00:00:00Z"),
        ("USR_02", "sup_sara", "سارا احمدی (سرپرست بازرسی)", "SUPERVISOR", "2026-09-22T00:00:00Z"),
        ("USR_03", "admin_sys", "مدیر سیستم ارزیابی", "ADMIN", "2026-09-22T00:00:00Z")
    ])

    conn.commit()

    # 6. EXPORT CLEAN CATALOG JSON
    cursor.execute("""
    SELECT i.id, i.code, i.assessment_type, g.name_fa as group_name, s.normalized_name as subject_name,
           js.code as journey_stage, rd.code as reporting_dim, i.original_text, i.normalized_text,
           i.status, i.version, i.weight, i.requires_photo, i.requires_comment, i.display_order
    FROM indicators i
    JOIN indicator_groups g ON i.group_id = g.id
    JOIN subjects s ON i.subject_id = s.id
    JOIN journey_stages js ON i.journey_stage_id = js.id
    JOIN reporting_dimensions rd ON i.reporting_dimension_id = rd.id
    ORDER BY i.display_order ASC
    """)
    indicators_rows = cursor.fetchall()

    catalog = {
        "assessment_templates": [{"code": "STORE", "name": "ارزیابی فروشگاه"}, {"code": "MALL", "name": "ارزیابی مرکز خرید"}],
        "business_types": [{"code": b[1], "name": b[2], "name_en": b[3]} for b in business_types],
        "mall_types": [{"code": m[1], "name": m[2]} for m in mall_types],
        "location_contexts": [{"code": l[1], "name": l[2], "description": l[3]} for l in location_contexts],
        "store_formats": [{"code": f[1], "name": f[2]} for f in store_formats],
        "journey_stages": [{"code": j[2], "name": j[3], "name_en": j[4]} for j in journey_stages],
        "reporting_dimensions": [{"code": r[2], "name": r[3], "name_en": r[4]} for r in reporting_dimensions],
        "rules": [
            {
                "id": r[0], "name": r[1], "rule_type": r[2], "rule_source": r[3],
                "status": r[4], "priority": r[5], "conditions": json.loads(r[6]),
                "effect": r[7], "reason": r[8], "created_by": r[9], "created_at": r[10]
            }
            for r in rules_data
        ],
        "indicators": []
    }

    for row in indicators_rows:
        ind_id = row[0]
        cursor.execute("SELECT business_type_code, mall_type_code FROM indicator_applicabilities WHERE indicator_id = ?", (ind_id,))
        apps = cursor.fetchall()
        bts = [a[0] for a in apps if a[0]]
        mts = [a[1] for a in apps if a[1]]

        catalog["indicators"].append({
            "id": ind_id,
            "code": row[1],
            "template": row[2],
            "group": row[3],
            "subject": row[4],
            "journeyStage": row[5],
            "reportingDimension": row[6],
            "originalText": row[7],
            "statement": row[8],
            "status": row[9],
            "version": row[10],
            "weight": row[11],
            "requiresPhoto": bool(row[12]),
            "requiresComment": bool(row[13]),
            "displayOrder": row[14],
            "applicableBusinessTypes": bts,
            "applicableMallTypes": mts
        })

    with open(CATALOG_PATH, "w", encoding="utf-8") as f:
        json.dump(catalog, f, ensure_ascii=False, indent=2)

    os.makedirs(os.path.dirname(SRC_CATALOG_PATH), exist_ok=True)
    with open(SRC_CATALOG_PATH, "w", encoding="utf-8") as f:
        json.dump(catalog, f, ensure_ascii=False, indent=2)

    print(f"Migration V2 Complete. Seeded {len(catalog['indicators'])} indicators and {len(catalog['rules'])} rules.")
    conn.close()

if __name__ == "__main__":
    run_migration()
