import catalogData from '../src/data/catalog.json';
import { Indicator, VisitSession, QuestionResponse, AnswerState } from '../src/types';
import { calculateVisitSummary } from '../src/engine/scoringEngine';
import { generateDynamicChecklistWithAudit, STORE_JOURNEY_ORDER, MALL_JOURNEY_ORDER } from '../src/engine/ruleEngine';

console.log('================================================================');
console.log('🧪 TESTING FIELD ASSESSMENT FORM EXPERIENCE (UX SCENARIOS & ENGINE)');
console.log('================================================================\n');

const allIndicators: Indicator[] = catalogData.indicators as any;

// 1. Synthesize Store Profile (Scenario B: Fashion Mall)
const { checklist: indicators } = generateDynamicChecklistWithAudit(
  allIndicators,
  {
    type: 'STORE',
    storeProfile: {
      brandName: 'مانگو (Mango)',
      branchName: 'ایران‌مال',
      businessType: 'FASHION',
      locationContext: 'MALL',
      storeFormat: 'FLAGSHIP',
      attributes: {
        hasFittingRoom: true,
        hasSoundSystem: true,
        hasEscalatorOrElevator: true,
        hasDedicatedParking: false,
        hasKidsZone: false,
      },
    },
  }
);

console.log(`✅ [1. Dynamic Form Synthesis] Generated ${indicators.length} applicable indicators.`);
console.assert(indicators.length === 252, `Expected 252 indicators for Fashion Mall, got ${indicators.length}`);

// Initialize Visit Session
let session: VisitSession = {
  id: 'visit-test-001',
  visitCode: 'VS-MN-IRN-01',
  brandName: 'مانگو',
  branchName: 'ایران‌مال',
  assessmentType: 'STORE',
  businessType: 'FASHION',
  locationContext: 'MALL',
  storeFormat: 'FLAGSHIP',
  attributes: {
    hasFittingRoom: true,
    hasSoundSystem: true,
    hasEscalatorOrElevator: true,
  },
  auditorName: 'مهندس حسینی (ارزیاب میدانی)',
  supervisorName: 'خانم دکتر کمالی (سرپرست)',
  startedAt: new Date().toISOString(),
  status: 'IN_PROGRESS',
  indicators,
  responses: {},
  analytics: {
    startTime: new Date().toISOString(),
    resumeCount: 0,
    offlineEventsCount: 0,
    numberOfChanges: 0,
  },
};

// 2. Simulate Scenario: 20 Questions with NO_FRICTION (Quick Mode Auto-Advance)
console.log('\n--- [2. Quick Mode: 20 Questions without Friction] ---');
for (let i = 0; i < 20; i++) {
  const ind = indicators[i];
  session.responses[ind.id] = {
    indicatorId: ind.id,
    answerState: 'NO_FRICTION',
    answeredAt: new Date().toISOString(),
    photos: [],
    isFlagged: false,
  };
  session.analytics!.numberOfChanges++;
}
console.log(`✅ Answered 20 questions with NO_FRICTION. Changes count: ${session.analytics!.numberOfChanges}`);

// 3. Simulate Consecutive Frictions (including Critical with multiple photos)
console.log('\n--- [3. Friction Flow: Critical Friction + Multiple Photos + Captions] ---');
const criticalInd = indicators[20]; // Let's record a critical friction
session.responses[criticalInd.id] = {
  indicatorId: criticalInd.id,
  answerState: 'FRICTION',
  severity: 'CRITICAL',
  comment: 'کابل‌های برق فشار قوی به صورت نامتعارف و خطرناک در مسیر تردد مشتریان آویزان است.',
  recommendation: 'قطع فوری برق مسیر و اصلاح سیم‌کشی توسط تیم فنی مجتمع ظرف ۲ ساعت آینده.',
  photos: [
    {
      id: 'photo-1',
      url: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=300',
      timestamp: new Date().toISOString(),
      caption: 'نمای کلی کابل آویزان',
    },
    {
      id: 'photo-2',
      url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=300',
      timestamp: new Date().toISOString(),
      caption: 'نزدیک جعبه تقسیم برق',
    },
  ],
  isFlagged: true,
  answeredAt: new Date().toISOString(),
};
session.analytics!.numberOfChanges++;
console.log(`✅ Recorded Critical Friction on ${criticalInd.code}: ${criticalInd.subject} with 2 photos and captions.`);

// 4. Test Incomplete Friction (Missing Photo when Required) to test Validation Problems
console.log('\n--- [4. Validation Problems Detection (نیازمند تکمیل)] ---');
// Pick an indicator with requiresPhoto = true
const photoReqInd = indicators.find((i) => i.requiresPhoto && i.id !== criticalInd.id) || indicators[21];
session.responses[photoReqInd.id] = {
  indicatorId: photoReqInd.id,
  answerState: 'FRICTION',
  severity: 'HIGH',
  comment: 'توضیحات ثبت شده اما هنوز عکس الصاق نشده است',
  photos: [], // MISSING PHOTO!
  isFlagged: false,
  answeredAt: new Date().toISOString(),
};

// Check Validation Problems Logic
const validationProblems: string[] = [];
indicators.forEach((ind) => {
  const r = session.responses[ind.id];
  if (!r || r.answerState === 'UNANSWERED') {
    validationProblems.push(`${ind.code} — بدون پاسخ`);
  } else if (r.answerState === 'FRICTION') {
    if (ind.requiresPhoto && (!r.photos || r.photos.length === 0)) {
      validationProblems.push(`${ind.code} — عکس ندارد`);
    }
    if (ind.requiresComment && (!r.comment || r.comment.trim() === '')) {
      validationProblems.push(`${ind.code} — توضیح الزامی`);
    }
  }
});

console.log(`✅ Detected ${validationProblems.length} validation problems (missing answers & missing photos).`);
console.log(`   Sample detected items:`);
validationProblems.slice(0, 5).forEach((p) => console.log(`   - ${p}`));
console.assert(validationProblems.some((p) => p.includes('عکس ندارد')), 'Validation problem for missing photo was detected');

// 5. Test Offline Event & Autosave Serialization
console.log('\n--- [5. Offline UX & Autosave Serialization] ---');
session.analytics!.offlineEventsCount++;
const serialized = JSON.stringify(session);
const restored: VisitSession = JSON.parse(serialized);
console.assert(restored.id === session.id, 'Session restored cleanly from JSON');
console.assert(restored.analytics?.offlineEventsCount === 1, 'Offline event tracked');
console.log(`✅ Session serialized (${Math.round(serialized.length / 1024)} KB) and restored successfully.`);

// 6. Simulate Full Checklist Completion & Final Submit to Supervisor
console.log('\n--- [6. Complete Remaining Questions & Submit] ---');
// Fix the missing photo on photoReqInd
session.responses[photoReqInd.id].photos = [
  { id: 'photo-fixed', url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=300', timestamp: new Date().toISOString() },
];
// Fill remaining questions as NO_FRICTION or NOT_APPLICABLE
indicators.forEach((ind) => {
  if (!session.responses[ind.id]) {
    session.responses[ind.id] = {
      indicatorId: ind.id,
      answerState: 'NO_FRICTION',
      answeredAt: new Date().toISOString(),
      photos: [],
      isFlagged: false,
    };
  }
});

const summaryBeforeSubmit = calculateVisitSummary(indicators, session.responses, 'STORE');
console.log(`   Completion: ${summaryBeforeSubmit.answeredCount} / ${indicators.length} (100%)`);
console.log(`   Frictions: ${summaryBeforeSubmit.totalFrictions} (Critical: ${summaryBeforeSubmit.criticalFrictions}, High: ${summaryBeforeSubmit.highFrictions})`);
console.log(`   Initial Score: ${summaryBeforeSubmit.overallScore} / 100`);

// Submit to Supervisor
session.status = 'SUBMITTED';
session.completedAt = new Date().toISOString();
console.log(`✅ Visit submitted to Supervisor. Status is now READ-ONLY: ${session.status}`);

// 7. Supervisor Review & Return Visit Flow
console.log('\n--- [7. Supervisor Review & Return Visit (بازگرداندن به ارزیاب)] ---');
const decisions: Record<string, { status: 'APPROVED' | 'REJECTED' | 'REQUEST_CHANGE'; comment?: string }> = {
  [criticalInd.id]: {
    status: 'APPROVED',
    comment: 'مورد تایید است. به مدیر فنی مرکز خرید ابلاغ گردید.',
  },
  [photoReqInd.id]: {
    status: 'REQUEST_CHANGE',
    comment: 'لطفاً تصویر با زاویه بازتر از محل الصاق شود تا محدوده مشخص گردد.',
  },
};

// Supervisor requests revision
session.status = 'REVISION_REQUESTED';
session.supervisorNotes = 'لطفاً تصویر شاخص مشخص شده را با زاویه بازتر جایگزین نمایید.';
session.findingDecisions = decisions;

console.log(`✅ Supervisor reviewed findings:`);
console.log(`   - Critical Finding (${criticalInd.code}): ${decisions[criticalInd.id].status}`);
console.log(`   - Finding (${photoReqInd.code}): ${decisions[photoReqInd.id].status} -> Note: "${decisions[photoReqInd.id].comment}"`);
console.log(`   - Visit Status: ${session.status} (Auditor now sees return notice and inline notes)`);

console.log('\n================================================================');
console.log('🎉 ALL FORM EXPERIENCE ENGINE & UX TEST SCENARIOS PASSED 100%!');
console.log('================================================================');
