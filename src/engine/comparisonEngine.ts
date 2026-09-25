import {
  VisitSession,
  IndicatorComparisonItem,
  ComparisonChangeClass,
  BranchHistoricalSummary,
  ActionAnalyticsSummary,
  CorrectiveAction,
  QuestionResponse,
} from '../types';
import { getVisitScore } from './scoringEngine';

/**
 * Historical Revisit Comparison Engine
 * Evaluates indicator state transitions across visits, version compatibility,
 * recurring friction patterns, and branch score evolution.
 */
export class ComparisonEngine {
  /**
   * Compares two visits for the same branch
   */
  static compareVisits(
    previousVisit: VisitSession,
    currentVisit: VisitSession
  ): {
    items: IndicatorComparisonItem[];
    resolvedCount: number;
    newFrictionCount: number;
    recurringCount: number;
    scoreDelta: number;
    improvedCount: number;
    worsenedCount: number;
  } {
    const items: IndicatorComparisonItem[] = [];
    const prevResponses = previousVisit.responses || {};
    const currResponses = currentVisit.responses || {};

    // Collect all indicators from current visit
    const currIndicators = currentVisit.indicators || [];
    const prevIndicatorsMap = new Map(
      (previousVisit.indicators || []).map((i) => [i.code, i])
    );

    let resolvedCount = 0;
    let newFrictionCount = 0;
    let recurringCount = 0;
    let improvedCount = 0;
    let worsenedCount = 0;

    for (const currInd of currIndicators) {
      const code = currInd.code;
      const prevInd = prevIndicatorsMap.get(code);

      const prevResp: QuestionResponse | undefined = prevResponses[currInd.id] ||
        Object.values(prevResponses).find((r: any) => r.indicatorCode === code);
      const currResp: QuestionResponse | undefined = currResponses[currInd.id];

      const prevAns = prevResp?.answerState || 'UNANSWERED';
      const currAns = currResp?.answerState || 'UNANSWERED';

      // Version compatibility check (Requirement 16)
      const prevVer = prevInd?.version || 1;
      const currVer = currInd.version || 1;
      const versionCompatible = prevVer === currVer;

      let changeClass: ComparisonChangeClass = 'UNCHANGED';
      let isRecurring = false;

      if (!versionCompatible) {
        changeClass = 'NOT_COMPARABLE';
      } else if (prevAns === 'FRICTION' && currAns === 'NO_FRICTION') {
        changeClass = 'RESOLVED_FRICTION';
        resolvedCount++;
        improvedCount++;
      } else if (prevAns === 'FRICTION' && currAns === 'FRICTION') {
        changeClass = 'UNCHANGED';
        isRecurring = true;
        recurringCount++;
      } else if (prevAns === 'NO_FRICTION' && currAns === 'FRICTION') {
        changeClass = 'WORSENED';
        newFrictionCount++;
        worsenedCount++;
      } else if (prevAns !== 'FRICTION' && currAns === 'FRICTION') {
        changeClass = 'NEW_FRICTION';
        newFrictionCount++;
      } else if (prevAns === 'NO_FRICTION' && currAns === 'NO_FRICTION') {
        changeClass = 'UNCHANGED';
      } else if (currAns === 'NOT_APPLICABLE' && prevAns === 'NOT_APPLICABLE') {
        changeClass = 'UNCHANGED';
      } else {
        changeClass = 'NOT_COMPARABLE';
      }

      items.push({
        indicatorCode: code,
        indicatorSubject: currInd.subject || '',
        indicatorStatement: currInd.statement || '',
        previousVisitId: previousVisit.id,
        previousVisitDate: previousVisit.completedAt || previousVisit.startedAt,
        previousAnswerState: prevAns,
        previousSeverity: prevResp?.severity,
        currentVisitId: currentVisit.id,
        currentVisitDate: currentVisit.completedAt || currentVisit.startedAt,
        currentAnswerState: currAns,
        currentSeverity: currResp?.severity,
        changeClass,
        isRecurring,
        versionCompatible,
        previousVersion: prevVer,
        currentVersion: currVer,
      });
    }

    const prevScore = getVisitScore(previousVisit);
    const currScore = getVisitScore(currentVisit);
    const scoreDelta = Math.round((currScore - prevScore) * 10) / 10;

    return {
      items,
      resolvedCount,
      newFrictionCount,
      recurringCount,
      scoreDelta,
      improvedCount,
      worsenedCount,
    };
  }

  /**
   * Calculates Action Analytics Metrics (Requirement 18)
   */
  static computeActionAnalytics(actions: CorrectiveAction[]): ActionAnalyticsSummary {
    const total = actions.length;
    if (total === 0) {
      return {
        totalActions: 0,
        openActions: 0,
        overdueActions: 0,
        criticalActions: 0,
        resolvedActions: 0,
        awaitingVerificationActions: 0,
        verifiedActions: 0,
        resolutionRate: 0,
        medianResolutionHours: 0,
        overdueRate: 0,
        recurrenceRate: 0,
        criticalResolutionRate: 0,
      };
    }

    const now = new Date().getTime();
    let openCount = 0;
    let overdueCount = 0;
    let criticalCount = 0;
    let resolvedCount = 0;
    let awaitingVerificationCount = 0;
    let verifiedCount = 0;
    let criticalResolvedCount = 0;
    const resolutionTimesHours: number[] = [];

    for (const a of actions) {
      const isResolved = a.status === 'RESOLVED' || a.status === 'VERIFIED';
      const isAwaiting = a.status === 'WAITING_REVIEW';
      const isOpen = a.status === 'OPEN' || a.status === 'ASSIGNED' || a.status === 'IN_PROGRESS' || a.status === 'REOPENED';
      const isCritical = a.priority === 'CRITICAL';

      if (isOpen) openCount++;
      if (isAwaiting) awaitingVerificationCount++;
      if (a.status === 'RESOLVED') resolvedCount++;
      if (a.status === 'VERIFIED') verifiedCount++;
      if (isCritical) {
        criticalCount++;
        if (isResolved) criticalResolvedCount++;
      }

      // Overdue check
      if (isOpen && a.dueDate) {
        const dueTime = new Date(a.dueDate).getTime();
        if (now > dueTime) {
          overdueCount++;
        }
      }

      // Resolution duration
      if (isResolved && a.completionDate && a.createdAt) {
        const start = new Date(a.createdAt).getTime();
        const end = new Date(a.completionDate).getTime();
        if (end >= start) {
          resolutionTimesHours.push((end - start) / (1000 * 60 * 60));
        }
      }
    }

    // Median resolution time
    let medianResolutionHours = 0;
    if (resolutionTimesHours.length > 0) {
      resolutionTimesHours.sort((a, b) => a - b);
      const mid = Math.floor(resolutionTimesHours.length / 2);
      medianResolutionHours =
        resolutionTimesHours.length % 2 !== 0
          ? Math.round(resolutionTimesHours[mid])
          : Math.round((resolutionTimesHours[mid - 1] + resolutionTimesHours[mid]) / 2);
    }

    const resolutionRate = Math.round(((resolvedCount + verifiedCount) / total) * 100);
    const overdueRate = openCount > 0 ? Math.round((overdueCount / openCount) * 100) : 0;
    const criticalResolutionRate =
      criticalCount > 0 ? Math.round((criticalResolvedCount / criticalCount) * 100) : 100;

    return {
      totalActions: total,
      openActions: openCount,
      overdueActions: overdueCount,
      criticalActions: criticalCount,
      resolvedActions: resolvedCount,
      awaitingVerificationActions: awaitingVerificationCount,
      verifiedActions: verifiedCount,
      resolutionRate,
      medianResolutionHours,
      overdueRate,
      recurrenceRate: 0, // Calculated dynamically when historical visits present
      criticalResolutionRate,
    };
  }

  /**
   * Generates Branch Historical Progress Summary (Requirement 17)
   */
  static generateBranchSummary(
    branchId: string,
    branchName: string,
    brandName: string,
    visits: VisitSession[],
    actions: CorrectiveAction[]
  ): BranchHistoricalSummary {
    const sortedVisits = [...visits].sort(
      (a, b) =>
        new Date(a.completedAt || a.startedAt).getTime() -
        new Date(b.completedAt || b.startedAt).getTime()
    );

    const initialScore = sortedVisits.length > 0 ? getVisitScore(sortedVisits[0]) : 0;
    const currentScore =
      sortedVisits.length > 0 ? getVisitScore(sortedVisits[sortedVisits.length - 1]) : 0;
    const scoreDelta = Math.round((currentScore - initialScore) * 10) / 10;

    let resolvedFrictionsCount = 0;
    let newFrictionsCount = 0;
    let recurringFrictionsCount = 0;

    if (sortedVisits.length >= 2) {
      const comp = this.compareVisits(
        sortedVisits[sortedVisits.length - 2],
        sortedVisits[sortedVisits.length - 1]
      );
      resolvedFrictionsCount = comp.resolvedCount;
      newFrictionsCount = comp.newFrictionCount;
      recurringFrictionsCount = comp.recurringCount;
    }

    const branchActions = actions.filter((a) => a.branchId === branchId);
    const now = new Date().getTime();
    let openActionsCount = 0;
    let overdueActionsCount = 0;

    for (const a of branchActions) {
      const isOpen =
        a.status === 'OPEN' ||
        a.status === 'ASSIGNED' ||
        a.status === 'IN_PROGRESS' ||
        a.status === 'REOPENED';
      if (isOpen) {
        openActionsCount++;
        if (a.dueDate && now > new Date(a.dueDate).getTime()) {
          overdueActionsCount++;
        }
      }
    }

    return {
      branchId,
      branchName,
      brandName,
      initialScore,
      currentScore,
      scoreDelta,
      resolvedFrictionsCount,
      newFrictionsCount,
      recurringFrictionsCount,
      openActionsCount,
      overdueActionsCount,
      visitsCount: sortedVisits.length,
      visitsHistory: sortedVisits.map((v) => {
        let fCount = 0;
        let rCount = 0;
        Object.values(v.responses || {}).forEach((r) => {
          if (r.answerState === 'FRICTION') fCount++;
          if (r.answerState === 'NO_FRICTION') rCount++;
        });
        return {
          visitId: v.id,
          visitCode: v.visitCode || v.id.slice(0, 8),
          date: v.completedAt || v.startedAt,
          overallScore: getVisitScore(v),
          frictionCount: fCount,
          resolvedCount: rCount,
        };
      }),
    };
  }
}
