import { describe, it, expect } from 'vitest';
import { addDays, subDays } from 'date-fns';
import {
  calculateNextReview,
  getProblemReviewStatus,
  isProblemInReviewQueue,
  isProblemOverdue,
  sortByReviewUrgency,
  getDeterministicJitter,
  MIN_INITIAL_DAYS,
  MAX_INITIAL_DAYS,
} from '../utils/reviewScheduler';
import type { Problem } from '../types';

describe('Intelligent Review Scheduler (DSA-FSRS)', () => {
  const baseDate = new Date('2026-09-21T12:00:00.000Z');

  describe('Confidence Base Stability Intervals', () => {
    it('schedules Lost (1/5) with a safe minimum gap of 3 days (never 0, 1, or 2 to avoid rote echo)', () => {
      const result = calculateNextReview({
        difficulty: 'Medium',
        confidence: 1,
        hintsUsed: 0,
        timeSpentMinutes: 30,
        attemptsCount: 1,
        baseDate,
      });

      expect(result.intervalDays).toBeGreaterThanOrEqual(MIN_INITIAL_DAYS);
      expect(result.intervalDays).toBe(3);
      expect(result.stage).toBe('learning');
      expect(result.repetitionCount).toBe(0);
    });

    it('schedules Shaky (2/5) around 7 days (~1 week) with moderate adjustments', () => {
      const result = calculateNextReview({
        difficulty: 'Medium',
        confidence: 2,
        hintsUsed: 0,
        timeSpentMinutes: 30,
        attemptsCount: 1,
        baseDate,
      });

      expect(result.intervalDays).toBe(7);
      expect(result.stage).toBe('learning');
    });

    it('schedules Okay (3/5) around 11-12 days (~1.7 weeks)', () => {
      const result = calculateNextReview({
        difficulty: 'Medium',
        confidence: 3,
        hintsUsed: 1, // nudge
        timeSpentMinutes: 30,
        attemptsCount: 2,
        baseDate,
      });

      expect(result.intervalDays).toBe(11);
      expect(result.summaryExplanation).toContain('11 days');
    });

    it('schedules Solid (4/5) around 3+ weeks (21-25 days)', () => {
      const result = calculateNextReview({
        difficulty: 'Medium',
        confidence: 4,
        hintsUsed: 0,
        timeSpentMinutes: 30,
        attemptsCount: 1,
        baseDate,
      });

      expect(result.intervalDays).toBe(25);
    });

    it('schedules Fluent (5/5) with generous space (35-45 days) for new problem focus', () => {
      const result = calculateNextReview({
        difficulty: 'Easy',
        confidence: 5,
        hintsUsed: 0,
        timeSpentMinutes: 10,
        attemptsCount: 1,
        baseDate,
      });

      expect(result.intervalDays).toBe(MAX_INITIAL_DAYS);
      expect(result.intervalDays).toBeLessThanOrEqual(MAX_INITIAL_DAYS);
    });
  });

  describe('Mentor Hint Penalty & Assistance Adjustments', () => {
    it('penalizes higher hint usage progressively to reinforce borrowed cognition', () => {
      const unassisted = calculateNextReview({
        difficulty: 'Medium',
        confidence: 3,
        hintsUsed: 0,
        timeSpentMinutes: 30,
        attemptsCount: 2,
        baseDate,
      });

      const approachHint = calculateNextReview({
        difficulty: 'Medium',
        confidence: 3,
        hintsUsed: 2, // Approach/Pattern
        timeSpentMinutes: 30,
        attemptsCount: 2,
        baseDate,
      });

      const fullSolution = calculateNextReview({
        difficulty: 'Medium',
        confidence: 3,
        hintsUsed: 4, // Full solution
        timeSpentMinutes: 30,
        attemptsCount: 2,
        baseDate,
      });

      expect(unassisted.intervalDays).toBeGreaterThan(approachHint.intervalDays);
      expect(approachHint.intervalDays).toBeGreaterThan(fullSolution.intervalDays);
      expect(fullSolution.intervalDays).toBeGreaterThanOrEqual(MIN_INITIAL_DAYS);
    });
  });

  describe('Difficulty and Struggle Adjustments', () => {
    it('reduces gap for Hard problems compared to Easy problems', () => {
      const easy = calculateNextReview({
        difficulty: 'Easy',
        confidence: 3,
        hintsUsed: 0,
        timeSpentMinutes: 15,
        attemptsCount: 1,
        baseDate,
      });

      const hard = calculateNextReview({
        difficulty: 'Hard',
        confidence: 3,
        hintsUsed: 0,
        timeSpentMinutes: 45,
        attemptsCount: 1,
        baseDate,
      });

      expect(easy.intervalDays).toBeGreaterThan(hard.intervalDays);
    });

    it('adjusts for multiple failed attempts and excessive time spent', () => {
      const cleanPass = calculateNextReview({
        difficulty: 'Medium',
        confidence: 3,
        hintsUsed: 1,
        timeSpentMinutes: 25,
        attemptsCount: 1,
        baseDate,
      });

      const strugglePass = calculateNextReview({
        difficulty: 'Medium',
        confidence: 3,
        hintsUsed: 1,
        timeSpentMinutes: 75, // > 2.0x benchmark
        attemptsCount: 6, // 6 attempts
        baseDate,
      });

      expect(cleanPass.intervalDays).toBeGreaterThan(strugglePass.intervalDays);
    });
  });

  describe('Spaced Repetition Progression & Soft-Landing Relapse', () => {
    it('expands interval on successful review (confidence >= 3) and advances stage', () => {
      // Repetition 0 -> Repetition 1
      const review1 = calculateNextReview({
        difficulty: 'Medium',
        confidence: 4,
        hintsUsed: 0,
        timeSpentMinutes: 20,
        attemptsCount: 1,
        previousIntervalDays: 14,
        previousEaseFactor: 2.2,
        previousRepetitionCount: 1,
        baseDate,
      });

      expect(review1.repetitionCount).toBe(2);
      expect(review1.intervalDays).toBeGreaterThan(14);
      expect(review1.stage).toBe('consolidated');

      // Repetition 2 -> Repetition 3 (High interval -> Mastered)
      const review2 = calculateNextReview({
        difficulty: 'Medium',
        confidence: 5,
        hintsUsed: 0,
        timeSpentMinutes: 15,
        attemptsCount: 1,
        previousIntervalDays: review1.intervalDays,
        previousEaseFactor: review1.easeFactor,
        previousRepetitionCount: 2,
        baseDate,
      });

      expect(review2.repetitionCount).toBe(3);
      expect(review2.intervalDays).toBeGreaterThan(review1.intervalDays);
      expect(review2.stage).toBe('mastered');
    });

    it('provides soft-landing on relapse instead of brutal 2-day reset cliff', () => {
      const relapse = calculateNextReview({
        difficulty: 'Medium',
        confidence: 2, // Shaky relapse
        hintsUsed: 2,
        timeSpentMinutes: 40,
        previousIntervalDays: 30,
        previousEaseFactor: 2.4,
        previousRepetitionCount: 2,
        baseDate,
      });

      // Preserves 35% of previous stability (~10-11 days) rather than resetting to 2 days
      expect(relapse.intervalDays).toBeGreaterThanOrEqual(5);
      expect(relapse.intervalDays).toBeLessThan(30);
      expect(relapse.intervalDays).toBe(11);
      expect(relapse.repetitionCount).toBe(1);
      expect(relapse.summaryExplanation).toContain('relapse');
    });
  });

  describe('Desirable Difficulty & Overdue Recall Bonus', () => {
    it('rewards overdue recall with increased expansion bonus', () => {
      const onTimeReview = calculateNextReview({
        difficulty: 'Medium',
        confidence: 4,
        hintsUsed: 0,
        timeSpentMinutes: 25,
        previousIntervalDays: 20,
        previousRepetitionCount: 1,
        baseDate,
      });

      const overdueReview = calculateNextReview({
        difficulty: 'Medium',
        confidence: 4,
        hintsUsed: 0,
        timeSpentMinutes: 25,
        previousIntervalDays: 20,
        previousRepetitionCount: 1,
        elapsedDaysSinceLastReview: 35, // 15 days overdue
        baseDate,
      });

      expect(overdueReview.intervalDays).toBeGreaterThan(onTimeReview.intervalDays);
      expect(
        overdueReview.factors.explanations.some((e) => e.includes('Desirable difficulty bonus'))
      ).toBe(true);
    });
  });

  describe('Anti-Clumping Deterministic Jitter', () => {
    it('generates consistent deterministic jitter based on problemId', () => {
      const jitter1 = getDeterministicJitter('p-101');
      const jitter2 = getDeterministicJitter('p-101');
      const jitter3 = getDeterministicJitter('p-202');

      expect(jitter1).toBe(jitter2);
      expect(jitter1).toBeGreaterThanOrEqual(-0.07);
      expect(jitter1).toBeLessThanOrEqual(0.07);
      expect(typeof jitter3).toBe('number');
    });
  });

  describe('Dynamic Review Status & Urgency Scoring', () => {
    const mockProblem: Problem = {
      id: 'p-123',
      number: 1,
      title: 'Two Sum',
      url: null,
      statement: '',
      difficulty: 'Easy',
      topics: ['Array'],
      patterns: ['Hash Table'],
      status: 'Solved',
      confidence: 3,
      timeSpentMinutes: 15,
      hintsUsed: 0,
      starred: false,
      userTimeComplexity: null,
      userSpaceComplexity: null,
      notes: '',
      language: 'python',
      dateAdded: subDays(baseDate, 25).toISOString(),
      dateFirstAttempt: null,
      dateSolved: subDays(baseDate, 25).toISOString(),
      updatedAt: subDays(baseDate, 25).toISOString(),
    };

    it('detects when an existing solved problem is overdue based on past solve date', () => {
      // Solved 25 days ago, Easy + Okay (3) initial interval ~16 days => now overdue by ~9 days
      const status = getProblemReviewStatus(mockProblem, 1, baseDate);

      expect(status.isScheduled).toBe(true);
      expect(status.isDue).toBe(true);
      expect(status.urgencyScore).toBeGreaterThan(100);
    });

    it('correctly labels upcoming review when review date is in the future', () => {
      const freshProblem: Problem = {
        ...mockProblem,
        dateSolved: baseDate.toISOString(),
        nextReviewDate: addDays(baseDate, 5).toISOString(),
        reviewIntervalDays: 5,
        reviewStage: 'learning',
      };

      const status = getProblemReviewStatus(freshProblem, 1, baseDate);
      expect(status.isDue).toBe(false);
      expect(status.isOverdue).toBe(false);
      expect(status.daysRemaining).toBe(5);
      expect(status.statusText).toBe('Revise In 5d');
    });

    it('identifies due today problems', () => {
      const dueTodayProblem: Problem = {
        ...mockProblem,
        nextReviewDate: baseDate.toISOString(),
      };

      const status = getProblemReviewStatus(dueTodayProblem, 1, baseDate);
      expect(status.isDue).toBe(true);
      expect(status.isOverdue).toBe(false);
      expect(status.statusText).toBe('Due Today');
    });
  });

  describe('Queue Inclusion & Urgency Sorting', () => {
    it('only includes problems in the review queue when their scheduled date is actually due', () => {
      // Problem solved today with confidence 2 (scheduled 7 days in future) is NOT due today
      const solvedFresh: Problem = {
        id: 'p-fresh',
        number: 1,
        title: 'Prob Fresh',
        url: null,
        statement: '',
        difficulty: 'Medium',
        topics: [],
        patterns: [],
        status: 'Solved',
        confidence: 2,
        timeSpentMinutes: 30,
        hintsUsed: 0,
        starred: false,
        userTimeComplexity: null,
        userSpaceComplexity: null,
        notes: '',
        language: 'python',
        dateAdded: baseDate.toISOString(),
        dateFirstAttempt: null,
        dateSolved: baseDate.toISOString(),
        updatedAt: baseDate.toISOString(),
        nextReviewDate: addDays(baseDate, 7).toISOString(),
        reviewIntervalDays: 7,
      };

      // Not due yet => should NOT clutter the review queue!
      expect(isProblemInReviewQueue(solvedFresh, baseDate)).toBe(false);

      // When its scheduled review date arrives:
      const solvedDue: Problem = {
        ...solvedFresh,
        nextReviewDate: baseDate.toISOString(),
      };
      expect(isProblemInReviewQueue(solvedDue, baseDate)).toBe(true);
    });

    it('accurately identifies whether a problem is overdue', () => {
      const baseProblem: Problem = {
        id: 'p-overdue-test',
        number: 10,
        title: 'Overdue Test',
        url: null,
        statement: '',
        difficulty: 'Medium',
        topics: [],
        patterns: [],
        status: 'Solved',
        confidence: 4,
        timeSpentMinutes: 30,
        hintsUsed: 0,
        starred: false,
        userTimeComplexity: null,
        userSpaceComplexity: null,
        notes: '',
        language: 'python',
        dateAdded: baseDate.toISOString(),
        dateFirstAttempt: null,
        dateSolved: baseDate.toISOString(),
        updatedAt: baseDate.toISOString(),
      };

      // Past review date => overdue
      const overdueProblem: Problem = {
        ...baseProblem,
        nextReviewDate: subDays(baseDate, 2).toISOString(),
      };
      expect(isProblemOverdue(overdueProblem, baseDate)).toBe(true);

      // Due today => not overdue
      const dueTodayProblem: Problem = {
        ...baseProblem,
        nextReviewDate: baseDate.toISOString(),
      };
      expect(isProblemOverdue(dueTodayProblem, baseDate)).toBe(false);

      // Future review date => not overdue
      const futureProblem: Problem = {
        ...baseProblem,
        nextReviewDate: addDays(baseDate, 3).toISOString(),
      };
      expect(isProblemOverdue(futureProblem, baseDate)).toBe(false);

      // Not solved => not overdue even with past date
      const unsolvedProblem: Problem = {
        ...baseProblem,
        status: 'In Progress',
        nextReviewDate: subDays(baseDate, 5).toISOString(),
      };
      expect(isProblemOverdue(unsolvedProblem, baseDate)).toBe(false);
    });

    it('sorts overdue and highly urgent items first', () => {
      const p1Upcoming: Problem = {
        id: 'p-up',
        number: 1,
        title: 'Upcoming',
        url: null,
        statement: '',
        difficulty: 'Medium',
        topics: [],
        patterns: [],
        status: 'Solved',
        confidence: 4,
        timeSpentMinutes: 30,
        hintsUsed: 0,
        starred: false,
        userTimeComplexity: null,
        userSpaceComplexity: null,
        notes: '',
        language: 'python',
        dateAdded: baseDate.toISOString(),
        dateFirstAttempt: null,
        dateSolved: baseDate.toISOString(),
        updatedAt: baseDate.toISOString(),
        nextReviewDate: addDays(baseDate, 10).toISOString(),
        reviewIntervalDays: 10,
      };

      const p2Overdue: Problem = {
        id: 'p-over',
        number: 2,
        title: 'Overdue Struggle',
        url: null,
        statement: '',
        difficulty: 'Hard',
        topics: [],
        patterns: [],
        status: 'Solved',
        confidence: 1, // Lost
        timeSpentMinutes: 60,
        hintsUsed: 3, // 3 hints
        starred: false,
        userTimeComplexity: null,
        userSpaceComplexity: null,
        notes: '',
        language: 'python',
        dateAdded: subDays(baseDate, 5).toISOString(),
        dateFirstAttempt: null,
        dateSolved: subDays(baseDate, 5).toISOString(),
        updatedAt: subDays(baseDate, 5).toISOString(),
        nextReviewDate: subDays(baseDate, 3).toISOString(), // 3 days overdue
        reviewIntervalDays: 2,
      };

      const sorted = sortByReviewUrgency([p1Upcoming, p2Overdue], baseDate);
      expect(sorted[0].id).toBe('p-over');
      expect(sorted[1].id).toBe('p-up');
    });
  });
});
