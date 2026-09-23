# سند ممیزی و راهنمای سیستم طراحی Retail Solutions
## Retail Solutions Brand & Design System Audit for RSAPP

**مرجع رسمی و حقیقت بصری (Source of Truth):**  
[https://retail-sloution.vercel.app/](https://retail-sloution.vercel.app/)

**تاریخ استخراج و ممیزی:** سپتامبر ۲۰۲۶  
**محیط مبدا:** وب‌سایت اصلی Retail Solutions (Next.js Framework)

---

## ۱. معماری و سلسله‌مراتب هویت بصری (Product-Brand Relationship)

سامانه RSAPP نباید به‌صورت یک محصول استارتاپی مستقل، داشبورد متفرقه یا نرم‌افزار بیگانه با ریتیل سلوشنز به نظر برسد؛ بلکه نرم‌افزار رسمی و سازمانی برای عملیاتی‌سازی متدولوژی **FR™** تحت نظارت برند مادر است:

```
┌─────────────────────────────────────────────────────────────┐
│                       RETAIL SOLUTIONS                      │
│            برند مادر سازمانی (Master Consulting Brand)        │
│       «ساختن سازمان‌های ماندگار در صنعت ریتیل»              │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                             FR™                             │
│     متدولوژی اختصاصی: کاهش اصطکاک و طراحی پاداش خرید       │
│               (Friction & Reward Methodology)               │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 RSAPP Assessment Platform                   │
│   سامانه نرم‌افزاری ارزیابی میدانی، گزارش‌گیری و بهبود مستمر │
│          (Digital Operational Audit & Action Tool)          │
└─────────────────────────────────────────────────────────────┘
```

---

## ۲. دارایی‌های رسمی لوگو (Extracted Brand Assets)

لوگوی رسمی Retail Solutions به صورت مستقیم از سورس HTML و SVG مرجع استخراج شده و شامل دو نگارش رسمی با مختصات وکتور یکسان است:

### ۲.۱. ساختار هندسی نماد (Symbol Geometry)
- **ViewBox:** `90 160 855 700`
- **نشان هندسی (Bracket Portal):** سه مسیر با ضخامت `30px` و انتهای صاف (`stroke-linecap="butt"`)
  - خط اصلی باز شو: `M635 190 H115 V830 H635`
  - لبه بالایی: `M635 190 V320`
  - لبه پایینی: `M635 830 V700`
- **تایپوگرافی لوگو (Wordmark):**
  - کلمه `RETAIL`: با حروف تمام بزرگ، فونت ژئومتریک، اندازه `132px`، وزن `400`
  - کلمه `Solutions`: با حروف کوچک/بزرگ، اندازه `136px`، وزن `300` با رنگ فیروزه‌ای شاخص برند (`#00B0F0`)

### ۲.۲. نگارش لایت (برای پس‌زمینه‌های روشن):
```svg
<svg viewBox="90 160 855 700" class="rs-logo rs-logo-light" role="img" aria-label="Retail Solutions" style="direction:ltr">
  <g fill="none" stroke="#16213E" stroke-width="30" stroke-linecap="butt">
    <path d="M635 190 H115 V830 H635"></path>
    <path d="M635 190 V320"></path>
    <path d="M635 830 V700"></path>
  </g>
  <text x="315" y="497" fill="#5C6478" font-size="132" font-weight="400" textLength="595" lengthAdjust="spacing" style="font-family:var(--font-latin), 'Inter', Arial, sans-serif">RETAIL</text>
  <text x="318" y="632" fill="#00B0F0" font-size="136" font-weight="300" textLength="592" lengthAdjust="spacing" style="font-family:var(--font-latin), 'Inter', Arial, sans-serif">Solutions</text>
</svg>
```

### ۲.۳. نگارش دارک (برای هدر سرمه‌ای و پس‌زمینه‌های تاریک):
```svg
<svg viewBox="90 160 855 700" class="rs-logo rs-logo-dark" role="img" aria-label="Retail Solutions" style="direction:ltr">
  <g fill="none" stroke="#FFFFFF" stroke-width="30" stroke-linecap="butt">
    <path d="M635 190 H115 V830 H635"></path>
    <path d="M635 190 V320"></path>
    <path d="M635 830 V700"></path>
  </g>
  <text x="315" y="497" fill="#BFC6D8" font-size="132" font-weight="400" textLength="595" lengthAdjust="spacing" style="font-family:var(--font-latin), 'Inter', Arial, sans-serif">RETAIL</text>
  <text x="318" y="632" fill="#00B0F0" font-size="136" font-weight="300" textLength="592" lengthAdjust="spacing" style="font-family:var(--font-latin), 'Inter', Arial, sans-serif">Solutions</text>
</svg>
```

### ۲.۴. نشان تک/آیکون (Standalone Brandmark / Favicon):
برای استفاده در هدرهای موبایل، فاوآیکون و سایدبار جمع‌شده:
```svg
<svg viewBox="90 160 560 700" class="rs-symbol" role="img" aria-label="Retail Solutions Mark">
  <g fill="none" stroke="currentColor" stroke-width="30" stroke-linecap="butt">
    <path d="M635 190 H115 V830 H635"></path>
    <path d="M635 190 V320"></path>
    <path d="M635 830 V700"></path>
  </g>
</svg>
```

---

## ۳. پالت رنگ رسمی (Official Extracted Color Palette)

تمامی رنگ‌ها مستقیماً از بخش `:root` و کلاس‌های Tailwind استخراج شده‌اند:

| نام توکن اصلی | کد هگز | مقدار RGB | کاربرد و فلسفه طراحی |
| :--- | :--- | :--- | :--- |
| `--rs-color-brand-navy` | `#16213e` | `rgb(22, 33, 62)` | رنگ اصلی برند مادر؛ سرمه‌ای عمیق، وقار، اقتدار سازمانی، هدر و متون تیره |
| `--rs-color-brand-cyan` | `#00b0f0` | `rgb(0, 176, 240)` | رنگ فیروزه‌ای نماد «Solutions»، ایجاد تمایز بصری، آکسان برند |
| `--rs-color-action-primary` | `#007daa` | `rgb(0, 125, 170)` | رنگ تعاملی اصلی (Primary CTA)، دکمه‌ها و پیوندهای عملکردی |
| `--rs-color-action-hover` | `#00668c` | `rgb(0, 102, 140)` | هاور دکمه‌ها و المان‌های تعاملی |
| `--rs-color-surface-page` | `#ffffff` | `rgb(255, 255, 255)` | پس‌زمینه صفحات و کارت‌های اصلی در حالت روشن |
| `--rs-color-surface-subtle` | `#f1f2f5` | `rgb(241, 242, 245)` | پس‌زمینه لطیف سکشن‌ها، المان‌های غیرفعال و هاورهای خنثی |
| `--rs-color-navy-50` | `#f2f4f8` | `rgb(242, 244, 248)` | پس‌زمینه سرستون‌های جداول، باکس‌های فرعی |
| `--rs-color-navy-700` | `#1d2a49` | `rgb(29, 42, 73)` | بردرهای تم تاریک، گرید فریم رسانه‌ای، پنل‌های سایدبار |
| `--rs-color-navy-900` | `#0f172c` | `rgb(15, 23, 44)` | عمیق‌ترین رنگ سرمه‌ای برای هدر و پنل‌های سطح بالا |
| `--rs-color-border-line` | `#e2e5ec` | `rgb(226, 229, 236)` | رنگ استاندارد خطوط جداکننده و بردر کارت‌ها در حالت روشن |
| `--rs-color-border-strong` | `#c9ceda` | `rgb(201, 206, 218)` | بردر پررنگ اینپوت‌های فعال و کادرهای فوکوس |
| `--rs-color-text-ink` | `#16213e` | `rgb(22, 33, 62)` | متن اصلی (تیترها، عناوین جداول، مقادیر عددی) |
| `--rs-color-text-muted` | `#4c5878` | `rgb(76, 88, 120)` | متن فرعی و توضیحات در حالت روشن |
| `--rs-color-text-faint` | `#646e8c` | `rgb(100, 110, 140)` | متن کم‌رنگ، برچسب‌های کم‌اهمیت و پلیس‌هولدرها |
| `--rs-color-text-dark-100`| `#dfe3ec` | `rgb(223, 227, 236)` | متن روشن روی پس‌زمینه سرمه‌ای هدر |
| `--rs-color-text-dark-200`| `#bfc6d8` | `rgb(191, 198, 216)` | متن فرعی روی پس‌زمینه سرمه‌ای هدر |
| `--rs-color-success` | `#2d9d78` | `rgb(45, 157, 120)` | رنگ وضعیت «مناسب» / موفقیت / عملکرد سالم |
| `--rs-color-warning` | `#f2b544` | `rgb(242, 181, 68)` | رنگ هشدار / نیازمند اصلاح / اصطکاک متوسط |
| `--rs-color-error` | `#d94a56` | `rgb(217, 74, 86)` | رنگ اصطکاک / خطا / خط قرمز بحرانی |
| `--rs-color-callout-info` | `#d9f5ff` | `rgb(217, 245, 255)` | پس‌زمینه کال‌اوت‌های اطلاعاتی و انتخاب متن |
| `--rs-color-callout-success`| `#e8f7f1` | `rgb(232, 247, 241)` | پس‌زمینه کال‌اوت‌های موفقیت‌آمیز |
| `--rs-color-callout-warn` | `#fff5de` | `rgb(255, 245, 222)` | پس‌زمینه کال‌اوت‌های هشدار |
| `--rs-color-callout-crit` | `#fdecef` | `rgb(253, 236, 239)` | پس‌زمینه کال‌اوت‌های اصطکاک و خطا |

---

## ۴. مقیاس تایپوگرافی (Typography Scale)

- **قلم فارسی:** `Vazirmatn` (متغیر با اوزان ۳۰۰، ۴۰۰، ۵۰۰، ۶۰۰، ۷۰۰، ۸۰۰)
- **قلم لاتین و اعداد:** `Inter` (برای کدهای شاخص مانند `FS01`، درصدها مانند `83%` و متون لاتین)
- **مقیاس بر اساس فونت وب‌سایت:**
  - `text-display`: `clamp(2rem, 1.3rem + 2.9vw, 3.25rem)` / line-height: `1.35`
  - `text-h1`: `clamp(1.7rem, 1.35rem + 1.7vw, 2.4rem)` / line-height: `1.4` (وزن ۷۰۰)
  - `text-h2`: `clamp(1.45rem, 1.2rem + 1vw, 1.95rem)` / line-height: `1.45` (وزن ۷۰۰)
  - `text-h3`: `clamp(1.15rem, 1.08rem + 0.3vw, 1.3rem)` / line-height: `1.6` (وزن ۶۰۰)
  - `text-body`: `clamp(1rem, 0.9rem + 0.5vw, 1.125rem)` / line-height: `1.8` (وزن ۴۰۰)
  - `text-label`: `0.9375rem` / `15px` / line-height: `1.7` (وزن ۵۰۰ یا ۶۰۰)
  - `text-small`: `0.8125rem` / `13px` / line-height: `1.5`
  - `text-caption`: `0.75rem` / `12px` / line-height: `1rem`

---

## ۵. سیستم گوشه‌های گرد (Radius System)

از مقادیر هاردکد شده یا لبه‌های بیش از حد گرد (اسباب‌بازی‌گونه) خودداری شده و از توکن‌های رسمی سایت استفاده می‌شود:
- `--rs-radius-control`: `8px` — ورودی‌ها، چک‌باکس‌ها، دکمه‌های آیکونی، چیپ‌های فیلتر
- `--rs-radius-button`: `12px` — دکمه‌های اصلی و ثانویه، اقلام انتخابی فرم
- `--rs-radius-card`: `16px` — کارت‌های ارزیابی، مدال‌ها، پنل‌ها، باتم‌شیت‌ها
- `--rs-radius-feature`: `24px` — فریم‌های بزرگ و بنرهای خلاصه مدیریتی
- `--rs-radius-full`: `999px` — بج‌های وضعیت، نشان‌گرهای عددی و کپسول‌های پیشرفت

---

## ۶. ریتم فواصل (Spacing Rhythm)

- `--rs-space-1`: `4px`
- `--rs-space-2`: `8px`
- `--rs-space-3`: `12px`
- `--rs-space-4`: `16px`
- `--rs-space-6`: `24px`
- `--rs-space-8`: `32px`
- `--rs-space-12`: `48px`
- `--rs-space-16`: `64px`

---

## ۷. سیستم سایه و تفکیک سطوح (Elevation & Shadows)

وب‌سایت مرجع بر تفکیک تمیز، حاشیه‌های نرم ۱ پیکسلی و سایه‌های بسیار خفیف متکی است:
- `shadow-card`: `0 4px 16px rgba(22, 33, 62, 0.08)`
- `shadow-popover`: `0 12px 32px rgba(22, 33, 62, 0.14)`
- `shadow-modal`: `0 24px 64px rgba(22, 33, 62, 0.20)`

---

## ۸. موتیف‌های بصری قابل استفاده مجدد (Visual Motifs)

۱. **نوار هدر سرمه‌ای (`bg-navy` با ارتفاع و فونت تمیز):** احساس ورود به یک فضای سازمانی معتبر و مشاوره استراتژیک.  
۲. **الگوی شطرنجی مدیافریم (`media-frame`):** پس‌زمینه با گرید خطی `32px 32px` با رنگ سرمه‌ای و خطوط `#1d2a49` برای فضاهای نموداری و رادار چارت.  
۳. **کال‌اوت‌های ۴ رنگی لطیف:** برای پیام‌های راهنما، اصطکاک‌ها و الزامات ارزیابی با پس‌زمینه‌های پاستلی دقیق سایت (`bg-callout-*`).  
۴. **دکمه‌های با دیسپچ استاندارد:** انیمیشن‌های نرم با ترانزیشن `cubic-bezier(0.22, 1, 0.36, 1)` و زمان `180ms`.

---

## ۹. جمع‌بندی تطبیق با مأموریت RSAPP

با اعمال این سیستم طراحی:
- نرم‌افزار ارزیابی مستقیماً با هویت شرکت **Retail Solutions** و راهکار **FR™** پیوند می‌خورد.
- حس گلاس‌مورفیسم یا استارتاپ تفننی حذف شده و با یک ابزار حرفه‌ای، داده‌محور، متین و سازمانی جایگزین می‌شود.
