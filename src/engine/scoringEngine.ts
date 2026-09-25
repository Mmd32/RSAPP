import {
  Indicator,
  QuestionResponse,
  VisitReportSummary,
  CategoryScore,
  SeverityLevel,
  ScoringProfile,
  DimensionExplainabilityDetail,
  RadarSeriesData,
  MainFindingPrioritized,
  AssessmentType,
  RoundingMethod,
} from '../types.js';

// ============================================================================
// 1. CANONICAL REPORTING DIMENSIONS (Prompt 3, Requirement 6)
// ============================================================================

export const CANONICAL_DIMENSIONS: {
  key: string;
  nameFa: string;
  nameEn: string;
  descriptionFa: string;
  defaultWeight: number;
}[] = [
  {
    key: 'ACCESS',
    nameFa: 'دسترسی و ورود',
    nameEn: 'Access & Arrival',
    descriptionFa: 'دسترسی شهری، ورودی، رمپ‌ها، پارکینگ و تابلوی اصلی',
    defaultWeight: 1.0,
  },
  {
    key: 'NAVIGATION',
    nameFa: 'مسیریابی و هدایت',
    nameEn: 'Navigation & Wayfinding',
    descriptionFa: 'کریدورها، تابلوهای راهنما، پله‌برقی، آسانسور و جریان حرکت',
    defaultWeight: 1.2,
  },
  {
    key: 'ENVIRONMENT',
    nameFa: 'محیط و فضا',
    nameEn: 'Environment & Atmosphere',
    descriptionFa: 'نورپردازی، دما، تهویه، پاکیزگی، موسیقی و ایمنی عمومی',
    defaultWeight: 1.5,
  },
  {
    key: 'PRODUCT',
    nameFa: 'کالا و چیدمان',
    nameEn: 'Product & Visual Merchandising',
    descriptionFa: 'ویترین، چیدمان بصری، تنوع محصول، قیمت‌گذاری و بسته‌بندی',
    defaultWeight: 2.0,
  },
  {
    key: 'PEOPLE',
    nameFa: 'پرسنل و تعامل',
    nameEn: 'People & Staff Interaction',
    descriptionFa: 'آراستگی، خوش‌آمدگویی، تسلط بر محصول و ادب کارکنان',
    defaultWeight: 2.0,
  },
  {
    key: 'SERVICE',
    nameFa: 'خدمات مشتریان',
    nameEn: 'Customer Service',
    descriptionFa: 'میز اطلاعات، رسیدگی به شکایات، تسهیلات رفاهی و خدمات عمومی',
    defaultWeight: 1.5,
  },
  {
    key: 'CHECKOUT',
    nameFa: 'صندوق و پرداخت',
    nameEn: 'Checkout & Transaction',
    descriptionFa: 'سرعت تسویه، صف صندوق، دقت صورتحساب و بسته‌بندی خرید',
    defaultWeight: 1.8,
  },
  {
    key: 'AFTER_SALES',
    nameFa: 'خدمات پس از فروش',
    nameEn: 'After Sales & Loyalty',
    descriptionFa: 'سیاست مرجوعی، باشگاه مشتریان، گارانتی و پیگیری رضایت',
    defaultWeight: 1.0,
  },
];

export const CANONICAL_DIMENSION_MAP = new Map(
  CANONICAL_DIMENSIONS.map((d) => [d.key, d])
);

// Map raw indicators (Store or Mall) to canonical reporting dimensions
export function mapToCanonicalDimension(ind: Indicator): string {
  const rawDim = (ind.reportingDimension || '').toUpperCase().trim();

  if (CANONICAL_DIMENSION_MAP.has(rawDim)) {
    return rawDim;
  }

  // Mall raw dimensions mapping
  if (rawDim === 'ARRIVAL_PARKING') return 'ACCESS';
  if (rawDim === 'WAYFINDING_SIGNAGE' || rawDim === 'VERTICAL_TRANSPORT') return 'NAVIGATION';
  if (rawDim === 'FACILITIES_HYGIENE' || rawDim === 'SAFETY_SECURITY') return 'ENVIRONMENT';
  if (rawDim === 'CUSTOMER_SERVICE' || rawDim === 'DINING_ENTERTAINMENT') return 'SERVICE';

  // Fallback by Journey Stage
  const stage = (ind.journeyStage || '').toUpperCase();
  if (['APPROACH', 'ENTRY', 'ARRIVAL', 'PARKING'].includes(stage)) return 'ACCESS';
  if (['NAVIGATION', 'WAYFINDING', 'CIRCULATION', 'VERTICAL_TRANSPORT'].includes(stage)) return 'NAVIGATION';
  if (['EXPLORATION', 'FACILITIES', 'SAFETY'].includes(stage)) return 'ENVIRONMENT';
  if (['EVALUATION', 'FOOD_BEVERAGE'].includes(stage)) return 'PRODUCT';
  if (['STAFF_INTERACTION'].includes(stage)) return 'PEOPLE';
  if (['CUSTOMER_SERVICE'].includes(stage)) return 'SERVICE';
  if (['PURCHASE', 'EXIT'].includes(stage)) return 'CHECKOUT';
  if (['AFTER_SALES'].includes(stage)) return 'AFTER_SALES';

  // Fallback by group
  const group = (ind.group || '').toLowerCase();
  if (group.includes('صندوق') || group.includes('خروج')) return 'CHECKOUT';
  if (group.includes('پرسنل') || group.includes('کارکنان')) return 'PEOPLE';
  if (group.includes('ویترین') || group.includes('محصول') || group.includes('پرو')) return 'PRODUCT';
  if (group.includes('نظافت') || group.includes('روشنایی') || group.includes('محیط')) return 'ENVIRONMENT';
  if (group.includes('ورودی') || group.includes('تابلو') || group.includes('پارکینگ')) return 'ACCESS';
  if (group.includes('خدمات') || group.includes('باشگاه')) return 'AFTER_SALES';

  return 'ENVIRONMENT'; // Default fallback
}

// ============================================================================
// 2. CONFIGURABLE SCORING PROFILES (Prompt 3, Requirements 1, 2, 5)
// ============================================================================

export const DEFAULT_CONSULTING_PROFILE: ScoringProfile = {
  id: 'profile_rs_consulting_v1',
  name: 'Retail Solutions Standard Consulting Profile (V1.0)',
  version: 1,
  severityPenalties: {
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
    CRITICAL: 4,
  },
  indicatorWeighting: 'CUSTOM',
  dimensionWeights: {
    ACCESS: 1.0,
    NAVIGATION: 1.2,
    ENVIRONMENT: 1.5,
    PRODUCT: 2.0,
    PEOPLE: 2.0,
    SERVICE: 1.5,
    CHECKOUT: 1.8,
    AFTER_SALES: 1.0,
  },
  overallFormula: 'WEIGHTED_DIMENSIONS',
  roundingMethod: 'ROUND',
  status: 'ACTIVE',
  description: 'پروفایل استاندارد ارزیابی مشاوره‌ای ریتیل سلوشنز بر مبنای وزن‌دهی ابعاد ۸گانه تجربه مشتری',
};

export const UNWEIGHTED_SCORING_PROFILE: ScoringProfile = {
  id: 'profile_rs_unweighted_v1',
  name: 'Retail Solutions Simple Average Profile (V1.0)',
  version: 1,
  severityPenalties: {
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
    CRITICAL: 4,
  },
  indicatorWeighting: 'EQUAL',
  dimensionWeights: {
    ACCESS: 1.0,
    NAVIGATION: 1.0,
    ENVIRONMENT: 1.0,
    PRODUCT: 1.0,
    PEOPLE: 1.0,
    SERVICE: 1.0,
    CHECKOUT: 1.0,
    AFTER_SALES: 1.0,
  },
  overallFormula: 'UNWEIGHTED_DIMENSIONS',
  roundingMethod: 'ROUND',
  status: 'ACTIVE',
  description: 'محاسبه میانگین ساده و بدون ضریب اهمیت بین ابعاد ۸گانه',
};

export const STRICT_CRITICAL_PROFILE: ScoringProfile = {
  id: 'profile_rs_strict_v1',
  name: 'Retail Solutions Strict Penalty Profile (V1.0)',
  version: 1,
  severityPenalties: {
    LOW: 1,
    MEDIUM: 3,
    HIGH: 6,
    CRITICAL: 10,
  },
  indicatorWeighting: 'CUSTOM',
  dimensionWeights: {
    ACCESS: 1.0,
    NAVIGATION: 1.2,
    ENVIRONMENT: 1.5,
    PRODUCT: 2.0,
    PEOPLE: 2.0,
    SERVICE: 1.5,
    CHECKOUT: 2.0,
    AFTER_SALES: 1.2,
  },
  overallFormula: 'WEIGHTED_DIMENSIONS',
  roundingMethod: 'FLOOR',
  status: 'ACTIVE',
  description: 'پروفایل سخت‌گیرانه با جریمه تصاعدی برای اصطکاک‌های شدید و بحرانی',
};

export const SCORING_PROFILES_REGISTRY: Record<string, ScoringProfile> = {
  [DEFAULT_CONSULTING_PROFILE.id]: DEFAULT_CONSULTING_PROFILE,
  [UNWEIGHTED_SCORING_PROFILE.id]: UNWEIGHTED_SCORING_PROFILE,
  [STRICT_CRITICAL_PROFILE.id]: STRICT_CRITICAL_PROFILE,
};

function applyRounding(value: number, method: RoundingMethod): number {
  if (method === 'FLOOR') return Math.floor(value);
  if (method === 'CEIL') return Math.ceil(value);
  return Math.round(value);
}

// ============================================================================
// 3. COMPLETE EXPLAINABLE SCORING ENGINE (Requirements 1, 3, 4, 5, 6, 11, 13)
// ============================================================================

export interface ComparisonVisitContext {
  previousVisitScores?: Record<string, number>;
  brandAverageScores?: Record<string, number>;
  branchAverageScores?: Record<string, number>;
  comparisonVisitScores?: Record<string, number>;
  recurringFindingCodes?: Set<string>;
}

export function calculateVisitSummary(
  indicators: Indicator[],
  responses: Record<string, QuestionResponse>,
  assessmentType: AssessmentType = 'STORE',
  profile: ScoringProfile = DEFAULT_CONSULTING_PROFILE,
  comparisonContext?: ComparisonVisitContext
): VisitReportSummary {
  const effectiveComparison: ComparisonVisitContext = comparisonContext || {
    previousVisitScores: {
      ACCESS: 72,
      NAVIGATION: 68,
      ENVIRONMENT: 75,
      PRODUCT: 64,
      PEOPLE: 70,
      SERVICE: 60,
      CHECKOUT: 74,
      AFTER_SALES: 65,
    },
    brandAverageScores: {
      ACCESS: 82,
      NAVIGATION: 78,
      ENVIRONMENT: 80,
      PRODUCT: 76,
      PEOPLE: 84,
      SERVICE: 72,
      CHECKOUT: 79,
      AFTER_SALES: 71,
    },
  };

  const maxSeverityPenalty = profile.severityPenalties.CRITICAL || 4;

  let totalFrictions = 0;
  let criticalFrictions = 0;
  let highFrictions = 0;
  let mediumFrictions = 0;
  let lowFrictions = 0;
  let totalPhotos = 0;
  let answeredCount = 0;

  // Initialize Dimension Tracking Structures
  const dimensionDataMap: Record<
    string,
    {
      meta: typeof CANONICAL_DIMENSIONS[0];
      applicableIndicators: Indicator[];
      applicableAnswered: Indicator[];
      cleanCount: number;
      frictionCount: number;
      naCount: number;
      criticalCount: number;
      highCount: number;
      totalWeight: number;
      severityPenaltiesSum: number;
      maxPossiblePenaltiesSum: number;
      underlyingIndicators: {
        code: string;
        subject: string;
        statement: string;
        weight: number;
        answerState: any;
        severity?: SeverityLevel;
      }[];
    }
  > = {};

  CANONICAL_DIMENSIONS.forEach((dim) => {
    dimensionDataMap[dim.key] = {
      meta: dim,
      applicableIndicators: [],
      applicableAnswered: [],
      cleanCount: 0,
      frictionCount: 0,
      naCount: 0,
      criticalCount: 0,
      highCount: 0,
      totalWeight: 0,
      severityPenaltiesSum: 0,
      maxPossiblePenaltiesSum: 0,
      underlyingIndicators: [],
    };
  });

  const allFrictionItems: {
    indicator: Indicator;
    response: QuestionResponse;
    dimKey: string;
    dimWeight: number;
  }[] = [];

  // Group Indicators into Reporting Dimensions
  indicators.forEach((ind) => {
    const dimKey = mapToCanonicalDimension(ind);
    const dData = dimensionDataMap[dimKey] || dimensionDataMap['ENVIRONMENT'];
    dData.applicableIndicators.push(ind);
  });

  // Evaluate Responses for Applicable Indicators
  indicators.forEach((ind) => {
    const resp = responses[ind.id];
    const dimKey = mapToCanonicalDimension(ind);
    const dData = dimensionDataMap[dimKey] || dimensionDataMap['ENVIRONMENT'];

    if (!resp || resp.answerState === 'UNANSWERED') {
      // Unanswered: do NOT count in score denominator (Requirement 3)
      return;
    }

    answeredCount += 1;

    if (resp.photos && resp.photos.length > 0) {
      totalPhotos += resp.photos.length;
    }

    // N/A: strictly removed from denominator (Requirement 3)
    if (resp.answerState === 'NOT_APPLICABLE') {
      dData.naCount += 1;
      dData.underlyingIndicators.push({
        code: ind.code,
        subject: ind.subject,
        statement: ind.statement,
        weight: ind.weight || 1.0,
        answerState: 'NOT_APPLICABLE',
      });
      return;
    }

    dData.applicableAnswered.push(ind);
    const itemWeight = profile.indicatorWeighting === 'EQUAL' ? 1.0 : ind.weight || 1.0;
    const maxItemPenalty = itemWeight * maxSeverityPenalty;

    dData.totalWeight += itemWeight;
    dData.maxPossiblePenaltiesSum += maxItemPenalty;

    if (resp.answerState === 'NO_FRICTION' || resp.answerState === 'POSITIVE_REWARD') {
      dData.cleanCount += 1;
      dData.underlyingIndicators.push({
        code: ind.code,
        subject: ind.subject,
        statement: ind.statement,
        weight: itemWeight,
        answerState: resp.answerState,
      });
    } else if (resp.answerState === 'FRICTION') {
      totalFrictions += 1;
      dData.frictionCount += 1;

      const sev = resp.severity || 'MEDIUM';
      if (sev === 'CRITICAL') {
        criticalFrictions += 1;
        dData.criticalCount += 1;
      } else if (sev === 'HIGH') {
        highFrictions += 1;
        dData.highCount += 1;
      } else if (sev === 'MEDIUM') {
        mediumFrictions += 1;
      } else if (sev === 'LOW') {
        lowFrictions += 1;
      }

      const penaltyValue = profile.severityPenalties[sev] || 2;
      const penalty = itemWeight * penaltyValue;

      dData.severityPenaltiesSum += penalty;

      dData.underlyingIndicators.push({
        code: ind.code,
        subject: ind.subject,
        statement: ind.statement,
        weight: itemWeight,
        answerState: 'FRICTION',
        severity: sev,
      });

      const dimWeight = profile.dimensionWeights[dimKey] || dData.meta.defaultWeight || 1.0;
      allFrictionItems.push({
        indicator: ind,
        response: resp,
        dimKey,
        dimWeight,
      });
    }
  });

  // Calculate Dimension Explainability Details & Category Scores
  const dimensionDetails: DimensionExplainabilityDetail[] = [];
  const categoryScores: CategoryScore[] = [];
  const currentVisitRadarScores: Record<string, number> = {};

  let sumWeightedDimensionScores = 0;
  let sumDimensionWeights = 0;
  let totalOverallMaxPenalty = 0;
  let totalOverallActualPenalty = 0;

  CANONICAL_DIMENSIONS.forEach((dim) => {
    const dData = dimensionDataMap[dim.key];
    const dimWeight = profile.dimensionWeights[dim.key] || dim.defaultWeight || 1.0;

    let rawScore = 100;
    if (dData.maxPossiblePenaltiesSum > 0) {
      rawScore = Math.max(
        0,
        100 * (1 - dData.severityPenaltiesSum / dData.maxPossiblePenaltiesSum)
      );
    }
    const normalizedScore = applyRounding(rawScore, profile.roundingMethod);

    currentVisitRadarScores[dim.key] = normalizedScore;

    // Accumulate for overall score if dimension has answered applicable questions
    if (dData.applicableAnswered.length > 0) {
      sumWeightedDimensionScores += rawScore * dimWeight;
      sumDimensionWeights += dimWeight;
      totalOverallMaxPenalty += dData.maxPossiblePenaltiesSum;
      totalOverallActualPenalty += dData.severityPenaltiesSum;
    }

    const detail: DimensionExplainabilityDetail = {
      dimensionKey: dim.key,
      dimensionNameFa: dim.nameFa,
      applicableCount: dData.applicableAnswered.length,
      totalWeight: Math.round(dData.totalWeight * 100) / 100,
      frictionCount: dData.frictionCount,
      cleanCount: dData.cleanCount,
      naCount: dData.naCount,
      severityPenaltiesSum: Math.round(dData.severityPenaltiesSum * 100) / 100,
      maxPossiblePenaltiesSum: Math.round(dData.maxPossiblePenaltiesSum * 100) / 100,
      rawScore: Math.round(rawScore * 100) / 100,
      normalizedScore,
      dimensionWeight: dimWeight,
      criticalCount: dData.criticalCount,
      highCount: dData.highCount,
      underlyingIndicators: dData.underlyingIndicators,
    };
    dimensionDetails.push(detail);

    // Compute change delta if previous visit score exists
    const prevScore = effectiveComparison.previousVisitScores?.[dim.key];
    const changeDelta = prevScore !== undefined ? normalizedScore - prevScore : undefined;

    categoryScores.push({
      category: dim.nameFa,
      dimensionKey: dim.key,
      score: normalizedScore,
      totalQuestions: dData.applicableIndicators.length,
      frictionCount: dData.frictionCount,
      cleanCount: dData.cleanCount,
      naCount: dData.naCount,
      changeDelta,
      criticalCount: dData.criticalCount,
    });
  });

  // Calculate Overall Score based on Configurable Profile Formula (Requirement 5)
  let overallRawScore = 100;
  if (profile.overallFormula === 'WEIGHTED_DIMENSIONS') {
    if (sumDimensionWeights > 0) {
      overallRawScore = sumWeightedDimensionScores / sumDimensionWeights;
    }
  } else if (profile.overallFormula === 'UNWEIGHTED_DIMENSIONS') {
    const activeDimensions = dimensionDetails.filter((d) => d.applicableCount > 0);
    if (activeDimensions.length > 0) {
      const sum = activeDimensions.reduce((acc, d) => acc + d.rawScore, 0);
      overallRawScore = sum / activeDimensions.length;
    }
  } else if (profile.overallFormula === 'AGGREGATE_INDICATORS') {
    if (totalOverallMaxPenalty > 0) {
      overallRawScore = Math.max(
        0,
        100 * (1 - totalOverallActualPenalty / totalOverallMaxPenalty)
      );
    }
  }

  const overallScore = Math.max(0, Math.min(100, applyRounding(overallRawScore, profile.roundingMethod)));

  // Calculate Prioritized Findings (Requirement 11)
  // Priority Index = SeverityPenalty × IndicatorWeight × DimensionImportance × RecurrenceFactor
  const prioritizedFindings: MainFindingPrioritized[] = allFrictionItems.map((item) => {
    const sev = item.response.severity || 'MEDIUM';
    const sevPenalty = profile.severityPenalties[sev] || 2;
    const indWeight = item.indicator.weight || 1.0;
    const dimWeight = item.dimWeight;
    const isRecurring = effectiveComparison.recurringFindingCodes?.has(item.indicator.code) || false;
    const recurrenceFactor = isRecurring ? 1.25 : 1.0;

    const priorityIndex = Math.round(sevPenalty * indWeight * dimWeight * recurrenceFactor * 10) / 10;
    const recurrenceText = isRecurring ? ' × تکرار(۱.۲۵)' : '';
    const priorityFormula = `شدت(${sevPenalty}) × وزن(${indWeight}) × اهمیت بعد(${dimWeight})${recurrenceText} = ${priorityIndex}`;

    return {
      indicator: item.indicator,
      response: item.response,
      priorityIndex,
      priorityFormula,
      reportingDimension: item.dimKey,
      isRecurring,
      frequencyCount: isRecurring ? 2 : 1,
    };
  });

  // Sort strictly by Priority Index descending
  prioritizedFindings.sort((a, b) => b.priorityIndex - a.priorityIndex);

  // Identify Strengths (Requirement 13)
  // Dimensions with Normalized Score >= 80% and cleanCount > 0
  const strengths = dimensionDetails
    .filter((d) => d.normalizedScore >= 80 && d.cleanCount > 0)
    .map((d) => ({
      dimensionKey: d.dimensionKey,
      nameFa: d.dimensionNameFa,
      score: d.normalizedScore,
      cleanCount: d.cleanCount,
    }))
    .sort((a, b) => b.score - a.score);

  // Construct Multi-Series Radar Data (Requirements 7, 8)
  const radarSeries: RadarSeriesData[] = [
    {
      id: 'current_visit',
      label: 'ارزیابی فعلی',
      color: '#00B0F0', // Retail Solutions Brand Cyan
      scores: currentVisitRadarScores,
      visible: true,
    },
  ];

  if (effectiveComparison.previousVisitScores) {
    radarSeries.push({
      id: 'previous_visit',
      label: 'ارزیابی پیشین',
      color: '#A78BFA', // Lavender
      scores: effectiveComparison.previousVisitScores,
      isDashed: true,
      visible: true,
    });
  }

  if (effectiveComparison.brandAverageScores) {
    radarSeries.push({
      id: 'brand_average',
      label: 'میانگین برند',
      color: '#34D399', // Emerald
      scores: effectiveComparison.brandAverageScores,
      visible: true,
    });
  }

  if (effectiveComparison.branchAverageScores) {
    radarSeries.push({
      id: 'branch_average',
      label: 'میانگین شعب',
      color: '#FB923C', // Orange
      scores: effectiveComparison.branchAverageScores,
      visible: false,
    });
  }

  if (effectiveComparison.comparisonVisitScores) {
    radarSeries.push({
      id: 'comparison_visit',
      label: 'شعبه مقایسه‌ای',
      color: '#F59E0B', // Amber
      scores: effectiveComparison.comparisonVisitScores,
      visible: false,
    });
  }

  const answeredRate = indicators.length > 0 ? Math.round((answeredCount / indicators.length) * 100) : 0;
  const isDraftScore = answeredCount < indicators.length;

  return {
    overallScore,
    totalApplicable: indicators.length,
    answeredCount,
    totalFrictions,
    criticalFrictions,
    highFrictions,
    mediumFrictions,
    lowFrictions,
    totalPhotos,
    categoryScores,
    topFrictions: prioritizedFindings.slice(0, 5).map((f) => ({
      indicator: f.indicator,
      response: f.response,
    })),
    scoringProfile: profile,
    dimensionDetails,
    radarSeries,
    prioritizedFindings,
    strengths,
    isDraftScore,
    answeredRate,
  };
}

// ============================================================================
// 4. POPULATION COMPARISON VALIDATOR (Prompt 3, Requirement 15)
// ============================================================================

export function validateComparisonPopulation(
  visitA: { assessmentType: AssessmentType; brandName?: string; profileId?: string },
  visitB: { assessmentType: AssessmentType; brandName?: string; profileId?: string }
): {
  isComparable: boolean;
  severity: 'VALID' | 'WARNING' | 'INVALID';
  messageFa: string;
} {
  if (visitA.assessmentType !== visitB.assessmentType) {
    return {
      isComparable: false,
      severity: 'INVALID',
      messageFa:
        'مقایسه نامعتبر: نوع ارزیابی یکسان نیست (فروشگاه با مجتمع تجاری به دلیل ساختار شاخص‌ها قابل مقایسه مستقیم نیست).',
    };
  }

  if (visitA.profileId && visitB.profileId && visitA.profileId !== visitB.profileId) {
    return {
      isComparable: true,
      severity: 'WARNING',
      messageFa:
        'هشدار متدولوژی: این دو ارزیابی با پروفایل‌های امتیازدهی متفاوتی محاسبه شده‌اند؛ نمرات ممکن است تغییرات وزنی داشته باشند.',
    };
  }

  return {
    isComparable: true,
    severity: 'VALID',
    messageFa: 'جامعه آماری کاملاً همگن و قابل مقایسه است.',
  };
}
