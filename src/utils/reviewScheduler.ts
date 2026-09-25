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
// CONSTANTS & CONFIGURATION (DSA-FSRS: Adaptive Schema Stability Engine)
// ============================================================================

export const CONFIDENCE_BASE_DAYS: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: 4, // Lost: 4 days (gives overnight consolidation and space to reconstruct schema from scratch)
  2: 7, // Shaky: 7 days (~1 week)
  3: 12, // Okay: 12 days (~1.7 weeks)
  4: 21, // Solid: 21 days (~3 weeks)
  5: 35, // Fluent: 35 days (~5 weeks)
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
  Easy: 1.25, // +25% bonus (idiomatic patterns stick longer)
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
export const MAX_EASE_FACTOR = 3.2;

export const MIN_INITIAL_DAYS = 3; // Never schedule for tomorrow or 2 days: prevents simple rote echo
export const MAX_INITIAL_DAYS = 45; // Maximum initial gap
export const MAX_REVIEW_DAYS = 180; // Mastered ceiling

// ============================================================================
// WORKLOAD PACING & ANTI-CLUMPING (DETERMINISTIC JITTER)
// ============================================================================

/**
 * Computes a small deterministic pseudo-random jitter in [-0.07, +0.07] based on problemId
 * to spread review dates across adjacent weekdays and avoid review clumping/spikes.
 */
export function getDeterministicJitter(id?: string): number {
  if (!id) return 0;
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const normalized = ((Math.abs(hash) % 1000) / 1000) * 0.14 - 0.07;
  return Number(normalized.toFixed(4));
}

// ============================================================================
// INTRINSIC DIFFICULTY ENGINE (D in [1.0, 9.0])
// ============================================================================

export function calculateIntrinsicDifficulty(params: {
  difficulty: Difficulty;
  confidence: 1 | 2 | 3 | 4 | 5;
  hintsUsed: 0 | 1 | 2 | 3 | 4;
  attemptsCount?: number;
  timeSpentMinutes?: number | null;
  noteReviewVerdict?: 'solid' | 'needs_work';
  noteReviewRating?: number;
}): { difficultyIndex: number; difficultyExpl: string } {
  const {
    difficulty,
    confidence,
    hintsUsed,
    attemptsCount = 1,
    timeSpentMinutes,
    noteReviewVerdict,
    noteReviewRating,
  } = params;

  // Base difficulty
  const baseD: Record<Difficulty, number> = {
    Easy: 3.0,
    Medium: 5.0,
    Hard: 7.2,
  };
  let d = baseD[difficulty];

  // Confidence delta
  const confDelta: Record<1 | 2 | 3 | 4 | 5, number> = {
    1: 2.2,
    2: 1.4,
    3: 0.4,
    4: -0.6,
    5: -1.6,
  };
  d += confDelta[confidence];

  // Hints delta
  const hintDelta: Record<0 | 1 | 2 | 3 | 4, number> = {
    0: -0.6, // unassisted
    1: 0.0, // nudge
    2: 0.8, // approach
    3: 1.5, // pseudocode
    4: 2.0, // solution
  };
  d += hintDelta[hintsUsed];

  // Attempts delta
  if (attemptsCount <= 1) {
    d -= 0.4;
  } else if (attemptsCount >= 6) {
    d += 1.0;
  } else if (attemptsCount >= 4) {
    d += 0.5;
  }

  // Time spent delta
  if (timeSpentMinutes !== null && timeSpentMinutes !== undefined && timeSpentMinutes > 0) {
    const benchmark = EXPECTED_TIME_MINUTES[difficulty];
    const ratio = timeSpentMinutes / benchmark;
    if (ratio <= 0.65) d -= 0.5;
    else if (ratio > 2.0) d += 0.8;
    else if (ratio > 1.3) d += 0.4;
  }

  // Note review quality delta
  if (noteReviewVerdict === 'solid' && (noteReviewRating ?? 0) >= 4) {
    d -= 0.4;
  } else if (noteReviewVerdict === 'needs_work') {
    d += 0.4;
  }

  const difficultyIndex = Number(Math.max(1.0, Math.min(9.0, d)).toFixed(2));
  const difficultyExpl = `Intrinsic Difficulty Index: ${difficultyIndex}/9.0 (${difficulty}, ${CONFIDENCE_LABELS[confidence]})`;

  return { difficultyIndex, difficultyExpl };
}

// ============================================================================
// MULTIPLIER HELPERS (Backward compatibility & UI breakdowns)
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

  if (ratio <= 0.65) {
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
// CORE CALCULATION ENGINE (DSA-FSRS: Adaptive Schema Stability Engine)
// ============================================================================

/**
 * Calculates next review date, interval, stage, easeFactor, and transparent factor breakdown.
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
    problemId,
    elapsedDaysSinceLastReview,
    noteReviewRating,
    noteReviewVerdict,
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

  const { difficultyIndex, difficultyExpl } = calculateIntrinsicDifficulty({
    difficulty,
    confidence,
    hintsUsed,
    attemptsCount,
    timeSpentMinutes,
    noteReviewVerdict,
    noteReviewRating,
  });

  const explanations: string[] = [
    `Baseline for ${confidenceLabel}: ${baseDays} days`,
    difficultyExpl,
    hintsUsed === 0
      ? 'Unassisted solve (+15% bonus: independent cognitive schema)'
      : `Used Level ${hintsUsed} mentor hints (${Math.round((mentorMultiplier - 1) * 100)}% adjustment)`,
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
  const jitter = getDeterministicJitter(problemId);

  // Branch A: Initial Solve (Repetition 0)
  if (!isReview) {
    const difficultyFactor = Math.pow(Math.max(0.1, (10 - difficultyIndex) / 5), 0.65);
    const rawDays = baseDays * difficultyFactor * (1 + jitter);
    intervalDays = Math.max(MIN_INITIAL_DAYS, Math.min(MAX_INITIAL_DAYS, Math.round(rawDays)));
    easeFactor = DEFAULT_EASE_FACTOR;
    repetitionCount = 0;
    stage = 'learning';

    explanations.push(
      `Initial memory stability established at ${intervalDays} days (difficulty factor: ${difficultyFactor.toFixed(2)})`
    );
  } else {
    // Branch B: Subsequent Review Rounds
    const prevInterval =
      previousIntervalDays && previousIntervalDays > 0 ? previousIntervalDays : baseDays;

    if (confidence >= 3) {
      // Successful recall: interval expands smoothly
      const hintFactor =
        hintsUsed === 0
          ? 1.15
          : hintsUsed === 1
            ? 1.0
            : hintsUsed === 2
              ? 0.75
              : hintsUsed === 3
                ? 0.5
                : 0.35;

      let lagFactor = 1.0;
      if (
        elapsedDaysSinceLastReview &&
        elapsedDaysSinceLastReview > prevInterval &&
        confidence >= 4
      ) {
        const overdueRatio = (elapsedDaysSinceLastReview - prevInterval) / prevInterval;
        lagFactor = Math.min(1.3, 1.0 + 0.15 * overdueRatio);
        explanations.push(
          `Desirable difficulty bonus applied (+${Math.round((lagFactor - 1) * 100)}% for overdue recall)`
        );
      }

      const difficultyTerm = Math.max(0.2, (10 - difficultyIndex) / 4);
      const confidenceTerm = Math.pow(confidence - 2, 0.75); // C=3 => 1.0, C=4 => 1.68, C=5 => 2.28
      const alpha = 0.42;

      const expansionRate = alpha * difficultyTerm * confidenceTerm * hintFactor * lagFactor;
      const multiplier = 1 + expansionRate;

      const rawDays = prevInterval * multiplier * (1 + jitter);
      intervalDays = Math.max(prevInterval + 1, Math.min(MAX_REVIEW_DAYS, Math.round(rawDays)));

      easeFactor = Math.max(
        MIN_EASE_FACTOR,
        Math.min(MAX_EASE_FACTOR, Number(multiplier.toFixed(2)))
      );
      repetitionCount = (previousRepetitionCount || 0) + 1;

      if (intervalDays >= 60 && repetitionCount >= 2) {
        stage = 'mastered';
      } else if (intervalDays >= 25 && repetitionCount >= 2) {
        stage = 'consolidated';
      } else if (intervalDays >= 10) {
        stage = 'reviewing';
      } else {
        stage = 'learning';
      }

      explanations.push(
        `Spaced repetition round ${repetitionCount}: expanded from ${prevInterval}d to ${intervalDays}d (${multiplier.toFixed(2)}x expansion)`
      );
    } else {
      // Relapse (confidence 1 or 2): Soft-Landing Relapse
      const beta = confidence === 2 ? 0.35 : 0.2;
      const floorDays = confidence === 2 ? 5 : 3;
      const rawRelapseDays = Math.max(floorDays, Math.round(prevInterval * beta));
      intervalDays = Math.min(prevInterval, rawRelapseDays);

      easeFactor = Math.max(MIN_EASE_FACTOR, previousEaseFactor - 0.25);
      repetitionCount = Math.max(0, (previousRepetitionCount || 1) - 1);
      stage = intervalDays >= 10 ? 'reviewing' : 'learning';

      explanations.push(
        `Concept relapse detected (${confidenceLabel}): soft-landing interval set to ${intervalDays}d (preserved ${Math.round(beta * 100)}% of previous ${prevInterval}d stability)`
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
    intrinsicDifficulty: difficultyIndex,
    stabilityDays: intervalDays,
  };

  const summaryExplanation =
    previousRepetitionCount > 0 && confidence < 3
      ? `Concept relapse detected (${confidenceLabel}): soft-landing interval set to ${intervalDays} days for targeted schema reconstruction.`
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
      problemId: problem.id,
    });
    nextReviewDateStr = computed.nextReviewDate;
    intervalDays = computed.intervalDays;
    stage = computed.stage;
  }

  const reviewDate = parseISO(nextReviewDateStr);
  if (!nextReviewDateStr || isNaN(reviewDate.getTime())) {
    return {
      isScheduled: false,
      isDue: false,
      isOverdue: false,
      daysRemaining: Infinity,
      daysOverdue: 0,
      statusText: 'No Review Scheduled',
      badgeClass: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
      urgencyScore: 0,
      stage: 'learning',
      intervalDays: 0,
      nextReviewDate: '',
    };
  }
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
    statusText = `Revise In ${diffDays}d`;
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
 * Strictly: Problem is Solved AND its scheduled review date is currently Due (or Overdue).
 * Non-due problems are never forced into the queue prematurely.
 */
export function isProblemInReviewQueue(problem: Problem, currentDate: Date = new Date()): boolean {
  if (problem.status !== 'Solved') return false;
  const status = getProblemReviewStatus(problem, 1, currentDate);
  return status.isDue;
}

/**
 * Returns whether a problem is overdue for review:
 * Problem is Solved AND its scheduled review date has passed (diffDays < 0).
 */
export function isProblemOverdue(problem: Problem, currentDate: Date = new Date()): boolean {
  if (problem.status !== 'Solved') return false;
  const status = getProblemReviewStatus(problem, 1, currentDate);
  return status.isOverdue;
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
