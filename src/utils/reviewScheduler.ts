import { addDays, differenceInCalendarDays, parseISO, startOfDay } from 'date-fns';
import type {
  Problem,
  Difficulty,
  ReviewStage,
  ReviewScheduleResult,
  ReviewScheduleParams,
  ReviewFactorBreakdown,
} from '../types';

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

export const CONFIDENCE_BASE_DAYS: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: 2, // Lost: 2 days (gives overnight consolidation without letting schema dissolve)
  2: 4, // Shaky: 4 days
  3: 7, // Okay: 7 days (~1 week)
  4: 14, // Solid: 14 days (~2 weeks)
  5: 28, // Fluent: 28 days (~4 weeks)
};

export const CONFIDENCE_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'Lost (1/5)',
  2: 'Shaky (2/5)',
  3: 'Okay (3/5)',
  4: 'Solid (4/5)',
  5: 'Fluent (5/5)',
};

export const MENTOR_HINT_MULTIPLIERS: Record<0 | 1 | 2 | 3 | 4, number> = {
  0: 1.15, // Unassisted (+15% bonus: robust independent neural schema)
  1: 1.0, // Nudge (neutral: conceptual self-guidance remained intact)
  2: 0.85, // Approach/Pattern (-15% gap: algorithm idea was assisted)
  3: 0.7, // Pseudocode (-30% gap: structure handed over)
  4: 0.55, // Full Solution (-45% gap: borrowed full cognition)
};

export const DIFFICULTY_MULTIPLIERS: Record<Difficulty, number> = {
  Easy: 1.2, // +20% bonus (idiomatic patterns stick longer)
  Medium: 1.0, // Baseline
  Hard: 0.75, // -25% penalty (subtle invariants decay faster)
};

export const EXPECTED_TIME_MINUTES: Record<Difficulty, number> = {
  Easy: 15,
  Medium: 30,
  Hard: 45,
};

export const DEFAULT_EASE_FACTOR = 2.2;
export const MIN_EASE_FACTOR = 1.3;
export const MAX_EASE_FACTOR = 3.0;

export const MIN_INITIAL_DAYS = 2; // Never schedule for tomorrow morning: avoids simple rote recall
export const MAX_INITIAL_DAYS = 35; // Maximum initial gap
export const MAX_REVIEW_DAYS = 180; // Mastered ceiling

// ============================================================================
// MULTIPLIER HELPERS
// ============================================================================

export function getAttemptMultiplier(attemptsCount: number): {
  multiplier: number;
  explanation: string;
} {
  if (attemptsCount <= 1) {
    return { multiplier: 1.1, explanation: '1st-try pass (+10% bonus)' };
  }
  if (attemptsCount <= 3) {
    return { multiplier: 1.0, explanation: 'Normal attempt count (neutral)' };
  }
  if (attemptsCount <= 5) {
    return {
      multiplier: 0.85,
      explanation: `${attemptsCount} attempts (-15% struggle adjustment)`,
    };
  }
  return { multiplier: 0.75, explanation: `${attemptsCount} attempts (-25% struggle adjustment)` };
}

export function getTimeMultiplier(
  difficulty: Difficulty,
  timeSpentMinutes: number | null
): { multiplier: number; explanation: string } {
  if (timeSpentMinutes === null || timeSpentMinutes === undefined || timeSpentMinutes <= 0) {
    return { multiplier: 1.0, explanation: 'No time logged (neutral)' };
  }

  const benchmark = EXPECTED_TIME_MINUTES[difficulty];
  const ratio = timeSpentMinutes / benchmark;

  if (ratio <= 0.6) {
    return {
      multiplier: 1.15,
      explanation: `Fast solve (${timeSpentMinutes}m vs ~${benchmark}m, +15% speed bonus)`,
    };
  }
  if (ratio <= 1.3) {
    return {
      multiplier: 1.0,
      explanation: `Standard solve time (${timeSpentMinutes}m vs ~${benchmark}m, neutral)`,
    };
  }
  if (ratio <= 2.0) {
    return {
      multiplier: 0.9,
      explanation: `High time spent (${timeSpentMinutes}m vs ~${benchmark}m, -10% adjustment)`,
    };
  }
  return {
    multiplier: 0.8,
    explanation: `Extended struggle (${timeSpentMinutes}m vs ~${benchmark}m, -20% adjustment)`,
  };
}

// ============================================================================
// CORE CALCULATION ENGINE
// ============================================================================

/**
 * Calculates the next review date, interval, stage, and factor breakdown.
 */
export function calculateNextReview(params: ReviewScheduleParams): ReviewScheduleResult {
  const {
    difficulty,
    confidence,
    hintsUsed,
    timeSpentMinutes,
    attemptsCount = 1,
    previousIntervalDays,
    previousEaseFactor = DEFAULT_EASE_FACTOR,
    previousRepetitionCount = 0,
    baseDate = new Date(),
    isReviewSession = false,
  } = params;

  const baseDays = CONFIDENCE_BASE_DAYS[confidence];
  const confidenceLabel = CONFIDENCE_LABELS[confidence];

  const mentorMultiplier = MENTOR_HINT_MULTIPLIERS[hintsUsed];
  const difficultyMultiplier = DIFFICULTY_MULTIPLIERS[difficulty];

  const { multiplier: attemptMultiplier, explanation: attemptExpl } =
    getAttemptMultiplier(attemptsCount);
  const { multiplier: timeMultiplier, explanation: timeExpl } = getTimeMultiplier(
    difficulty,
    timeSpentMinutes
  );

  const explanations: string[] = [
    `Baseline for ${confidenceLabel}: ${baseDays} days`,
    hintsUsed === 0
      ? 'Unassisted solve (+15% bonus)'
      : `Used Level ${hintsUsed} mentor hints (${Math.round((mentorMultiplier - 1) * 100)}% adjustment)`,
    difficulty === 'Medium'
      ? 'Medium difficulty (standard baseline)'
      : `${difficulty} difficulty (${Math.round((difficultyMultiplier - 1) * 100)}% adjustment)`,
    attemptExpl,
    timeExpl,
  ];

  let intervalDays: number;
  let easeFactor = previousEaseFactor;
  let repetitionCount: number;
  let stage: ReviewStage;

  const effectiveBaseDate = typeof baseDate === 'string' ? parseISO(baseDate) : baseDate;
  const isReview = Boolean(
    isReviewSession || (previousRepetitionCount && previousRepetitionCount > 0)
  );

  // Branch A: Initial Solve (Repetition 0)
  if (!isReview) {
    if (confidence === 1) {
      intervalDays = MIN_INITIAL_DAYS; // Lost (1/5) is always 2 days: urgent check before schema dissolves
    } else {
      const rawDays =
        baseDays * mentorMultiplier * difficultyMultiplier * attemptMultiplier * timeMultiplier;

      intervalDays = Math.max(MIN_INITIAL_DAYS, Math.min(MAX_INITIAL_DAYS, Math.round(rawDays)));
    }
    easeFactor = DEFAULT_EASE_FACTOR;
    repetitionCount = 0;
    stage = 'learning';
  } else {
    // Branch B: Subsequent Review Rounds (Repetition 1, 2, 3...)
    if (confidence >= 3) {
      // Successful recall: interval expands
      const deltaEF = 0.1 - (5 - confidence) * (0.08 + (5 - confidence) * 0.02);
      easeFactor = Math.max(
        MIN_EASE_FACTOR,
        Math.min(MAX_EASE_FACTOR, previousEaseFactor + deltaEF)
      );

      const confMultiplier = confidence === 5 ? 1.25 : confidence === 4 ? 1.0 : 0.85;
      const prevInterval =
        previousIntervalDays && previousIntervalDays > 0 ? previousIntervalDays : baseDays;

      // When reviewing, mentor usage and difficulty continue to modulate interval expansion
      const rawDays =
        prevInterval *
        easeFactor *
        confMultiplier *
        (hintsUsed === 0 ? 1.05 : mentorMultiplier) *
        (difficulty === 'Hard' ? 0.9 : 1.0);

      intervalDays = Math.max(MIN_INITIAL_DAYS + 1, Math.min(MAX_REVIEW_DAYS, Math.round(rawDays)));

      repetitionCount = (previousRepetitionCount || 0) + 1;

      if (repetitionCount === 1) {
        stage = 'reviewing';
      } else if (repetitionCount === 2) {
        stage = 'consolidated';
      } else if (repetitionCount >= 3 && intervalDays >= 45) {
        stage = 'mastered';
      } else {
        stage = 'consolidated';
      }

      explanations.push(
        `Spaced repetition round ${repetitionCount}: expanded from ${prevInterval}d to ${intervalDays}d (EF: ${easeFactor.toFixed(2)})`
      );
    } else {
      // Relapse (confidence 1 or 2): contract interval to restabilize concept
      intervalDays = confidence === 1 ? MIN_INITIAL_DAYS : MIN_INITIAL_DAYS + 1;
      easeFactor = Math.max(MIN_EASE_FACTOR, previousEaseFactor - 0.2);
      repetitionCount = Math.max(0, previousRepetitionCount - 1);
      stage = 'learning';

      explanations.push(
        `Concept relapse detected (${confidenceLabel}): interval reset to ${intervalDays}d for rapid re-consolidation`
      );
    }
  }

  const nextReviewDateObj = addDays(effectiveBaseDate, intervalDays);
  const nextReviewDate = nextReviewDateObj.toISOString();

  const factors: ReviewFactorBreakdown = {
    baseDays,
    confidence,
    confidenceLabel,
    mentorMultiplier,
    hintsUsed,
    difficultyMultiplier,
    difficulty,
    attemptMultiplier,
    attemptsCount,
    timeMultiplier,
    timeSpentMinutes,
    explanations,
  };

  const summaryExplanation =
    previousRepetitionCount > 0 && confidence < 3
      ? `Concept relapse detected (${confidenceLabel}): interval reset to ${intervalDays} days for rapid re-consolidation.`
      : `Scheduled in ${intervalDays} days (${stage.toUpperCase()} stage) based on ${confidenceLabel}, ${difficulty} difficulty, and ${hintsUsed === 0 ? 'unassisted' : `${hintsUsed} hints`} solve.`;

  return {
    nextReviewDate,
    intervalDays,
    easeFactor: Number(easeFactor.toFixed(2)),
    repetitionCount,
    stage,
    factors,
    summaryExplanation,
  };
}

// ============================================================================
// DYNAMIC REVIEW STATUS & URGENCY
// ============================================================================

export interface ProblemReviewStatus {
  isScheduled: boolean;
  isDue: boolean;
  isOverdue: boolean;
  daysRemaining: number; // positive = days until due, 0 = due today, negative = days overdue
  daysOverdue: number; // 0 if not overdue, > 0 if overdue
  statusText: string;
  badgeClass: string;
  urgencyScore: number;
  stage: ReviewStage;
  intervalDays: number;
  nextReviewDate: string;
}

/**
 * Calculates current review due status, overdue duration, urgency score, and badge styles.
 * Works seamlessly whether problem has persisted nextReviewDate or needs on-the-fly calculation.
 */
export function getProblemReviewStatus(
  problem: Problem,
  attemptsCount: number = 1,
  currentDate: Date = new Date()
): ProblemReviewStatus {
  if (problem.status !== 'Solved') {
    return {
      isScheduled: false,
      isDue: false,
      isOverdue: false,
      daysRemaining: Infinity,
      daysOverdue: 0,
      statusText: 'Not Solved',
      badgeClass: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
      urgencyScore: 0,
      stage: 'learning',
      intervalDays: 0,
      nextReviewDate: '',
    };
  }

  let nextReviewDateStr = problem.nextReviewDate;
  let intervalDays = problem.reviewIntervalDays ?? 0;
  let stage = problem.reviewStage ?? 'learning';

  // If nextReviewDate was not yet persisted, dynamically compute it on the fly
  if (!nextReviewDateStr) {
    const computed = calculateNextReview({
      difficulty: problem.difficulty,
      confidence: problem.confidence || 3,
      hintsUsed: problem.hintsUsed || 0,
      timeSpentMinutes: problem.timeSpentMinutes,
      attemptsCount,
      previousIntervalDays: problem.reviewIntervalDays,
      previousEaseFactor: problem.easeFactor,
      previousRepetitionCount: problem.repetitionCount,
      baseDate: problem.dateSolved || problem.updatedAt || problem.dateAdded,
    });
    nextReviewDateStr = computed.nextReviewDate;
    intervalDays = computed.intervalDays;
    stage = computed.stage;
  }

  const reviewDate = parseISO(nextReviewDateStr);
  const today = startOfDay(currentDate);
  const targetDay = startOfDay(reviewDate);

  // diffDays: positive if target is in the future, negative if overdue, 0 if today
  const diffDays = differenceInCalendarDays(targetDay, today);
  const isDue = diffDays <= 0;
  const isOverdue = diffDays < 0;
  const daysOverdue = isOverdue ? Math.abs(diffDays) : 0;

  // Urgency Score: Overdue problems with low confidence or high hints score highest
  let urgencyScore = 0;
  if (isDue) {
    const confWeight = (6 - (problem.confidence || 3)) * 12;
    const hintWeight = (problem.hintsUsed || 0) * 8;
    const overdueWeight = daysOverdue * 15;
    urgencyScore = 100 + overdueWeight + confWeight + hintWeight;
  } else {
    // Upcoming: score based on proximity
    urgencyScore = Math.max(0, 50 - diffDays * 3);
  }

  let statusText = '';
  let badgeClass = '';

  if (stage === 'mastered' && !isDue) {
    statusText = 'Mastered';
    badgeClass =
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
  } else if (isOverdue) {
    statusText = `Overdue (${daysOverdue}d)`;
    badgeClass =
      'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800 font-semibold';
  } else if (diffDays === 0) {
    statusText = 'Due Today';
    badgeClass =
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 font-semibold';
  } else if (diffDays === 1) {
    statusText = 'Due Tomorrow';
    badgeClass =
      'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800';
  } else {
    statusText = `In ${diffDays}d`;
    badgeClass =
      'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700';
  }

  return {
    isScheduled: true,
    isDue,
    isOverdue,
    daysRemaining: diffDays,
    daysOverdue,
    statusText,
    badgeClass,
    urgencyScore,
    stage,
    intervalDays,
    nextReviewDate: nextReviewDateStr,
  };
}

// ============================================================================
// REVIEW QUEUE SORTING & FILTERING
// ============================================================================

/**
 * Returns whether a problem belongs in the active review queue:
 * Problem is Solved AND (is currently Due / Overdue OR has confidence <= 3).
 */
export function isProblemInReviewQueue(problem: Problem, currentDate: Date = new Date()): boolean {
  if (problem.status !== 'Solved') return false;
  const status = getProblemReviewStatus(problem, 1, currentDate);
  return status.isDue || (problem.confidence !== null && problem.confidence <= 3);
}

/**
 * Sorts problems by review urgency descending (most urgent / overdue first).
 */
export function sortByReviewUrgency(
  problems: Problem[],
  currentDate: Date = new Date()
): Problem[] {
  const statusMap = new Map<string, ProblemReviewStatus>();
  for (const p of problems) {
    statusMap.set(p.id, getProblemReviewStatus(p, 1, currentDate));
  }

  return [...problems].sort((a, b) => {
    const sA = statusMap.get(a.id)!;
    const sB = statusMap.get(b.id)!;

    // Both are due: sort by urgency score descending
    if (sA.isDue && sB.isDue) {
      return sB.urgencyScore - sA.urgencyScore;
    }
    // Due items come before non-due
    if (sA.isDue && !sB.isDue) return -1;
    if (!sA.isDue && sB.isDue) return 1;

    // Neither is due: sort by days remaining ascending (soonest upcoming first)
    if (sA.daysRemaining !== sB.daysRemaining) {
      return sA.daysRemaining - sB.daysRemaining;
    }

    return sB.urgencyScore - sA.urgencyScore;
  });
}
