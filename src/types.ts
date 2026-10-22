export type AssessmentType = 'STORE' | 'MALL';

export type BusinessTypeCode =
  | 'Fashion'
  | 'Shoe_Bag'
  | 'Watch_Jewelry'
  | 'FMCG'
  | 'F_B'
  | 'Hardware'
  | 'Homeware'
  | 'Beauty_Cosmetics'
  | 'Electronics'
  | 'Entertainment'
  | 'Sports'
  | 'Specialty'
  | 'Services';

export type LocationContextCode =
  | 'STREET_STORE'
  | 'MALL_STORE'
  | 'FOOD_COURT'
  | 'STANDALONE'
  | 'SHOP_IN_SHOP'
  | 'KIOSK';

export type StoreFormatCode =
  | 'FLAGSHIP'
  | 'CHAIN'
  | 'BOUTIQUE'
  | 'KIOSK'
  | 'SHOP_IN_SHOP';

export type MallTypeCode =
  | 'SM'
  | 'Neighborhood'
  | 'Community'
  | 'Regional'
  | 'Super_Regional';

export interface StoreAttributes {
  has_window_display?: boolean;
  has_fitting_room?: boolean;
  has_mannequins?: boolean;
  has_elevator?: boolean;
  has_stairs?: boolean;
  has_parking?: boolean;
  has_customer_toilet?: boolean;
  has_checkout_counter?: boolean;
  has_food_service?: boolean;
  has_anti_theft_gate?: boolean;
  // Compatibility with camelCase
  hasFittingRoom?: boolean;
  hasShowcase?: boolean;
  hasMannequins?: boolean;
  hasElevator?: boolean;
  hasParking?: boolean;
  hasCustomerToilet?: boolean;
  [key: string]: boolean | string | number | undefined;
}

export interface StoreProfile {
  assessmentType: 'STORE';
  businessType: BusinessTypeCode;
  locationContext: LocationContextCode;
  storeFormat?: StoreFormatCode;
  brand?: string;
  branch?: string;
  attributes: StoreAttributes;
}

export interface MallProfile {
  assessmentType: 'MALL';
  mallType: MallTypeCode;
  locationContext?: LocationContextCode;
  brand?: string;
  branch?: string;
  attributes?: StoreAttributes;
}

export type AssessmentProfile = StoreProfile | MallProfile;

export interface SavedStoreDirectoryItem {
  id: string;
  brandName: string;
  branchName: string;
  assessmentType: AssessmentType;
  businessType?: BusinessTypeCode;
  locationContext: LocationContextCode;
  storeFormat?: StoreFormatCode;
  mallType?: MallTypeCode;
  attributes: StoreAttributes;
  auditorName?: string;
  supervisorName?: string;
  address?: string;
  city?: string;
  lastVisitedAt?: string;
  createdAt: string;
}

export type IndicatorStatus = 'DRAFT' | 'NEEDS_REVIEW' | 'ACTIVE' | 'ARCHIVED';

export interface Indicator {
  id: string;
  code: string;
  template: AssessmentType;
  group: string;
  subject: string;
  statement: string;
  originalText?: string;
  journeyStage: string;
  reportingDimension?: string;
  weight: number;
  status?: IndicatorStatus;
  version?: number;
  requiresPhoto: boolean;
  requiresComment: boolean;
  /** A note for the auditor, from the checklist or written in the question bank. */
  auditorNote?: string;
  /** True when this row's wording or note was changed from the checklist's. */
  edited?: boolean;
  displayOrder: number;
  needsReview?: boolean;
  applicableBusinessTypes: string[];
  applicableMallTypes: string[];
}

export type AnswerState =
  | 'NO_FRICTION'
  | 'FRICTION'
  | 'NOT_APPLICABLE'
  | 'UNANSWERED'
  | 'POSITIVE_REWARD'
  | 'NEUTRAL';

export type ObservationType = 'FRICTION' | 'REWARD' | 'NEUTRAL';

export type RuleType =
  | 'APPLICABILITY'
  | 'EXCLUSION'
  | 'DEPENDENCY'
  | 'REQUIREMENT'
  | 'SCORING';

export type RuleSource = 'IMPORTED' | 'MANUAL' | 'DERIVED' | 'SYSTEM';
export type RuleStatus = 'DRAFT' | 'NEEDS_REVIEW' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';
export type RuleEffect =
  | 'INCLUDE'
  | 'EXCLUDE'
  | 'MAKE_REQUIRED'
  | 'MAKE_OPTIONAL'
  | 'AUTO_NA'
  | 'SHOW_DEPENDENT'
  | 'HIDE_DEPENDENT';

export interface Rule {
  id: string;
  name: string;
  ruleType: RuleType;
  ruleSource: RuleSource;
  status: RuleStatus;
  priority: number;
  conditions: Record<string, any>;
  effect: RuleEffect;
  reason: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

export interface RuleExplanationTrace {
  ruleId: string;
  ruleName: string;
  ruleType: RuleType;
  ruleSource: RuleSource;
  status: RuleStatus;
  priority: number;
  decision: 'INCLUDED' | 'EXCLUDED' | 'AUTO_NA';
  reason: string;
}

export interface IndicatorExplanation {
  indicatorCode: string;
  indicatorStatement: string;
  baseApplicability: {
    isApplicable: boolean;
    source: string;
    ruleId: string;
    reason: string;
  };
  contextRulesEvaluated: RuleExplanationTrace[];
  finalResult: 'INCLUDED' | 'EXCLUDED';
  formattedExplanation: string;
}

export type SeverityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface EvidencePhoto {
  id: string;
  url: string;
  caption?: string;
  timestamp: string;
}

export interface QuestionResponse {
  indicatorId: string;
  answerState: AnswerState;
  observationType?: ObservationType;
  severity?: SeverityLevel;
  comment?: string;
  recommendation?: string;
  photos: EvidencePhoto[];
  isFlagged: boolean;
  answeredAt?: string;
}

export type VisitStatus =
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REVISION_REQUESTED';

export interface VisitSession {
  id: string;
  visitCode: string;
  brandName: string;
  branchName: string;
  assessmentType: AssessmentType;
  businessType?: BusinessTypeCode;
  locationContext: LocationContextCode;
  storeFormat?: StoreFormatCode;
  mallType?: MallTypeCode;
  attributes: StoreAttributes;
  auditorName: string;
  /** Evaluator code, stamped by the server from the author's account. */
  evaluatorCode?: string | null;
  supervisorName: string;
  startedAt: string;
  completedAt?: string;
  status: VisitStatus;
  indicators: Indicator[];
  responses: Record<string, QuestionResponse>;
  overallScore?: number;
  supervisorNotes?: string;
  findingDecisions?: Record<
    string,
    {
      status: 'APPROVED' | 'REJECTED' | 'REQUEST_CHANGE';
      comment?: string;
    }
  >;
  analytics?: {
    startTime: string;
    endTime?: string;
    lastActivityAt?: string;
    resumeCount: number;
    offlineEventsCount: number;
    numberOfChanges: number;
  };
}

export interface CategoryScore {
  category: string;
  dimensionKey?: string;
  score: number;
  totalQuestions: number;
  frictionCount: number;
  cleanCount: number;
  naCount: number;
  changeDelta?: number;
  criticalCount?: number;
}

export type ScoringFormulaType =
  | 'WEIGHTED_DIMENSIONS'
  | 'UNWEIGHTED_DIMENSIONS'
  | 'AGGREGATE_INDICATORS';

export type RoundingMethod = 'ROUND' | 'FLOOR' | 'CEIL';

export interface ScoringProfile {
  id: string;
  name: string;
  version: number;
  severityPenalties: Record<SeverityLevel, number>;
  indicatorWeighting: 'EQUAL' | 'CUSTOM' | 'EXPONENTIAL';
  dimensionWeights: Record<string, number>;
  overallFormula: ScoringFormulaType;
  roundingMethod: RoundingMethod;
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
  description?: string;
}

export interface DimensionExplainabilityDetail {
  dimensionKey: string;
  dimensionNameFa: string;
  applicableCount: number;
  totalWeight: number;
  frictionCount: number;
  cleanCount: number;
  naCount: number;
  severityPenaltiesSum: number;
  maxPossiblePenaltiesSum: number;
  rawScore: number;
  normalizedScore: number;
  dimensionWeight: number;
  criticalCount: number;
  highCount: number;
  underlyingIndicators: {
    code: string;
    subject: string;
    statement: string;
    weight: number;
    answerState: AnswerState;
    severity?: SeverityLevel;
  }[];
}

export interface RadarSeriesData {
  id: string;
  label: string;
  color: string;
  scores: Record<string, number>;
  isDashed?: boolean;
  visible: boolean;
}

export interface MainFindingPrioritized {
  indicator: Indicator;
  response: QuestionResponse;
  priorityIndex: number;
  priorityFormula: string;
  reportingDimension: string;
  isRecurring?: boolean;
  frequencyCount?: number;
  supervisorStatus?: 'APPROVED' | 'REJECTED' | 'REQUEST_CHANGE' | 'PENDING';
}

export interface VisitReportSummary {
  overallScore: number;
  totalApplicable: number;
  answeredCount: number;
  totalFrictions: number;
  criticalFrictions: number;
  highFrictions: number;
  mediumFrictions: number;
  lowFrictions: number;
  totalPhotos: number;
  categoryScores: CategoryScore[];
  topFrictions: {
    indicator: Indicator;
    response: QuestionResponse;
  }[];
  scoringProfile?: ScoringProfile;
  dimensionDetails?: DimensionExplainabilityDetail[];
  radarSeries?: RadarSeriesData[];
  prioritizedFindings?: MainFindingPrioritized[];
  strengths?: {
    dimensionKey: string;
    nameFa: string;
    score: number;
    cleanCount: number;
  }[];
  isDraftScore?: boolean;
  answeredRate?: number;
}

export interface IndicatorDiffDetail {
  code: string;
  reason: string;
  ruleId: string;
  ruleSource: RuleSource;
}

export interface ScenarioDiffResult {
  scenarioA: string;
  scenarioB: string;
  sharedCodes: string[];
  onlyInA: IndicatorDiffDetail[];
  onlyInB: IndicatorDiffDetail[];
  differentRequirements: { code: string; reqA: any; reqB: any }[];
  differentWeights: { code: string; weightA: number; weightB: number }[];
}

export interface ValidationItem {
  code: string;
  message: string;
  context?: any;
}

export interface ValidationSummary {
  errors: ValidationItem[];
  warnings: ValidationItem[];
  infos: ValidationItem[];
  isValid: boolean;
}

export interface FormGenerationAuditTrail {
  visitId?: string;
  profileSnapshot: AssessmentProfile;
  rulesEvaluated: RuleExplanationTrace[];
  selectedIndicators: string[];
  excludedIndicators: { code: string; ruleId: string; reason: string }[];
  conflictsLogged: { ruleA: string; ruleB: string; resolvedPriority: number; outcome: string }[];
  generatedAt: string;
}

// ============================================================================
// PROMPT 4: CORRECTIVE ACTIONS, REVISIT COMPARISON & CONTINUOUS IMPROVEMENT
// ============================================================================

export type CorrectiveActionStatus =
  | 'OPEN'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'WAITING_REVIEW'
  | 'RESOLVED'
  | 'VERIFIED'
  | 'REOPENED'
  | 'CANCELLED';

export type CorrectiveActionPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ActionDepartment =
  | 'Branch Manager'
  | 'Operations'
  | 'Maintenance'
  | 'Marketing'
  | 'HR'
  | 'IT'
  | 'Other';

export type RootCauseCategory =
  | 'PROCESS'
  | 'PEOPLE'
  | 'EQUIPMENT'
  | 'FACILITY'
  | 'TRAINING'
  | 'POLICY'
  | 'TECHNOLOGY'
  | 'OTHER';

export type UserRole =
  | 'Evaluator'
  | 'Supervisor'
  | 'Manager'
  | 'Owner'
  | 'Verifier'
  | 'Admin';

export interface Tenant {
  id: string;
  name: string;
  code: string;
  brands: string[];
  isActive: boolean;
  createdAt: string;
}

export interface ReopenComment {
  id: string;
  comment: string;
  reopenedBy: string;
  timestamp: string;
}

export interface CorrectiveAction {
  id: string;
  tenantId?: string;
  findingId: string;
  indicatorCode: string;
  visitId: string;
  branchId: string;
  branchName: string;
  brandName: string;
  title: string;
  description: string;
  priority: CorrectiveActionPriority;
  status: CorrectiveActionStatus;
  owner?: string;
  department: ActionDepartment;
  dueDate: string;
  rootCause?: RootCauseCategory;
  beforePhotos: EvidencePhoto[];
  afterPhotos: EvidencePhoto[];
  resolutionNote?: string;
  completionDate?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  verificationNote?: string;
  reopenCount: number;
  reopenComments: ReopenComment[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActionAuditLog {
  id: string;
  actionId: string;
  who: string;
  userRole: UserRole;
  what: string;
  fromStatus: string;
  toStatus: string;
  details?: Record<string, any>;
  timestamp: string;
}

export interface ActionAnalyticsSummary {
  totalActions: number;
  openActions: number;
  overdueActions: number;
  criticalActions: number;
  resolvedActions: number;
  awaitingVerificationActions: number;
  verifiedActions: number;
  resolutionRate: number; // percentage 0-100
  medianResolutionHours: number;
  overdueRate: number; // percentage 0-100
  recurrenceRate: number; // percentage 0-100
  criticalResolutionRate: number; // percentage 0-100
}

export type ComparisonChangeClass =
  | 'IMPROVED'
  | 'UNCHANGED'
  | 'WORSENED'
  | 'NEW_FRICTION'
  | 'RESOLVED_FRICTION'
  | 'NOT_COMPARABLE';

export interface IndicatorComparisonItem {
  indicatorCode: string;
  indicatorSubject: string;
  indicatorStatement: string;
  previousVisitId: string;
  previousVisitDate: string;
  previousAnswerState: AnswerState;
  previousSeverity?: SeverityLevel;
  currentVisitId: string;
  currentVisitDate: string;
  currentAnswerState: AnswerState;
  currentSeverity?: SeverityLevel;
  changeClass: ComparisonChangeClass;
  isRecurring: boolean;
  versionCompatible: boolean;
  previousVersion?: number;
  currentVersion?: number;
  revisitNotes?: string;
}

export interface BranchHistoricalSummary {
  branchId: string;
  branchName: string;
  brandName: string;
  initialScore: number;
  currentScore: number;
  scoreDelta: number;
  resolvedFrictionsCount: number;
  newFrictionsCount: number;
  recurringFrictionsCount: number;
  openActionsCount: number;
  overdueActionsCount: number;
  visitsCount: number;
  visitsHistory: {
    visitId: string;
    visitCode: string;
    date: string;
    overallScore: number;
    frictionCount: number;
    resolvedCount: number;
  }[];
}

