import { describe, it, expect, beforeEach } from 'vitest';
import {
  db,
  problemsRepo,
  attemptsRepo,
  mentorRepo,
  noteReviewsRepo,
  settingsRepo,
  clearAllLocalData,
} from '../index';
import { generateUuid } from '../../utils/uuid';

describe('Data Layer & Repositories', () => {
  beforeEach(async () => {
    await clearAllLocalData();
  });

  describe('UUID generation', () => {
    it('generates valid RFC4122 v4 formatted UUIDs', () => {
      const id = generateUuid();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('generates unique UUIDs', () => {
      const set = new Set();
      for (let i = 0; i < 100; i++) {
        set.add(generateUuid());
      }
      expect(set.size).toBe(100);
    });
  });

  describe('Settings Repository', () => {
    it('returns default settings when unset', async () => {
      const settings = await settingsRepo.get();
      expect(settings.geminiApiKey).toBe('');
      expect(settings.model).toBe('gemini-flash-lite-latest');
      expect(settings.defaultLanguage).toBe('python');
      expect(settings.theme).toBe('system');
      expect(settings.temperature).toBe(0.4);
    });

    it('updates settings and preserves other values', async () => {
      await settingsRepo.update({ geminiApiKey: 'test-key-123', temperature: 0.7 });
      const updated = await settingsRepo.get();
      expect(updated.geminiApiKey).toBe('test-key-123');
      expect(updated.temperature).toBe(0.7);
      expect(updated.model).toBe('gemini-flash-lite-latest');
    });

    it('increments daily request count', async () => {
      const count1 = await settingsRepo.incrementDailyUsage();
      const count2 = await settingsRepo.incrementDailyUsage();
      expect(count1).toBe(1);
      expect(count2).toBe(2);
      const current = await settingsRepo.get();
      expect(current.dailyRequestCount).toBe(2);
    });
  });

  describe('Problems Repository & Cascading Delete', () => {
    it('creates a problem with trimmed title, uuid, and timestamps', async () => {
      const problem = await problemsRepo.create({
        number: 1,
        title: '  Two Sum  ',
        url: 'https://leetcode.com/problems/two-sum/',
        statement: 'Find two indices.',
        difficulty: 'Easy',
        topics: ['Array', 'Hash Table'],
        patterns: ['Two Pointers'],
        status: 'Not Started',
        confidence: null,
        timeSpentMinutes: null,
        hintsUsed: 0,
        starred: false,
        userTimeComplexity: null,
        userSpaceComplexity: null,
        notes: '',
        language: 'python',
        dateFirstAttempt: null,
        dateSolved: null,
      });

      expect(problem.id).toBeDefined();
      expect(problem.title).toBe('Two Sum');
      expect(problem.dateAdded).toBeDefined();
      expect(problem.updatedAt).toBe(problem.dateAdded);

      const found = await problemsRepo.getById(problem.id);
      expect(found).toBeDefined();
      expect(found?.title).toBe('Two Sum');
    });

    it('finds problem by problem number', async () => {
      await problemsRepo.create({
        number: 42,
        title: 'Trapping Rain Water',
        url: null,
        statement: '',
        difficulty: 'Hard',
        topics: ['Array'],
        patterns: [],
        status: 'Not Started',
        confidence: null,
        timeSpentMinutes: null,
        hintsUsed: 0,
        starred: false,
        userTimeComplexity: null,
        userSpaceComplexity: null,
        notes: '',
        language: 'python',
        dateFirstAttempt: null,
        dateSolved: null,
      });

      const found = await problemsRepo.getByNumber(42);
      expect(found?.title).toBe('Trapping Rain Water');
    });

    it('cascades delete across attempts, mentor messages, and note reviews in a transaction', async () => {
      const problem = await problemsRepo.create({
        number: 100,
        title: 'Same Tree',
        url: null,
        statement: '',
        difficulty: 'Easy',
        topics: ['Tree'],
        patterns: ['DFS'],
        status: 'Not Started',
        confidence: null,
        timeSpentMinutes: null,
        hintsUsed: 0,
        starred: false,
        userTimeComplexity: null,
        userSpaceComplexity: null,
        notes: '',
        language: 'python',
        dateFirstAttempt: null,
        dateSolved: null,
      });

      // Add 2 attempts
      const att1 = await attemptsRepo.create({
        problemId: problem.id,
        code: 'def isSameTree(): pass',
        language: 'python',
      });
      const att2 = await attemptsRepo.create({
        problemId: problem.id,
        code: 'def isSameTree(): return True',
        language: 'python',
      });
      expect(att1.id).toBeDefined();
      expect(att2.id).toBeDefined();

      // Add 1 mentor message
      await mentorRepo.saveMessage({
        problemId: problem.id,
        level: 1,
        content: 'Check base case first.',
        model: 'gemini-flash-lite-latest',
      });

      // Add 1 note review
      await noteReviewsRepo.create({
        problemId: problem.id,
        notesSnapshot: 'Recursively compare nodes',
        rating: 5,
        verdict: 'solid',
        corrections: [],
        gaps: [],
        strengths: ['Great!'],
        keyTakeaway: 'DFS recursion is natural for trees',
        recallQuestions: ['What is the base case?'],
        model: 'gemini-flash-lite-latest',
      });

      // Verify records exist
      expect(await db.attempts.where('problemId').equals(problem.id).count()).toBe(2);
      expect(await db.mentorMessages.where('problemId').equals(problem.id).count()).toBe(1);
      expect(await db.noteReviews.where('problemId').equals(problem.id).count()).toBe(1);

      // Perform cascading delete (FR-1.5, NFR-4)
      await problemsRepo.delete(problem.id);

      // Verify all related rows are deleted
      expect(await problemsRepo.getById(problem.id)).toBeUndefined();
      expect(await db.attempts.where('problemId').equals(problem.id).count()).toBe(0);
      expect(await db.mentorMessages.where('problemId').equals(problem.id).count()).toBe(0);
      expect(await db.noteReviews.where('problemId').equals(problem.id).count()).toBe(0);
    });
  });

  describe('Attempts Repository — Monotonic Numbering & Auto Status Transition', () => {
    it('enforces monotonic 1-indexed attempt numbers per problem', async () => {
      const p1 = await problemsRepo.create({
        number: 200,
        title: 'Number of Islands',
        url: null,
        statement: '',
        difficulty: 'Medium',
        topics: [],
        patterns: [],
        status: 'Not Started',
        confidence: null,
        timeSpentMinutes: null,
        hintsUsed: 0,
        starred: false,
        userTimeComplexity: null,
        userSpaceComplexity: null,
        notes: '',
        language: 'python',
        dateFirstAttempt: null,
        dateSolved: null,
      });

      const p2 = await problemsRepo.create({
        number: 201,
        title: 'Bitwise AND',
        url: null,
        statement: '',
        difficulty: 'Medium',
        topics: [],
        patterns: [],
        status: 'Not Started',
        confidence: null,
        timeSpentMinutes: null,
        hintsUsed: 0,
        starred: false,
        userTimeComplexity: null,
        userSpaceComplexity: null,
        notes: '',
        language: 'python',
        dateFirstAttempt: null,
        dateSolved: null,
      });

      const a1_p1 = await attemptsRepo.create({
        problemId: p1.id,
        code: 'attempt 1',
        language: 'python',
      });
      const a2_p1 = await attemptsRepo.create({
        problemId: p1.id,
        code: 'attempt 2',
        language: 'python',
      });

      const a1_p2 = await attemptsRepo.create({
        problemId: p2.id,
        code: 'attempt 1 on p2',
        language: 'python',
      });

      expect(a1_p1.attemptNumber).toBe(1);
      expect(a2_p1.attemptNumber).toBe(2);
      expect(a1_p2.attemptNumber).toBe(1);

      // Check auto status transition Not Started -> In Progress (FR-7.2)
      const refreshedP1 = await problemsRepo.getById(p1.id);
      expect(refreshedP1?.status).toBe('In Progress');
      expect(refreshedP1?.dateFirstAttempt).toBeDefined();
    });

    it('attaches review to attempt and does not mutate earlier attempts', async () => {
      const problem = await problemsRepo.create({
        number: 1,
        title: 'Test',
        url: null,
        statement: '',
        difficulty: 'Easy',
        topics: [],
        patterns: [],
        status: 'In Progress',
        confidence: null,
        timeSpentMinutes: null,
        hintsUsed: 0,
        starred: false,
        userTimeComplexity: null,
        userSpaceComplexity: null,
        notes: '',
        language: 'python',
        dateFirstAttempt: null,
        dateSolved: null,
      });

      const attempt1 = await attemptsRepo.create({
        problemId: problem.id,
        code: 'first code',
        language: 'python',
      });

      const attempt2 = await attemptsRepo.create({
        problemId: problem.id,
        code: 'second code',
        language: 'python',
      });

      await attemptsRepo.attachReview(attempt1.id, {
        verdict: 'revise',
        summary: 'Revise code',
        correctness: { status: 'incorrect', failingCases: ['edge case'] },
        complexity: { time: 'O(n^2)', space: 'O(1)', optimalTime: 'O(n)', optimalSpace: 'O(n)', isOptimal: false },
        issues: [{ severity: 'major', title: 'Slow', detail: 'Nested loop', suggestion: 'Use map' }],
        positives: ['Good try'],
        nextStep: 'Fix nested loop',
        model: 'test-model',
        createdAt: new Date().toISOString(),
      });

      const refreshedAtt1 = await db.attempts.get(attempt1.id);
      const refreshedAtt2 = await db.attempts.get(attempt2.id);

      expect(refreshedAtt1?.review?.verdict).toBe('revise');
      expect(refreshedAtt2?.review).toBeNull();
    });
  });

  describe('Mentor Repository — Gated Hint Progression & Hint Counters', () => {
    it('updates problem hintsUsed on save and auto-transitions status', async () => {
      const problem = await problemsRepo.create({
        number: 300,
        title: 'LIS',
        url: null,
        statement: '',
        difficulty: 'Medium',
        topics: [],
        patterns: [],
        status: 'Not Started',
        confidence: null,
        timeSpentMinutes: null,
        hintsUsed: 0,
        starred: false,
        userTimeComplexity: null,
        userSpaceComplexity: null,
        notes: '',
        language: 'python',
        dateFirstAttempt: null,
        dateSolved: null,
      });

      await mentorRepo.saveMessage({
        problemId: problem.id,
        level: 2,
        content: 'Hint 2 content',
        model: 'test-model',
      });

      const refreshed = await problemsRepo.getById(problem.id);
      expect(refreshed?.hintsUsed).toBe(2);
      expect(refreshed?.status).toBe('In Progress');
      expect(refreshed?.dateFirstAttempt).toBeDefined();

      const msg = await mentorRepo.getByLevel(problem.id, 2);
      expect(msg?.content).toBe('Hint 2 content');
    });
  });

  describe('Clear all local data', () => {
    it('clears all tables and restores default settings', async () => {
      await problemsRepo.create({
        number: 1,
        title: 'Two Sum',
        url: null,
        statement: 'Given an array...',
        difficulty: 'Easy',
        topics: [],
        patterns: [],
        status: 'Not Started',
        confidence: null,
        timeSpentMinutes: null,
        hintsUsed: 0,
        starred: false,
        userTimeComplexity: null,
        userSpaceComplexity: null,
        notes: '',
        language: 'python',
        dateFirstAttempt: null,
        dateSolved: null,
      });
      expect((await problemsRepo.getAll()).length).toBe(1);

      await clearAllLocalData();

      expect((await problemsRepo.getAll()).length).toBe(0);
      expect((await settingsRepo.get()).theme).toBe('system');
    });
  });

  describe('Intelligent Review Scheduling (DSA-SRS) Data Layer', () => {
    it('automatically schedules next review date when problem is solved', async () => {
      const problem = await problemsRepo.create({
        number: 1,
        title: 'Two Sum',
        url: null,
        statement: '',
        difficulty: 'Easy',
        topics: ['Array'],
        patterns: ['Hash Table'],
        status: 'Solved',
        confidence: 4,
        timeSpentMinutes: 15,
        hintsUsed: 0,
        starred: false,
        userTimeComplexity: null,
        userSpaceComplexity: null,
        notes: '',
        language: 'python',
        dateFirstAttempt: null,
        dateSolved: new Date().toISOString(),
      });

      expect(problem.nextReviewDate).toBeDefined();
      expect(problem.reviewIntervalDays).toBeGreaterThan(10);
      expect(problem.reviewStage).toBe('learning');
      expect(problem.repetitionCount).toBe(0);
    });

    it('advances review stage and interval when completeReview is called', async () => {
      const problem = await problemsRepo.create({
        number: 15,
        title: '3Sum',
        url: null,
        statement: '',
        difficulty: 'Medium',
        topics: ['Array'],
        patterns: ['Two Pointers'],
        status: 'Solved',
        confidence: 3,
        timeSpentMinutes: 30,
        hintsUsed: 1,
        starred: false,
        userTimeComplexity: null,
        userSpaceComplexity: null,
        notes: 'Initial solve',
        language: 'python',
        dateFirstAttempt: null,
        dateSolved: new Date().toISOString(),
      });

      const initialInterval = problem.reviewIntervalDays!;

      const reviewed = await problemsRepo.completeReview(problem.id, {
        confidence: 4,
        timeSpentMinutes: 15,
        notes: 'Revised with clean two-pointer approach',
      });

      expect(reviewed.repetitionCount).toBe(1);
      expect(reviewed.reviewStage).toBe('reviewing');
      expect(reviewed.reviewIntervalDays).toBeGreaterThan(initialInterval);
      expect(reviewed.notes).toBe('Revised with clean two-pointer approach');
      expect(reviewed.lastReviewedAt).toBeDefined();
    });

    it('filters review queue by due items and low confidence, sorted by urgency', async () => {
      // Problem A: Solved with low confidence (2)
      await problemsRepo.create({
        number: 101,
        title: 'Symmetric Tree',
        url: null,
        statement: '',
        difficulty: 'Easy',
        topics: ['Tree'],
        patterns: ['DFS'],
        status: 'Solved',
        confidence: 2,
        timeSpentMinutes: 20,
        hintsUsed: 0,
        starred: false,
        userTimeComplexity: null,
        userSpaceComplexity: null,
        notes: '',
        language: 'python',
        dateFirstAttempt: null,
        dateSolved: new Date().toISOString(),
      });

      // Problem B: In Progress (not solved -> not in review queue)
      await problemsRepo.create({
        number: 102,
        title: 'Binary Tree Level Order',
        url: null,
        statement: '',
        difficulty: 'Medium',
        topics: ['Tree'],
        patterns: ['BFS'],
        status: 'In Progress',
        confidence: null,
        timeSpentMinutes: null,
        hintsUsed: 0,
        starred: false,
        userTimeComplexity: null,
        userSpaceComplexity: null,
        notes: '',
        language: 'python',
        dateFirstAttempt: null,
        dateSolved: null,
      });

      const reviewQueueItems = await problemsRepo.list({ reviewQueueOnly: true });
      expect(reviewQueueItems.length).toBe(1);
      expect(reviewQueueItems[0].title).toBe('Symmetric Tree');
    });
  });
});
