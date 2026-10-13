/*
 * FR model checks against the reference workbook ("Nima - FR"):
 * Per Store zone table and the Total Business denominator.
 * Run: npm run test:fr
 */
import assert from 'node:assert/strict';
import type { Indicator, QuestionResponse, VisitSession } from '../src/types';
import { computeBrandFrictionRates, computeStoreFrictionRate, topFrictionTopics } from '../src/engine/frModel';

let n = 0;
const indicators: Indicator[] = [];
const responses: Record<string, QuestionResponse> = {};

/** Adds `total` indicators to a zone/topic: `fr` frictions, `na` not applicable, the rest clean. */
function add(group: string, subject: string, total: number, fr: number, na: number) {
  for (let i = 0; i < total; i++) {
    const id = `i${++n}`;
    indicators.push({
      id, code: id, template: 'STORE', group, subject, statement: '', journeyStage: '', weight: 1,
      requiresPhoto: false, requiresComment: false, displayOrder: n, applicableBusinessTypes: [], applicableMallTypes: [],
    });
    const answerState = i < fr ? 'FRICTION' : i < fr + na ? 'NOT_APPLICABLE' : 'NO_FRICTION';
    responses[id] = { indicatorId: id, answerState, photos: [], isFlagged: false };
  }
}

// Per Store sheet: Indicators / FR / N/A per zone.
add('FLOOR', 'تابلوی سر در', 10, 5, 1);
add('FLOOR', 'ویترین', 83, 30, 21);
add('SERVICES', 'خدمات', 26, 7, 8);
add('TEAM', 'تیم', 34, 9, 4);
add('PRODUCT', 'محصول', 18, 3, 8);
add('CASH', 'صندوق', 20, 0, 5);

const store = computeStoreFrictionRate(indicators, responses);
const zone = (g: string) => store.zones.find((z) => z.group === g)!;
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 5e-4, `${a} ≈ ${b}`);

close(zone('FLOOR').rate, 35 / (93 - 22)); // 0.4930
close(zone('SERVICES').rate, 7 / (26 - 8)); // 0.3889
close(zone('TEAM').rate, 9 / (34 - 4)); // 0.30
close(zone('PRODUCT').rate, 3 / (18 - 8)); // 0.30
assert.equal(zone('CASH').rate, 0);
assert.deepEqual(store.zones.map((z) => z.group), ['FLOOR', 'SERVICES', 'TEAM', 'PRODUCT', 'CASH'], 'highest first');
assert.equal(store.total.indicators, 191);
assert.equal(store.total.frictions, 54);
assert.equal(store.total.notApplicable, 47);
close(store.total.rate, 54 / (191 - 47)); // Total Business: 54 / (191 − 47)

// Topic rate uses the topic's own indicators: 5 / (10 − 1), not 5 / (93 − 1).
const sign = store.topics.find((t) => t.subject === 'تابلوی سر در')!;
close(sign.rate, 5 / 9);
const top = topFrictionTopics(store, 10);
assert.equal(top[0].subject, 'تابلوی سر در');
assert.ok(top.every((t) => t.frictions > 0));
assert.ok(top.every((t, i) => i === 0 || top[i - 1].rate >= t.rate), 'sorted descending');

// Branches: latest finished visit per branch, sorted highest first.
const visit = (id: string, branchName: string, at: string, fr: number, status = 'APPROVED'): VisitSession =>
  ({
    id, brandName: 'Opal', branchName, status, startedAt: at, completedAt: at,
    indicators: indicators.slice(0, 10),
    responses: Object.fromEntries(indicators.slice(0, 10).map((ind, i) => [ind.id, {
      indicatorId: ind.id, answerState: i < fr ? 'FRICTION' : 'NO_FRICTION', photos: [], isFlagged: false,
    }])),
  }) as unknown as VisitSession;

const branches = computeBrandFrictionRates('Opal', [
  visit('a1', 'A', '2026-01-01', 1),
  visit('a2', 'A', '2026-02-01', 5),
  visit('b1', 'B', '2026-01-15', 8),
  visit('c1', 'C', '2026-01-15', 9, 'IN_PROGRESS'),
  { ...visit('x1', 'X', '2026-01-15', 9), brandName: 'Other' } as VisitSession,
]);
assert.deepEqual(branches.map((b) => [b.branchName, b.visitId]), [['B', 'b1'], ['A', 'a2']]);
close(branches[0].rate, 0.8);

console.log('FR model: all checks passed');
