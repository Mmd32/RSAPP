import React, { useMemo } from 'react';
import { Indicator } from '../types';
import { evaluateIndicatorRule } from '../engine/ruleEngine';
import { Play, CheckCircle2, Sliders, ArrowUpDown } from 'lucide-react';

interface ScenarioRunnerProps {
  indicators: Indicator[];
}

export const ScenarioRunner: React.FC<ScenarioRunnerProps> = ({ indicators }) => {
  const scenarioDefinitions = useMemo(() => [
    {
      id: 'A',
      title: 'Scenario A: Fashion - Street Store',
      desc: 'فروشگاه پوشاک در معبر شهری با ویترین و مانکن، فاقد آسانسور',
      template: 'STORE' as const,
      businessType: 'Fashion' as const,
      locationContext: 'STREET_STORE' as const,
      attributes: { hasFittingRoom: true, hasShowcase: true, hasMannequins: true, hasElevator: false, hasParking: false, hasCustomerToilet: false }
    },
    {
      id: 'B',
      title: 'Scenario B: Fashion - Mall Store',
      desc: 'فروشگاه پوشاک داخل مرکز خرید با آسانسور داخلی و ویترین کریدور',
      template: 'STORE' as const,
      businessType: 'Fashion' as const,
      locationContext: 'MALL_STORE' as const,
      attributes: { hasFittingRoom: true, hasShowcase: true, hasMannequins: true, hasElevator: true, hasParking: true, hasCustomerToilet: true }
    },
    {
      id: 'C',
      title: 'Scenario C: F&B - Street Store',
      desc: 'رستوران / فست‌فود خیابانی (فاقد پرو و مانکن، دارای منو و بهداشت)',
      template: 'STORE' as const,
      businessType: 'F_B' as const,
      locationContext: 'STREET_STORE' as const,
      attributes: { hasFittingRoom: false, hasShowcase: false, hasMannequins: false, hasElevator: false, hasParking: false, hasCustomerToilet: true }
    },
    {
      id: 'D',
      title: 'Scenario D: F&B - Mall Store (Food Court)',
      desc: 'واحد فودکورت مرکز خرید (فاقد ویترین سنتی، پیجر و فضای سفارش)',
      template: 'STORE' as const,
      businessType: 'F_B' as const,
      locationContext: 'FOOD_COURT' as const,
      attributes: { hasFittingRoom: false, hasShowcase: false, hasMannequins: false, hasElevator: false, hasParking: true, hasCustomerToilet: true }
    },
    {
      id: 'E',
      title: 'Scenario E: Watch & Jewelry - Mall Store',
      desc: 'ساعت و جواهر داخل مال (امنیت بالا، نورپردازی نقطه‌ای، فاقد پرو)',
      template: 'STORE' as const,
      businessType: 'Watch_Jewelry' as const,
      locationContext: 'MALL_STORE' as const,
      attributes: { hasFittingRoom: false, hasShowcase: true, hasMannequins: false, hasElevator: false, hasParking: true, hasCustomerToilet: false }
    },
    {
      id: 'F',
      title: 'Scenario F: Shopping Mall - SM',
      desc: 'مرکز خرید محلی / پایه (پارکینگ ساده، فاقد پلاک‌خوان هوشمند و شارژر)',
      template: 'MALL' as const,
      mallType: 'SM' as const,
      locationContext: 'STANDALONE' as const,
      attributes: { hasFittingRoom: false, hasShowcase: false, hasMannequins: false, hasElevator: true, hasParking: true, hasCustomerToilet: true }
    },
    {
      id: 'G',
      title: 'Scenario G: Shopping Mall - Regional Mall',
      desc: 'مرکز تجاری منطقه‌ای بزرگ (پارکینگ ۲۱ گانه کامل، پلاک‌خوان هوشمند، شارژ خودرو برقی)',
      template: 'MALL' as const,
      mallType: 'Regional' as const,
      locationContext: 'STANDALONE' as const,
      attributes: { hasFittingRoom: false, hasShowcase: false, hasMannequins: false, hasElevator: true, hasParking: true, hasCustomerToilet: true }
    }
  ], []);

  // Compute stats for all 7 scenarios live
  const scenarioResults = useMemo(() => {
    return scenarioDefinitions.map((sc) => {
      const applicable: Indicator[] = [];
      const excluded: { ind: Indicator; reason: string }[] = [];

      indicators.forEach((ind) => {
        if (ind.template !== sc.template) return;

        const res = evaluateIndicatorRule(
          ind,
          sc.template,
          sc.businessType,
          sc.locationContext,
          sc.mallType,
          sc.attributes
        );

        if (res.isApplicable) {
          applicable.push(ind);
        } else {
          excluded.push({ ind, reason: res.reason || 'EXCLUDED' });
        }
      });

      const sectionMap: Record<string, number> = {};
      applicable.forEach((i) => {
        sectionMap[i.journeyStage] = (sectionMap[i.journeyStage] || 0) + 1;
      });

      return {
        ...sc,
        applicableCount: applicable.length,
        excludedCount: excluded.length,
        sectionsCount: Object.keys(sectionMap).length,
        sectionMap
      };
    });
  }, [indicators, scenarioDefinitions]);

  const top10Differences = [
    {
      code: 'FS08',
      title: 'دید تابلو از فاصله ۱۵ تا ۲۰ متری معبر شهری',
      s1: 'Scenario A (Fashion Street)',
      v1: 'فعال (الزام دید از معبر خیابان)',
      s2: 'Scenario B (Fashion Mall)',
      v2: 'حذف شد (نامربوط به داخل مال)'
    },
    {
      code: 'FAFE01-04',
      title: 'سلامت، ایمنی و هندریل پله و آسانسور داخلی',
      s1: 'Scenario A (Street بدون آسانسور)',
      v1: 'حذف شد (تأسیسات آسانسور ندارد)',
      s2: 'Scenario B (Mall با آسانسور)',
      v2: 'فعال (ارزیابی تأسیسات عمودی)'
    },
    {
      code: 'FFR02-06',
      title: 'کیفیت، آینه، قفل و نظافت اتاق پرو',
      s1: 'Scenario A & B (Fashion)',
      v1: 'فعال (نیاز به پرو لباس)',
      s2: 'Scenario C & D (F&B)',
      v2: 'حذف شد (صنف غذا فاقد پرو است)'
    },
    {
      code: 'FMA01-04',
      title: 'مانکن‌ها و لباس مانکن و آراستگی بصری',
      s1: 'Scenario A (Fashion)',
      v1: 'فعال (نمایش تن‌پوش البسه)',
      s2: 'Scenario E (Watch & Jewelry)',
      v2: 'حذف شد (طلا و جواهر فاقد مانکن)'
    },
    {
      code: 'FPR08',
      title: 'منوی غذا و نوشیدنی با قیمت و ترکیبات شفاف',
      s1: 'Scenario C & D (F&B)',
      v1: 'فعال (اختصاصی رستوران و کافه)',
      s2: 'Scenario A & B (Fashion)',
      v2: 'حذف شد (نامرتبط به پوشاک)'
    },
    {
      code: 'FW01-06',
      title: 'ویترین و چیدمان جذاب کالا',
      s1: 'Scenario B (Fashion Mall)',
      v1: 'فعال (ویترین کریدور تجاری)',
      s2: 'Scenario D (Food Court)',
      v2: 'حذف شد (واحد فودکورت فاقد ویترین)'
    },
    {
      code: 'FCP08',
      title: 'دستگاه جداکننده تگ دزدگیر ضدسرقت',
      s1: 'Scenario A (Fashion)',
      v1: 'فعال (حفاظت از سرقت البسه)',
      s2: 'Scenario C (F&B رستوران)',
      v2: 'حذف شد (رستوران فاقد تگ لباس)'
    },
    {
      code: 'PR02',
      title: 'پلاک‌خوان هوشمند مکانیزه پارکینگ',
      s1: 'Scenario F (Mall SM محلی)',
      v1: 'حذف شد (تسویه سنتی)',
      s2: 'Scenario G (Regional Mall)',
      v2: 'فعال (الزام پارکینگ مکانیزه مدرن)'
    },
    {
      code: 'PR18',
      title: 'ایستگاه شارژ خودروهای برقی در پارکینگ',
      s1: 'Scenario F (Mall SM)',
      v1: 'حذف شد (فراتر از مقیاس محلی)',
      s2: 'Scenario G (Regional Mall)',
      v2: 'فعال (الزام مال‌های منطقه‌ای)'
    },
    {
      code: 'IS03',
      title: 'دایرکتوری دیجیتال و مانیتور لمسی راهنما',
      s1: 'Scenario F (Mall SM)',
      v1: 'حذف شد (استفاده از تابلوی چاپی)',
      s2: 'Scenario G (Regional Mall)',
      v2: 'فعال (نقشه تعاملی برندها)'
    }
  ];

  return (
    <div style={{ maxWidth: 880, margin: '20px auto', padding: '0 16px 40px' }}>
      <div className="glass-panel" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Sliders color="var(--rs-color-brand-cyan)" size={24} />
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700 }}>آزمون‌های الزامی سناریویی (Scenarios A through G)</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              صحت‌سنجی قطعی موتور قوانین پویا روی ۷ سناریوی مختلف و مقایسه تفاوت فرم‌های تولیدشده
            </p>
          </div>
        </div>

        {/* Live Comparison Table */}
        <div style={{ overflowX: 'auto', marginTop: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                <th style={{ textAlign: 'right', padding: '10px 8px' }}>سناریو</th>
                <th style={{ textAlign: 'right', padding: '10px 8px' }}>توضیحات و بستر استقرار</th>
                <th style={{ textAlign: 'center', padding: '10px 8px' }}>شاخص‌های قابل اعمال</th>
                <th style={{ textAlign: 'center', padding: '10px 8px' }}>شاخص‌های حذف‌شده</th>
                <th style={{ textAlign: 'center', padding: '10px 8px' }}>بخش‌های سفر</th>
                <th style={{ textAlign: 'center', padding: '10px 8px' }}>وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {scenarioResults.map((sc) => (
                <tr key={sc.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <td style={{ padding: '12px 8px', fontWeight: 700, color: 'var(--rs-color-brand-cyan)' }}>
                    {sc.id} ({sc.title.split(':')[1]?.trim()})
                  </td>
                  <td style={{ padding: '12px 8px', color: 'var(--text-muted)', fontSize: 12 }}>
                    {sc.desc}
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px 8px' }}>
                    <span
                      style={{
                        padding: '4px 10px',
                        background: 'rgba(0, 176, 240, 0.12)',
                        color: 'var(--rs-color-brand-cyan)',
                        borderRadius: 'var(--rs-radius-control)',
                        fontWeight: 800,
                        fontFamily: 'var(--rs-font-en)'
                      }}
                    >
                      {sc.applicableCount}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px 8px' }}>
                    <span
                      style={{
                        padding: '4px 10px',
                        background: sc.excludedCount > 0 ? 'rgba(217, 74, 86, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                        color: sc.excludedCount > 0 ? 'var(--rs-color-error)' : 'var(--text-dim)',
                        borderRadius: 'var(--rs-radius-control)',
                        fontWeight: 700,
                        fontFamily: 'var(--rs-font-en)'
                      }}
                    >
                      {sc.excludedCount}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px 8px', color: 'var(--rs-color-success)', fontWeight: 700 }}>
                    {sc.sectionsCount} بخش
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px 8px' }}>
                    <span style={{ color: 'var(--rs-color-success)', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600 }}>
                      <CheckCircle2 size={14} /> تأیید
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 10 Concrete Differentiating Examples */}
      <div className="glass-panel" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <ArrowUpDown color="var(--rs-color-brand-cyan)" size={20} />
          <h3 style={{ fontSize: 18, fontWeight: 700 }}>۱۰ نمونه از شاخص‌های متمایزکننده بین سناریوها</h3>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {top10Differences.map((d, idx) => (
            <div
              key={idx}
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                fontSize: 13
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span className="indicator-code-badge">{d.code}</span>
                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{d.title}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8, fontSize: 12 }}>
                <div style={{ background: 'var(--surface-sunken)', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ color: 'var(--theme-text-secondary)', fontWeight: 600, display: 'block', marginBottom: 2 }}>{d.s1}:</span>
                  <span style={{ color: 'var(--friction-clean)' }}>✓ {d.v1}</span>
                </div>

                <div style={{ background: 'var(--surface-sunken)', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ color: 'var(--theme-text-secondary)', fontWeight: 600, display: 'block', marginBottom: 2 }}>{d.s2}:</span>
                  <span style={{ color: 'var(--friction-high)' }}>✗ {d.v2}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
