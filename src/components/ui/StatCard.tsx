import React from 'react';

export type StatTone = 'default' | 'alarm' | 'positive';

interface StatCardProps {
  /** What is being counted. Sentence case, no English in brackets. */
  label: string;
  value: React.ReactNode;
  /** One short line of context under the number. Optional. */
  hint?: string;
  /**
   * Colour carries meaning, not decoration.
   *  - `default` is ink: most numbers are just facts.
   *  - `alarm` is for a number that demands action right now, and should be
   *    passed only when it actually does (an overdue count of zero is not an
   *    alarm).
   *  - `positive` is for a success measure.
   * The previous cards used orange, purple, green and red side by side, which
   * made every number look equally urgent and so none of them did.
   */
  tone?: StatTone;
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, hint, tone = 'default' }) => (
  <div className={`stat-card stat-card--${tone}`}>
    <span className="stat-card__label">{label}</span>
    <span className="stat-card__value">{value}</span>
    {hint && <span className="stat-card__hint">{hint}</span>}
  </div>
);

/** Equal-width row of stat cards that wraps sensibly on a phone. */
export const StatRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="stat-row">{children}</div>
);
