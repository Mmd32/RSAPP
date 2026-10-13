# -*- coding: utf-8 -*-
"""
Aligns the store checklist with the FR model workbook (Nima - FR, pivot
"Indicatores": 5 zones, 43 topics, 191 KPIs).

1. Archives the 162 synthetic F_EXT_* store indicators (and the 163
   M_EXT_* mall indicators made the same way). They were added by
   scripts/generate_reference_data.py only to pad the catalog to 255 rows:
   one template sentence per topic, repeated, with zones assigned in
   rotation. They are kept (status ARCHIVED) so old visits still resolve.
2. Renames the real indicators' topics to the workbook's topic names and
   moves them to the workbook's zone where it differs.

Idempotent. Updates data/catalog.json and src/data/catalog.json.
Run: python3 scripts/align_catalog_with_fr_model.py
"""
import json
import os
import re
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILES = [os.path.join(ROOT, f) for f in ("data/catalog.json", "src/data/catalog.json")]

# Current topic -> (zone, topic name in the FR workbook).
TOPIC_MAP = {
    # محوطه فروشگاه
    'تابلوی سر در': ('FLOOR', 'تابلوی سر در'),
    'پنجره شیشه ای': ('FLOOR', 'پنجره شیشه‌ای'),
    'پله و آسانسور': ('FLOOR', 'پله و آسانسور'),
    'ویترین': ('FLOOR', 'ویترین'),
    'سقف': ('FLOOR', 'سقف/کف/دیوار'),
    'کف': ('FLOOR', 'سقف/کف/دیوار'),
    'دیوار': ('FLOOR', 'سقف/کف/دیوار'),
    'تجهیزات نمایش کالا': ('FLOOR', 'تجهیزات نمایش کالا'),
    'قفسه ها': ('FLOOR', 'تجهیزات نمایش کالا'),
    'مانکن ها': ('FLOOR', 'تجهیزات نمایش کالا'),
    'اتاق پرو': ('FLOOR', 'اتاق پرو'),
    'آینه های داخل فروشگاه': ('FLOOR', 'تجهیزات (و ملزومات) مورد نیاز فروشگاه'),
    'تجهیزات مورد نیاز فروشگاه': ('FLOOR', 'تجهیزات (و ملزومات) مورد نیاز فروشگاه'),
    'نورپردازی کلی فروشگاه': ('FLOOR', 'نورپردازی کلی فروشگاه'),
    'نظافت کلی فروشگاه': ('FLOOR', 'نظافت کلی فروشگاه'),
    'امکانات رفاهی': ('FLOOR', 'امکانات رفاهی'),
    'چیدمان کالا': ('FLOOR', 'چیدمان کالا'),
    # کیفیت سرویس
    'تعویض و مرجوعی کالا': ('SERVICES', 'تعویض و مرجوعی کالا'),
    'خدمات پس از فروش': ('SERVICES', 'خدمات پس از فروش'),
    'فرآیند پاسخگویی به اعتراضات': ('SERVICES', 'فرآیند پاسخگویی به اعتراضات مشتری'),
    'بسته بندی کالا': ('SERVICES', 'بسته‌بندی کالا'),
    'منو (F&B)': ('SERVICES', 'منو'),
    # تیم فروشگاه
    'در دسترس بودن کارکنان': ('TEAM', 'در دسترس بودن'),
    'آراستگی ظاهری پرسنل': ('TEAM', 'آراستگی ظاهری پرسنل'),
    'رفتار پرسنل': ('TEAM', 'رفتار پرسنل'),
    'نحوه تعامل با مشتری': ('TEAM', 'نحوه تعامل با مشتری'),
    'دانش محصول': ('TEAM', 'میزان دانش محصول (شامل نگهداری اولیه)'),
    'نحوه عملکرد در زمان های شلوغ': ('TEAM', 'سرعت عمل پرسنل در عملیات فروشگاهی'),
    # محصول
    'سایزبندی': ('PRODUCT', 'سایزبندی'),
    'نوع دوخت و کیفیت': ('PRODUCT', 'کیفیت و قیمت'),
    'اطلاعات کلیدی محصول': ('PRODUCT', 'اطلاعات کلیدی محصول'),
    'موجودی محصولات': ('PRODUCT', 'موجودی محصولات'),
    'تنوع محصول': ('PRODUCT', 'تنوع در محصولات (Must Stock List)'),
    # صندوق
    'صف صندوق': ('CASH', 'صف صندوق'),
    'تعداد صندوق ها': ('CASH', 'تعداد صندوق‌ها نسبت به مساحت فروشگاه و تعداد مشتریان'),
    'رفتار صندوقدار': ('CASH', 'صندوقدار'),
    'سرعت عمل صندوقدار': ('CASH', 'سرعت عمل صندوقدار'),
    'فضای بسته بندی خرید': ('CASH', 'فضای بسته‌بندی خرید'),
    'ثبت اطلاعات مشتری': ('CASH', 'خرید و پرداخت'),
    'فاکتور': ('CASH', 'خرید و پرداخت'),
    'جداکننده تگ و پیجر': ('CASH', 'خرید و پرداخت'),
}

# Per-indicator overrides where one old topic splits in the workbook.
CODE_MAP = {
    'FE01': ('FLOOR', 'ورودی فروشگاه'),
    'FE02': ('FLOOR', 'ورودی فروشگاه'),
    'FE04': ('FLOOR', 'ورودی فروشگاه'),
    'FE03': ('FLOOR', 'خروجی فروشگاه'),  # anti-theft gate
}

TARGET_TOPICS = {t for _, t in list(TOPIC_MAP.values()) + list(CODE_MAP.values())}


def is_synthetic(ind):
    return bool(re.match(r"^[FM]_EXT_", ind.get("code", "")))


for path in FILES:
    with open(path, encoding="utf-8") as fh:
        catalog = json.load(fh)
    archived = moved = 0
    unmapped = set()
    for ind in catalog["indicators"]:
        if is_synthetic(ind):
            if ind.get("status") != "ARCHIVED":
                archived += 1
            ind["status"] = "ARCHIVED"
            continue
        if ind.get("template") != "STORE":
            continue
        target = CODE_MAP.get(ind["code"]) or TOPIC_MAP.get(ind["subject"])
        if not target:
            if ind["subject"] not in TARGET_TOPICS:
                unmapped.add(ind["subject"])
            continue
        group, subject = target
        if ind["group"] != group or ind["subject"] != subject:
            moved += 1
        ind["group"], ind["subject"] = group, subject
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(json.dumps(catalog, ensure_ascii=False, indent=2))

    active = [i for i in catalog["indicators"] if i.get("template") == "STORE" and i.get("status") != "ARCHIVED"]
    by_zone = Counter(i["group"] for i in active)
    mall = sum(1 for i in catalog["indicators"] if i.get("template") == "MALL" and i.get("status") != "ARCHIVED")
    print(os.path.relpath(path, ROOT), dict(archived=archived, moved=moved, active=len(active), by_zone=dict(by_zone), mall_active=mall))
    if unmapped:
        print("  unmapped topics:", sorted(unmapped))
