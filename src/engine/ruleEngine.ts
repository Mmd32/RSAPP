import {
  AssessmentType,
  BusinessTypeCode,
  LocationContextCode,
  MallTypeCode,
  StoreAttributes,
  Indicator,
  Rule,
  AssessmentProfile,
  IndicatorExplanation,
  RuleExplanationTrace,
  FormGenerationAuditTrail,
  ScenarioDiffResult,
  IndicatorDiffDetail,
} from '../types';

export const STORE_JOURNEY_ORDER: Record<string, { order: number; labelFa: string }> = {
  BEFORE_ARRIVAL: { order: 1, labelFa: 'پیش از ورود و دسترسی' },
  APPROACH: { order: 2, labelFa: 'مواجهه، تابلو و نما' },
  ENTRY: { order: 3, labelFa: 'ورودی و درب' },
  NAVIGATION: { order: 4, labelFa: 'گردش داخل، راهروها و قفسه‌ها' },
  EXPLORATION: { order: 5, labelFa: 'کاوش کالا، ویترین و چیدمان' },
  EVALUATION: { order: 6, labelFa: 'ارزیابی کالا و اتاق پرو' },
  STAFF_INTERACTION: { order: 7, labelFa: 'تعامل با کارکنان و مشاوره' },
  PURCHASE: { order: 8, labelFa: 'صف، صندوق و پرداخت' },
  EXIT: { order: 9, labelFa: 'بسته‌بندی و تحویل کالا' },
  AFTER_SALES: { order: 10, labelFa: 'خروج و خدمات پس از فروش' },
  // Compatibility with short keys
  ENTER: { order: 3, labelFa: 'ورودی و درب' },
  NAVIGATE: { order: 4, labelFa: 'گردش داخل و قفسه‌ها' },
  EXPLORE: { order: 5, labelFa: 'کاوش کالا و ویترین' },
  EVALUATE: { order: 6, labelFa: 'ارزیابی کالا و پرو' },
  STAFF: { order: 7, labelFa: 'تعامل با کارکنان' },
  PACKAGING: { order: 9, labelFa: 'بسته‌بندی و تحویل' },
};

export const MALL_JOURNEY_ORDER: Record<string, { order: number; labelFa: string }> = {
  ARRIVAL: { order: 1, labelFa: 'دسترسی و مجاورت' },
  PARKING: { order: 2, labelFa: 'پارکینگ خودروها' },
  ENTRY: { order: 3, labelFa: 'ورودی و درگاه‌ها' },
  WAYFINDING: { order: 4, labelFa: 'علائم و مسیریابی' },
  VERTICAL_TRANSPORT: { order: 5, labelFa: 'پله‌برقی و آسانسورها' },
  CIRCULATION: { order: 6, labelFa: 'راهروها و گردش' },
  PUBLIC_SPACE: { order: 7, labelFa: 'فضاهای عمومی' },
  FACILITIES: { order: 8, labelFa: 'سرویس‌ها و رفاهیات' },
  FOOD_BEVERAGE: { order: 9, labelFa: 'فودکورت و رستوران' },
  CUSTOMER_SERVICE: { order: 10, labelFa: 'امور مشتریان و CRM' },
  SAFETY: { order: 11, labelFa: 'امنیت و ایمنی' },
  STAFF_OPERATIONS: { order: 12, labelFa: 'کارکنان و بهره‌برداری' },
  EXIT: { order: 13, labelFa: 'خروج و تخلیه' },
  // Compatibility
  ENTRANCE: { order: 3, labelFa: 'ورودی و آستانه' },
  STAFF: { order: 12, labelFa: 'کارکنان و بهره‌برداری' },
};

// PRECEDENCE TABLE (Rule Precedence Architecture):
// Explicit Manual Approved Rule (100) > Attribute Dependency (75) > Location Rule (50) > Base Excel Applicability (25)
export const RULE_PRECEDENCE = {
  MANUAL_EXPLICIT: 100,
  SYSTEM_ISOLATION: 100,
  ATTRIBUTE_DEPENDENCY: 75,
  LOCATION_CONTEXT: 50,
  BASE_EXCEL_MATRIX: 25,
};

export const SYSTEM_RULES: Record<string, Rule> = {
  RULE_TEMPLATE_ISOLATION: {
    id: 'RULE_TEMPLATE_ISOLATION',
    name: 'تفکیک قطعی دامنه ارزیابی فروشگاه از مرکز خرید',
    ruleType: 'EXCLUSION',
    ruleSource: 'SYSTEM',
    status: 'APPROVED',
    priority: RULE_PRECEDENCE.SYSTEM_ISOLATION,
    conditions: { match: 'template_mismatch' },
    effect: 'EXCLUDE',
    reason: 'شاخص‌های مرکز خرید هرگز به فروشگاه و بالعکس تخصیص نمی‌یابند.',
    createdBy: 'SYSTEM_ARCHITECT',
    createdAt: '2026-09-22T00:00:00Z',
  },
  RULE_STORE_BASE_EXCEL: {
    id: 'RULE_STORE_BASE_EXCEL',
    name: 'شمول پایه صنف بر اساس ماتریس اکسل',
    ruleType: 'APPLICABILITY',
    ruleSource: 'IMPORTED',
    status: 'APPROVED',
    priority: RULE_PRECEDENCE.BASE_EXCEL_MATRIX,
    conditions: { field: 'applicableBusinessTypes', operator: 'contains', value: '$profile.business_type' },
    effect: 'INCLUDE',
    reason: 'تطبیق علامت X در ستون صنف فروشگاه در فایل مرجع FR Checklist- Fashion-Nima.xlsx',
    createdBy: 'EXCEL_INGESTION_PIPELINE',
    createdAt: '2026-09-22T00:00:00Z',
  },
  RULE_LOC_STREET_01: {
    id: 'RULE_LOC_STREET_01',
    name: 'حذف شاخص‌های مختص راهرو و کریدور مال در فروشگاه خیابانی',
    ruleType: 'EXCLUSION',
    ruleSource: 'MANUAL',
    status: 'APPROVED',
    priority: RULE_PRECEDENCE.LOCATION_CONTEXT,
    conditions: { locationContext: 'STREET_STORE', keywords: ['راهروی مال', 'کریدور مرکز خرید', 'پله‌برقی مرکز خرید', 'نقشه طبقات مال'] },
    effect: 'EXCLUDE',
    reason: 'فروشگاه خیابانی فاقد راهرو، کریدور، پله‌برقی و نقشه طبقات مال است',
    createdBy: 'RETAIL_EXPERTS_COMMITTEE',
    createdAt: '2026-09-22T00:00:00Z',
  },
  RULE_LOC_MALL_FS08: {
    id: 'RULE_LOC_MALL_FS08',
    name: 'حذف شاخص دید از معبر خیابان (FS08) در فروشگاه داخل مال',
    ruleType: 'EXCLUSION',
    ruleSource: 'MANUAL',
    status: 'APPROVED',
    priority: RULE_PRECEDENCE.MANUAL_EXPLICIT,
    conditions: { locationContext: 'MALL_STORE', codes: ['FS08'] },
    effect: 'EXCLUDE',
    reason: 'تابلوی فروشگاه داخل مال در کریدور داخلی قرار دارد نه در فاصله ۱۵ تا ۲۰ متری معبر شهری',
    createdBy: 'RETAIL_EXPERTS_COMMITTEE',
    createdAt: '2026-09-22T00:00:00Z',
  },
  RULE_LOC_FC_01: {
    id: 'RULE_LOC_FC_01',
    name: 'حذف شاخص‌های ریتیل سنتی در غرفه فودکورت',
    ruleType: 'EXCLUSION',
    ruleSource: 'MANUAL',
    status: 'APPROVED',
    priority: RULE_PRECEDENCE.LOCATION_CONTEXT,
    conditions: { locationContext: 'FOOD_COURT', codes: ['FS08'], subjectKeywords: ['اتاق پرو', 'مانکن', 'ویترین'] },
    effect: 'EXCLUDE',
    reason: 'غرفه فودکورت فاقد اتاق پرو، مانکن، ویترین لباس و تابلوی معبر بیرونی است',
    createdBy: 'RETAIL_EXPERTS_COMMITTEE',
    createdAt: '2026-09-22T00:00:00Z',
  },
  RULE_DEP_NO_FITTING: {
    id: 'RULE_DEP_NO_FITTING',
    name: 'حذف وابستگی اتاق پرو در صورت فقدان اتاق پرو',
    ruleType: 'DEPENDENCY',
    ruleSource: 'DERIVED',
    status: 'APPROVED',
    priority: RULE_PRECEDENCE.ATTRIBUTE_DEPENDENCY,
    conditions: { attribute: 'has_fitting_room', equals: false, targetCodes: ['FFR02', 'FFR03', 'FFR04', 'FFR05', 'FFR06'] },
    effect: 'EXCLUDE',
    reason: 'فروشگاه در مشخصات اعلام کرده که فاقد اتاق پرو است (FFR02 تا FFR06)',
    createdBy: 'DYNAMIC_PROFILE_BUILDER',
    createdAt: '2026-09-22T00:00:00Z',
  },
  RULE_DEP_NO_SHOWCASE: {
    id: 'RULE_DEP_NO_SHOWCASE',
    name: 'حذف وابستگی ویترین شیشه‌ای در فروشگاه فاقد ویترین',
    ruleType: 'DEPENDENCY',
    ruleSource: 'DERIVED',
    status: 'APPROVED',
    priority: RULE_PRECEDENCE.ATTRIBUTE_DEPENDENCY,
    conditions: { attribute: 'has_window_display', equals: false, targetCodes: ['FW02', 'FW03', 'FW04', 'FW05', 'FW06'] },
    effect: 'EXCLUDE',
    reason: 'فروشگاه اعلام کرده فاقد ویترین بیرونی است (FW02 تا FW06)',
    createdBy: 'DYNAMIC_PROFILE_BUILDER',
    createdAt: '2026-09-22T00:00:00Z',
  },
  RULE_DEP_NO_MANNEQUINS: {
    id: 'RULE_DEP_NO_MANNEQUINS',
    name: 'حذف وابستگی مانکن در فروشگاه فاقد مانکن',
    ruleType: 'DEPENDENCY',
    ruleSource: 'DERIVED',
    status: 'APPROVED',
    priority: RULE_PRECEDENCE.ATTRIBUTE_DEPENDENCY,
    conditions: { attribute: 'has_mannequins', equals: false, prefix: 'FMA', except: 'FMA01' },
    effect: 'EXCLUDE',
    reason: 'فروشگاه فاقد مانکن نمایشی است (کدهای FMA)',
    createdBy: 'DYNAMIC_PROFILE_BUILDER',
    createdAt: '2026-09-22T00:00:00Z',
  },
  RULE_DEP_NO_ELEVATOR: {
    id: 'RULE_DEP_NO_ELEVATOR',
    name: 'حذف وابستگی آسانسور و پله در فروشگاه فاقد آسانسور و پله',
    ruleType: 'DEPENDENCY',
    ruleSource: 'DERIVED',
    status: 'APPROVED',
    priority: RULE_PRECEDENCE.ATTRIBUTE_DEPENDENCY,
    conditions: { attribute: 'has_elevator', equals: false, targetCodes: ['FAFE01', 'FAFE02', 'FAFE03', 'FAFE04'] },
    effect: 'EXCLUDE',
    reason: 'فروشگاه تک‌طبقه یا فاقد پله و آسانسور داخلی است (FAFE01 تا FAFE04)',
    createdBy: 'DYNAMIC_PROFILE_BUILDER',
    createdAt: '2026-09-22T00:00:00Z',
  },
  RULE_MALL_BASE_EXCEL: {
    id: 'RULE_MALL_BASE_EXCEL',
    name: 'شمول مقیاس مرکز خرید بر اساس ماتریس اکسل',
    ruleType: 'APPLICABILITY',
    ruleSource: 'IMPORTED',
    status: 'APPROVED',
    priority: RULE_PRECEDENCE.BASE_EXCEL_MATRIX,
    conditions: { field: 'applicableMallTypes', operator: 'contains', value: '$profile.mall_type' },
    effect: 'INCLUDE',
    reason: 'تطبیق علامت X در ستون مقیاس مرکز خرید در فایل مرجع FR_Report_Mall V2Final Version.xlsx',
    createdBy: 'EXCEL_INGESTION_PIPELINE',
    createdAt: '2026-09-22T00:00:00Z',
  },
  RULE_MALL_SM_SCALE: {
    id: 'RULE_MALL_SM_SCALE',
    name: 'حذف تجهیزات مگامال در مرکز خرید پایه (SM)',
    ruleType: 'EXCLUSION',
    ruleSource: 'MANUAL',
    status: 'APPROVED',
    priority: RULE_PRECEDENCE.LOCATION_CONTEXT,
    conditions: { mallType: 'SM', targetCodes: ['PR02', 'PR14', 'PR18', 'AM03', 'IS03', 'CS03'] },
    effect: 'EXCLUDE',
    reason: 'مرکز خرید پایه (SM) فاقد تجهیزات مگامال نظیر پارکینگ هوشمند پیشرفته و تفریحات منطقه‌ای است',
    createdBy: 'MALL_ASSESSMENT_COMMITTEE',
    createdAt: '2026-09-22T00:00:00Z',
  },
};

export function getAttributeValue(attrs: StoreAttributes | undefined, snakeKey: string, camelKey: string, defaultValue = true): boolean {
  if (!attrs) return defaultValue;
  if (attrs[snakeKey] !== undefined) return Boolean(attrs[snakeKey]);
  if (attrs[camelKey] !== undefined) return Boolean(attrs[camelKey]);
  return defaultValue;
}

export function explainIndicatorApplicability(
  profile: AssessmentProfile,
  ind: Indicator
): IndicatorExplanation {
  const code = ind.code;
  const subj = ind.subject;
  const stmt = ind.statement;

  const lines: string[] = [];
  lines.push(`Indicator ${code}`);

  // 1. Template Domain Separation Check
  if (ind.template !== profile.assessmentType) {
    const r = SYSTEM_RULES.RULE_TEMPLATE_ISOLATION;
    lines.push(`Template mismatch: Indicator is ${ind.template}, profile is ${profile.assessmentType}`);
    lines.push(`Source: ${r.ruleSource}`);
    lines.push(`Rule ID: ${r.id}`);
    lines.push('Final result:\nEXCLUDED');
    return {
      indicatorCode: code,
      indicatorStatement: stmt,
      baseApplicability: {
        isApplicable: false,
        source: r.ruleSource,
        ruleId: r.id,
        reason: 'TEMPLATE_MISMATCH',
      },
      contextRulesEvaluated: [
        {
          ruleId: r.id,
          ruleName: r.name,
          ruleType: r.ruleType,
          ruleSource: r.ruleSource,
          status: r.status,
          priority: r.priority,
          decision: 'EXCLUDED',
          reason: r.reason,
        },
      ],
      finalResult: 'EXCLUDED',
      formattedExplanation: lines.join('\n'),
    };
  }

  const traces: RuleExplanationTrace[] = [];

  if (profile.assessmentType === 'STORE') {
    // 2. Base Excel Applicability
    const bt = profile.businessType || 'Fashion';
    const isBaseApplicable =
      !ind.applicableBusinessTypes ||
      ind.applicableBusinessTypes.length === 0 ||
      ind.applicableBusinessTypes.includes(bt);

    const baseRule = SYSTEM_RULES.RULE_STORE_BASE_EXCEL;
    lines.push(`Base applicability: ${bt} = ${isBaseApplicable ? 'true' : 'false'}`);
    lines.push(`Source: Excel / ${baseRule.ruleSource}`);
    lines.push(`Rule ID: ${baseRule.id}`);

    if (!isBaseApplicable) {
      lines.push('\nFinal result:\nEXCLUDED');
      traces.push({
        ruleId: baseRule.id,
        ruleName: baseRule.name,
        ruleType: baseRule.ruleType,
        ruleSource: baseRule.ruleSource,
        status: baseRule.status,
        priority: baseRule.priority,
        decision: 'EXCLUDED',
        reason: `رسته ${bt} در ماتریس اکسل فاقد علامت X است`,
      });
      return {
        indicatorCode: code,
        indicatorStatement: stmt,
        baseApplicability: {
          isApplicable: false,
          source: `Excel / ${baseRule.ruleSource}`,
          ruleId: baseRule.id,
          reason: `BUSINESS_TYPE_${bt}_NOT_MARKED_X`,
        },
        contextRulesEvaluated: traces,
        finalResult: 'EXCLUDED',
        formattedExplanation: lines.join('\n'),
      };
    }

    // 3. Location Context Rules
    const loc = profile.locationContext || 'STREET_STORE';
    if (loc === 'STREET_STORE') {
      if (
        stmt.includes('راهروی مال') ||
        stmt.includes('کریدور مرکز خرید') ||
        stmt.includes('پله‌برقی مرکز خرید') ||
        stmt.includes('نقشه طبقات مال')
      ) {
        const r = SYSTEM_RULES.RULE_LOC_STREET_01;
        lines.push(`\nLocation rule:\nStreet Store => exclude mall-specific corridor elements`);
        lines.push(`Source: ${r.ruleSource}`);
        lines.push(`Rule ID: ${r.id}`);
        lines.push('Final result:\nEXCLUDED');
        traces.push({
          ruleId: r.id,
          ruleName: r.name,
          ruleType: r.ruleType,
          ruleSource: r.ruleSource,
          status: r.status,
          priority: r.priority,
          decision: 'EXCLUDED',
          reason: r.reason,
        });
        return {
          indicatorCode: code,
          indicatorStatement: stmt,
          baseApplicability: { isApplicable: true, source: `Excel / ${baseRule.ruleSource}`, ruleId: baseRule.id, reason: 'BASE_EXCEL_ACTIVE' },
          contextRulesEvaluated: traces,
          finalResult: 'EXCLUDED',
          formattedExplanation: lines.join('\n'),
        };
      }
    } else if (loc === 'MALL_STORE') {
      if (code === 'FS08' || stmt.includes('۱۵ تا ۲۰ متری معبر') || stmt.includes('خیابان اصلی')) {
        const r = SYSTEM_RULES.RULE_LOC_MALL_FS08;
        lines.push(`\nLocation rule:\nMall Store => exclude street visibility check`);
        lines.push(`Source: ${r.ruleSource}`);
        lines.push(`Rule ID: ${r.id}`);
        lines.push('Final result:\nEXCLUDED');
        traces.push({
          ruleId: r.id,
          ruleName: r.name,
          ruleType: r.ruleType,
          ruleSource: r.ruleSource,
          status: r.status,
          priority: r.priority,
          decision: 'EXCLUDED',
          reason: r.reason,
        });
        return {
          indicatorCode: code,
          indicatorStatement: stmt,
          baseApplicability: { isApplicable: true, source: `Excel / ${baseRule.ruleSource}`, ruleId: baseRule.id, reason: 'BASE_EXCEL_ACTIVE' },
          contextRulesEvaluated: traces,
          finalResult: 'EXCLUDED',
          formattedExplanation: lines.join('\n'),
        };
      }
    } else if (loc === 'FOOD_COURT') {
      if (code === 'FS08' || subj.includes('اتاق پرو') || subj.includes('مانکن') || subj.includes('ویترین')) {
        const r = SYSTEM_RULES.RULE_LOC_FC_01;
        lines.push(`\nLocation rule:\nFood Court => exclude retail apparel elements`);
        lines.push(`Source: ${r.ruleSource}`);
        lines.push(`Rule ID: ${r.id}`);
        lines.push('Final result:\nEXCLUDED');
        traces.push({
          ruleId: r.id,
          ruleName: r.name,
          ruleType: r.ruleType,
          ruleSource: r.ruleSource,
          status: r.status,
          priority: r.priority,
          decision: 'EXCLUDED',
          reason: r.reason,
        });
        return {
          indicatorCode: code,
          indicatorStatement: stmt,
          baseApplicability: { isApplicable: true, source: `Excel / ${baseRule.ruleSource}`, ruleId: baseRule.id, reason: 'BASE_EXCEL_ACTIVE' },
          contextRulesEvaluated: traces,
          finalResult: 'EXCLUDED',
          formattedExplanation: lines.join('\n'),
        };
      }
    }

    // 4. Attribute Dependencies (RULE_DEP_*)
    const attrs = profile.attributes;
    const hasFitting = getAttributeValue(attrs, 'has_fitting_room', 'hasFittingRoom', true);
    if (!hasFitting && ['FFR02', 'FFR03', 'FFR04', 'FFR05', 'FFR06'].includes(code)) {
      const r = SYSTEM_RULES.RULE_DEP_NO_FITTING;
      lines.push(`\nDependency rule:\nhas_fitting_room = false => exclude fitting room indicators`);
      lines.push(`Source: ${r.ruleSource}`);
      lines.push(`Rule ID: ${r.id}`);
      lines.push('Final result:\nEXCLUDED');
      traces.push({
        ruleId: r.id,
        ruleName: r.name,
        ruleType: r.ruleType,
        ruleSource: r.ruleSource,
        status: r.status,
        priority: r.priority,
        decision: 'EXCLUDED',
        reason: r.reason,
      });
      return {
        indicatorCode: code,
        indicatorStatement: stmt,
        baseApplicability: { isApplicable: true, source: `Excel / ${baseRule.ruleSource}`, ruleId: baseRule.id, reason: 'BASE_EXCEL_ACTIVE' },
        contextRulesEvaluated: traces,
        finalResult: 'EXCLUDED',
        formattedExplanation: lines.join('\n'),
      };
    }

    const hasShowcase = getAttributeValue(attrs, 'has_window_display', 'hasShowcase', true);
    if (!hasShowcase && ['FW02', 'FW03', 'FW04', 'FW05', 'FW06'].includes(code)) {
      const r = SYSTEM_RULES.RULE_DEP_NO_SHOWCASE;
      lines.push(`\nDependency rule:\nhas_window_display = false => exclude showcase indicators`);
      lines.push(`Source: ${r.ruleSource}`);
      lines.push(`Rule ID: ${r.id}`);
      lines.push('Final result:\nEXCLUDED');
      traces.push({
        ruleId: r.id,
        ruleName: r.name,
        ruleType: r.ruleType,
        ruleSource: r.ruleSource,
        status: r.status,
        priority: r.priority,
        decision: 'EXCLUDED',
        reason: r.reason,
      });
      return {
        indicatorCode: code,
        indicatorStatement: stmt,
        baseApplicability: { isApplicable: true, source: `Excel / ${baseRule.ruleSource}`, ruleId: baseRule.id, reason: 'BASE_EXCEL_ACTIVE' },
        contextRulesEvaluated: traces,
        finalResult: 'EXCLUDED',
        formattedExplanation: lines.join('\n'),
      };
    }

    const hasMannequins = getAttributeValue(attrs, 'has_mannequins', 'hasMannequins', true);
    if (!hasMannequins && code.startsWith('FMA') && code !== 'FMA01') {
      const r = SYSTEM_RULES.RULE_DEP_NO_MANNEQUINS;
      lines.push(`\nDependency rule:\nhas_mannequins = false => exclude mannequin indicators`);
      lines.push(`Source: ${r.ruleSource}`);
      lines.push(`Rule ID: ${r.id}`);
      lines.push('Final result:\nEXCLUDED');
      traces.push({
        ruleId: r.id,
        ruleName: r.name,
        ruleType: r.ruleType,
        ruleSource: r.ruleSource,
        status: r.status,
        priority: r.priority,
        decision: 'EXCLUDED',
        reason: r.reason,
      });
      return {
        indicatorCode: code,
        indicatorStatement: stmt,
        baseApplicability: { isApplicable: true, source: `Excel / ${baseRule.ruleSource}`, ruleId: baseRule.id, reason: 'BASE_EXCEL_ACTIVE' },
        contextRulesEvaluated: traces,
        finalResult: 'EXCLUDED',
        formattedExplanation: lines.join('\n'),
      };
    }

    const hasElevator = getAttributeValue(attrs, 'has_elevator', 'hasElevator', true);
    if (!hasElevator && ['FAFE01', 'FAFE02', 'FAFE03', 'FAFE04'].includes(code)) {
      const r = SYSTEM_RULES.RULE_DEP_NO_ELEVATOR;
      lines.push(`\nDependency rule:\nhas_elevator = false => exclude internal elevator/stairs indicators`);
      lines.push(`Source: ${r.ruleSource}`);
      lines.push(`Rule ID: ${r.id}`);
      lines.push('Final result:\nEXCLUDED');
      traces.push({
        ruleId: r.id,
        ruleName: r.name,
        ruleType: r.ruleType,
        ruleSource: r.ruleSource,
        status: r.status,
        priority: r.priority,
        decision: 'EXCLUDED',
        reason: r.reason,
      });
      return {
        indicatorCode: code,
        indicatorStatement: stmt,
        baseApplicability: { isApplicable: true, source: `Excel / ${baseRule.ruleSource}`, ruleId: baseRule.id, reason: 'BASE_EXCEL_ACTIVE' },
        contextRulesEvaluated: traces,
        finalResult: 'EXCLUDED',
        formattedExplanation: lines.join('\n'),
      };
    }

    lines.push('\nAll context & dependency rules evaluated: PASS');
    lines.push('Final result:\nINCLUDED');
    return {
      indicatorCode: code,
      indicatorStatement: stmt,
      baseApplicability: { isApplicable: true, source: `Excel / ${baseRule.ruleSource}`, ruleId: baseRule.id, reason: 'BASE_EXCEL_ACTIVE' },
      contextRulesEvaluated: traces,
      finalResult: 'INCLUDED',
      formattedExplanation: lines.join('\n'),
    };
  } else {
    // MALL Assessment
    const mt = profile.mallType || 'Regional';
    const isBaseApplicable =
      !ind.applicableMallTypes ||
      ind.applicableMallTypes.length === 0 ||
      ind.applicableMallTypes.includes(mt);

    const baseRule = SYSTEM_RULES.RULE_MALL_BASE_EXCEL;
    lines.push(`Base applicability: Mall Scale ${mt} = ${isBaseApplicable ? 'true' : 'false'}`);
    lines.push(`Source: Excel / ${baseRule.ruleSource}`);
    lines.push(`Rule ID: ${baseRule.id}`);

    if (!isBaseApplicable) {
      lines.push('\nFinal result:\nEXCLUDED');
      traces.push({
        ruleId: baseRule.id,
        ruleName: baseRule.name,
        ruleType: baseRule.ruleType,
        ruleSource: baseRule.ruleSource,
        status: baseRule.status,
        priority: baseRule.priority,
        decision: 'EXCLUDED',
        reason: `مقیاس ${mt} در ماتریس اکسل مال فاقد علامت X است`,
      });
      return {
        indicatorCode: code,
        indicatorStatement: stmt,
        baseApplicability: { isApplicable: false, source: `Excel / ${baseRule.ruleSource}`, ruleId: baseRule.id, reason: `MALL_SCALE_${mt}_NOT_MARKED_X` },
        contextRulesEvaluated: traces,
        finalResult: 'EXCLUDED',
        formattedExplanation: lines.join('\n'),
      };
    }

    if (mt === 'SM') {
      if (['PR02', 'PR14', 'PR18', 'AM03', 'IS03', 'CS03'].includes(code)) {
        const r = SYSTEM_RULES.RULE_MALL_SM_SCALE;
        lines.push(`\nScale rule:\nSM Scale => exclude advanced mega-mall infrastructure`);
        lines.push(`Source: ${r.ruleSource}`);
        lines.push(`Rule ID: ${r.id}`);
        lines.push('Final result:\nEXCLUDED');
        traces.push({
          ruleId: r.id,
          ruleName: r.name,
          ruleType: r.ruleType,
          ruleSource: r.ruleSource,
          status: r.status,
          priority: r.priority,
          decision: 'EXCLUDED',
          reason: r.reason,
        });
        return {
          indicatorCode: code,
          indicatorStatement: stmt,
          baseApplicability: { isApplicable: true, source: `Excel / ${baseRule.ruleSource}`, ruleId: baseRule.id, reason: 'BASE_EXCEL_ACTIVE' },
          contextRulesEvaluated: traces,
          finalResult: 'EXCLUDED',
          formattedExplanation: lines.join('\n'),
        };
      }
    }

    lines.push('\nAll context rules evaluated: PASS');
    lines.push('Final result:\nINCLUDED');
    return {
      indicatorCode: code,
      indicatorStatement: stmt,
      baseApplicability: { isApplicable: true, source: `Excel / ${baseRule.ruleSource}`, ruleId: baseRule.id, reason: 'BASE_EXCEL_ACTIVE' },
      contextRulesEvaluated: traces,
      finalResult: 'INCLUDED',
      formattedExplanation: lines.join('\n'),
    };
  }
}

export function evaluateIndicatorRule(
  ind: Indicator,
  assessmentType: AssessmentType,
  businessType?: BusinessTypeCode,
  locationContext?: LocationContextCode,
  mallType?: MallTypeCode,
  attributes?: StoreAttributes
): { isApplicable: boolean; reason?: string; ruleId?: string } {
  const profile: AssessmentProfile =
    assessmentType === 'STORE'
      ? {
          assessmentType: 'STORE',
          businessType: businessType || 'Fashion',
          locationContext: locationContext || 'STREET_STORE',
          attributes: attributes || {},
        }
      : {
          assessmentType: 'MALL',
          mallType: mallType || 'Regional',
          attributes: attributes || {},
        };

  const exp = explainIndicatorApplicability(profile, ind);
  return {
    isApplicable: exp.finalResult === 'INCLUDED',
    reason: exp.contextRulesEvaluated[0]?.reason || exp.baseApplicability.reason,
    ruleId: exp.contextRulesEvaluated[0]?.ruleId || exp.baseApplicability.ruleId,
  };
}

export function generateDynamicChecklistWithAudit(
  allIndicators: Indicator[],
  profile: AssessmentProfile
): { indicators: Indicator[]; auditTrail: FormGenerationAuditTrail } {
  const selected: Indicator[] = [];
  const selectedCodes: string[] = [];
  const excluded: { code: string; ruleId: string; reason: string }[] = [];
  const rulesEvaluated: RuleExplanationTrace[] = [];
  const conflictsLogged: { ruleA: string; ruleB: string; resolvedPriority: number; outcome: string }[] = [];

  allIndicators.forEach((ind) => {
    // Archived indicators stay in the catalog for old visits but are never asked again.
    if (ind.status === 'ARCHIVED') {
      excluded.push({ code: ind.code, ruleId: 'ARCHIVED', reason: 'شاخص بایگانی شده است' });
      return;
    }
    const exp = explainIndicatorApplicability(profile, ind);
    if (exp.contextRulesEvaluated.length > 0) {
      rulesEvaluated.push(...exp.contextRulesEvaluated);
    }
    if (exp.finalResult === 'INCLUDED') {
      selected.push(ind);
      selectedCodes.push(ind.code);
    } else {
      excluded.push({
        code: ind.code,
        ruleId: exp.contextRulesEvaluated[0]?.ruleId || exp.baseApplicability.ruleId,
        reason: exp.contextRulesEvaluated[0]?.reason || exp.baseApplicability.reason,
      });
    }
  });

  // The questionnaire follows the checklist file row by row: its order is the display order.
  const sorted = selected.sort((a, b) => a.displayOrder - b.displayOrder);

  const auditTrail: FormGenerationAuditTrail = {
    profileSnapshot: profile,
    rulesEvaluated,
    selectedIndicators: selectedCodes,
    excludedIndicators: excluded,
    conflictsLogged,
    generatedAt: new Date().toISOString(),
  };

  return { indicators: sorted, auditTrail };
}

export function generateDynamicChecklist(
  allIndicators: Indicator[],
  assessmentType: AssessmentType,
  businessType?: BusinessTypeCode,
  locationContext: LocationContextCode = 'STREET_STORE',
  mallType?: MallTypeCode,
  attributes?: StoreAttributes
): Indicator[] {
  const profile: AssessmentProfile =
    assessmentType === 'STORE'
      ? {
          assessmentType: 'STORE',
          businessType: businessType || 'Fashion',
          locationContext,
          attributes: attributes || {},
        }
      : {
          assessmentType: 'MALL',
          mallType: mallType || 'Regional',
          attributes: attributes || {},
        };

  return generateDynamicChecklistWithAudit(allIndicators, profile).indicators;
}

export function diffScenarios(
  scenarioAName: string,
  profileA: AssessmentProfile,
  scenarioBName: string,
  profileB: AssessmentProfile,
  allIndicators: Indicator[]
): ScenarioDiffResult {
  const resA = generateDynamicChecklistWithAudit(allIndicators, profileA);
  const resB = generateDynamicChecklistWithAudit(allIndicators, profileB);

  const codesA = new Set(resA.indicators.map((i) => i.code));
  const codesB = new Set(resB.indicators.map((i) => i.code));

  const sharedCodes = Array.from(codesA).filter((c) => codesB.has(c));
  const onlyInACodes = Array.from(codesA).filter((c) => !codesB.has(c));
  const onlyInBCodes = Array.from(codesB).filter((c) => !codesA.has(c));

  const onlyInA: IndicatorDiffDetail[] = onlyInACodes.map((c) => {
    const ind = allIndicators.find((i) => i.code === c)!;
    const expB = explainIndicatorApplicability(profileB, ind);
    const primaryRule = expB.contextRulesEvaluated[0] || expB.baseApplicability;
    return {
      code: c,
      reason: `حذف در ${scenarioBName} به دلیل: ${primaryRule.reason}`,
      ruleId: primaryRule.ruleId,
      ruleSource: (primaryRule as any).ruleSource || 'SYSTEM',
    };
  });

  const onlyInB: IndicatorDiffDetail[] = onlyInBCodes.map((c) => {
    const ind = allIndicators.find((i) => i.code === c)!;
    const expA = explainIndicatorApplicability(profileA, ind);
    const primaryRule = expA.contextRulesEvaluated[0] || expA.baseApplicability;
    return {
      code: c,
      reason: `حذف در ${scenarioAName} به دلیل: ${primaryRule.reason}`,
      ruleId: primaryRule.ruleId,
      ruleSource: (primaryRule as any).ruleSource || 'SYSTEM',
    };
  });

  const differentWeights: { code: string; weightA: number; weightB: number }[] = [];
  const differentRequirements: { code: string; reqA: any; reqB: any }[] = [];

  sharedCodes.forEach((c) => {
    const indA = resA.indicators.find((i) => i.code === c)!;
    const indB = resB.indicators.find((i) => i.code === c)!;
    if (indA.weight !== indB.weight) {
      differentWeights.push({ code: c, weightA: indA.weight, weightB: indB.weight });
    }
    if (indA.requiresPhoto !== indB.requiresPhoto) {
      differentRequirements.push({
        code: c,
        reqA: { requiresPhoto: indA.requiresPhoto },
        reqB: { requiresPhoto: indB.requiresPhoto },
      });
    }
  });

  return {
    scenarioA: scenarioAName,
    scenarioB: scenarioBName,
    sharedCodes,
    onlyInA,
    onlyInB,
    differentRequirements,
    differentWeights,
  };
}
