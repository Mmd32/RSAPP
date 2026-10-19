import type { Indicator, QuestionResponse, VisitSession } from '../types';

/*
 * Friction Rate (FR) model.
 *
 * For any slice of a visit's indicators (a zone, a topic, the whole store):
 *
 *   F% = FR / (Indicators − N/A)
 *
 * where Indicators is the number of indicators examined in that slice, FR the
 * number answered "friction" and N/A the number answered "not applicable".
 * The denominator always belongs to the same slice: a topic's rate divides by
 * that topic's own indicators, a store's total by every indicator examined
 * in the store across all zones.
 */

export interface FrictionRateRow {
  key: string;
  /** Zone (indicator group) this row belongs to; for zone rows it equals key. */
  group: string;
  /** Topic (indicator subject); empty for zone and store rows. */
  subject: string;
  indicators: number;
  frictions: number;
  notApplicable: number;
  /** Indicators left unanswered; they stay in the denominator, as in the formula. */
  unanswered: number;
  /** FR / (Indicators − N/A), 0–1. Zero when nothing in the slice is assessable. */
  rate: number;
}

export interface StoreFrictionRate {
  zones: FrictionRateRow[];
  topics: FrictionRateRow[];
  total: FrictionRateRow;
}

function emptyRow(key: string, group: string, subject: string): FrictionRateRow {
  return { key, group, subject, indicators: 0, frictions: 0, notApplicable: 0, unanswered: 0, rate: 0 };
}

function count(row: FrictionRateRow, response: QuestionResponse | undefined) {
  row.indicators += 1;
  const state = response?.answerState;
  if (state === 'FRICTION') row.frictions += 1;
  else if (state === 'NOT_APPLICABLE') row.notApplicable += 1;
  else if (!state || state === 'UNANSWERED') row.unanswered += 1;
}

function finish(row: FrictionRateRow): FrictionRateRow {
  const assessable = row.indicators - row.notApplicable;
  row.rate = assessable > 0 ? row.frictions / assessable : 0;
  return row;
}

/** Sort rows by rate, highest first; ties go to the slice with more frictions. */
export function byRateDesc(a: FrictionRateRow, b: FrictionRateRow): number {
  return b.rate - a.rate || b.frictions - a.frictions || a.key.localeCompare(b.key, 'fa');
}

export interface FrictionSource {
  indicators: Indicator[];
  responses: Record<string, QuestionResponse>;
}

/**
 * FR tables for one store or, given several stores, for the whole business:
 * counts are summed per zone and per topic across every source before the
 * rate is taken, so each denominator still belongs to its own slice.
 */
export function computeFrictionRate(sources: FrictionSource[]): StoreFrictionRate {
  const zones = new Map<string, FrictionRateRow>();
  const topics = new Map<string, FrictionRateRow>();
  const total = emptyRow('TOTAL', '', '');

  for (const { indicators, responses } of sources) {
    for (const indicator of indicators || []) {
      const group = indicator.group || '—';
      const subject = indicator.subject || '—';
      const response = responses?.[indicator.id];

      if (!zones.has(group)) zones.set(group, emptyRow(group, group, ''));
      const topicKey = `${group}::${subject}`;
      if (!topics.has(topicKey)) topics.set(topicKey, emptyRow(topicKey, group, subject));

      count(zones.get(group)!, response);
      count(topics.get(topicKey)!, response);
      count(total, response);
    }
  }

  return {
    zones: [...zones.values()].map(finish).sort(byRateDesc),
    topics: [...topics.values()].map(finish).sort(byRateDesc),
    total: finish(total),
  };
}

export function computeStoreFrictionRate(
  indicators: Indicator[],
  responses: Record<string, QuestionResponse>,
): StoreFrictionRate {
  return computeFrictionRate([{ indicators, responses }]);
}

/** The highest-friction topics of a store, highest first. Topics without friction are left out. */
export function topFrictionTopics(rate: StoreFrictionRate, limit = 10, group?: string): FrictionRateRow[] {
  return rate.topics.filter((t) => t.frictions > 0 && (!group || t.group === group)).slice(0, limit);
}

export interface BranchFrictionRate extends FrictionRateRow {
  branchName: string;
  visitId: string;
  visitDate: string;
}

/**
 * One row per branch of a brand, from each branch's most recent finished
 * visit (the visit being viewed stands in for its own branch). The store
 * total is used: every indicator examined in that store across all zones.
 */
/** Visits that count as finished for reporting. */
export function isFinishedVisit(v: VisitSession): boolean {
  return (v.status === 'SUBMITTED' || v.status === 'APPROVED') && !!v.indicators?.length;
}

/** Each branch's most recent finished visit of a brand; `current` stands in for its own branch. */
export function latestVisitPerBranch(brandName: string, visits: VisitSession[], current?: VisitSession): VisitSession[] {
  const latest = new Map<string, VisitSession>();
  const finished = visits.filter((v) => v.brandName === brandName && isFinishedVisit(v));
  for (const v of finished) {
    const at = v.completedAt || v.startedAt || '';
    const prev = latest.get(v.branchName);
    if (!prev || at > (prev.completedAt || prev.startedAt || '')) latest.set(v.branchName, v);
  }
  if (current && current.brandName === brandName && current.indicators?.length) {
    latest.set(current.branchName, current);
  }
  return [...latest.values()];
}

export function computeBrandFrictionRates(
  brandName: string,
  visits: VisitSession[],
  current?: VisitSession,
): BranchFrictionRate[] {
  return latestVisitPerBranch(brandName, visits, current)
    .map((v) => {
      const { total } = computeStoreFrictionRate(v.indicators, v.responses);
      return {
        ...total,
        key: v.branchName,
        branchName: v.branchName,
        visitId: v.id,
        visitDate: v.completedAt || v.startedAt,
      };
    })
    .sort(byRateDesc);
}
