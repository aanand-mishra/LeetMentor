import Dexie, { type Table } from 'dexie';
import type {
  Problem,
  Attempt,
  CodeReview,
  MentorMessage,
  NoteReview,
  RevisionRecord,
  Settings,
  ProblemFilterParams,
  Difficulty,
  Status,
} from '../types';
import { generateUuid } from '../utils/uuid';
import {
  calculateNextReview,
  isProblemInReviewQueue,
  isProblemOverdue,
  sortByReviewUrgency,
} from '../utils/reviewScheduler';

class LeetMentorDB extends Dexie {
  problems!: Table<Problem, string>;
  attempts!: Table<Attempt, string>;
  mentorMessages!: Table<MentorMessage, string>;
  noteReviews!: Table<NoteReview, string>;
  revisions!: Table<RevisionRecord, string>;
  settings!: Table<Settings, string>;

  constructor() {
    // DO NOT RENAME. This is the product's pre-LeetMentor name, but it is the
    // physical IndexedDB key holding every user's problems, attempts, notes,
    // revisions, settings and Gemini API key. Renaming it opens a fresh empty
    // database and silently makes all existing data unreachable.
    // The product was renamed to LeetMentor; this identifier was intentionally
    // kept for backwards compatibility. See README "Legacy identifiers".
    super('dsa-tracker');
    this.version(1).stores({
      problems:
        'id, number, title, difficulty, status, confidence, dateAdded, dateSolved, updatedAt, *topics',
      attempts: 'id, problemId, attemptNumber, createdAt',
      mentorMessages: 'id, problemId, level, createdAt',
      noteReviews: 'id, problemId, createdAt',
      settings: 'key',
    });
    this.version(2).stores({
      visualizations: null,
    });
    this.version(3).stores({
      problems:
        'id, number, title, difficulty, status, confidence, dateAdded, dateSolved, updatedAt, *topics, nextReviewDate',
    });
    this.version(4).stores({
      revisions: 'id, problemId, revisionNumber, completedAt',
    });
  }
}

export const db = new LeetMentorDB();

// Helper to get today's date in YYYY-MM-DD
function getTodayDateString(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

// Default Settings
const DEFAULT_SETTINGS: Settings = {
  key: 'current',
  geminiApiKey: '',
  model: 'gemini-flash-lite-latest',
  defaultLanguage: 'python',
  responseLanguage: 'English',
  theme: 'system',
  temperature: 0.4,
  dailyRequestCount: 0,
  dailyRequestDate: getTodayDateString(),
  lastExportDate: null,
  hasConfiguredApiKey: false,
};

// ==========================================
// Problems Repository
// ==========================================
export const problemsRepo = {
  async create(
    data: Partial<Omit<Problem, 'id' | 'dateAdded' | 'updatedAt'>> & {
      title: string;
    }
  ): Promise<Problem> {
    const now = new Date().toISOString();
    const difficulty: Difficulty = data.difficulty || 'Medium';
    let status: Status = data.status || 'Not Started';
    let manuallyMarkedSolved = data.manuallyMarkedSolved;
    let dateSolved: string | null = data.dateSolved ?? null;

    // When time spent is set, auto-set status to Solved
    if (
      data.timeSpentMinutes !== undefined &&
      data.timeSpentMinutes !== null &&
      data.timeSpentMinutes >= 0
    ) {
      status = 'Solved';
      if (manuallyMarkedSolved === undefined) {
        // Without an AI review verdict pass, it's manually solved*
        manuallyMarkedSolved = true;
      }
      if (!dateSolved) {
        dateSolved = now;
      }
    }

    let nextReviewDate = data.nextReviewDate;
    let reviewIntervalDays = data.reviewIntervalDays;
    let reviewStage = data.reviewStage;
    let easeFactor = data.easeFactor;

    if (status === 'Solved') {
      const schedule = calculateNextReview({
        difficulty,
        confidence: data.confidence || 3,
        hintsUsed: data.hintsUsed || 0,
        timeSpentMinutes: data.timeSpentMinutes ?? null,
        attemptsCount: 1,
        previousIntervalDays: data.reviewIntervalDays ?? null,
        previousEaseFactor: data.easeFactor,
        previousRepetitionCount: data.repetitionCount ?? 0,
        baseDate: dateSolved || now,
      });
      nextReviewDate = data.nextReviewDate || schedule.nextReviewDate;
      reviewIntervalDays = data.reviewIntervalDays ?? schedule.intervalDays;
      reviewStage = data.reviewStage || schedule.stage;
      easeFactor = data.easeFactor ?? schedule.easeFactor;
    }

    const problem: Problem = {
      number: null,
      url: '',
      difficulty,
      topics: [],
      patterns: [],
      starred: false,
      confidence: null,
      timeSpentMinutes: null,
      notes: '',
      statement: '',
      language: 'python',
      dateFirstAttempt: null,
      userTimeComplexity: null,
      userSpaceComplexity: null,
      ...data,
      hintsUsed: data.hintsUsed || 0,
      id: generateUuid(),
      title: data.title.trim(),
      status,
      manuallyMarkedSolved,
      dateSolved,
      nextReviewDate,
      reviewIntervalDays,
      reviewStage,
      easeFactor,
      repetitionCount: data.repetitionCount ?? (status === 'Solved' ? 0 : undefined),
      dateAdded: now,
      updatedAt: now,
    };
    await db.problems.add(problem);
    return problem;
  },

  async update(id: string, data: Partial<Problem>): Promise<Problem> {
    const existing = await db.problems.get(id);
    if (!existing) {
      throw new Error(`Problem with id ${id} not found`);
    }

    const updates: Partial<Problem> = { ...data };

    // When time spent is set, auto-set status to Solved
    if (
      updates.timeSpentMinutes !== undefined &&
      updates.timeSpentMinutes !== null &&
      updates.timeSpentMinutes >= 0
    ) {
      // Check if there was an AI verdict as pass or solved set by AI
      const attempts = await db.attempts.where('problemId').equals(id).toArray();
      const hasPassingReview = attempts.some((a) => a.review?.verdict === 'pass');
      const isSolvedByAi =
        hasPassingReview ||
        (existing.status === 'Solved' && existing.manuallyMarkedSolved === false);

      updates.status = 'Solved';
      if (updates.manuallyMarkedSolved === undefined) {
        updates.manuallyMarkedSolved = !isSolvedByAi;
      }
      if (!updates.dateSolved && !existing.dateSolved) {
        updates.dateSolved = new Date().toISOString();
      }
    }

    const updated: Problem = {
      ...existing,
      ...updates,
      title: updates.title !== undefined ? updates.title.trim() : existing.title,
      updatedAt: new Date().toISOString(),
    };

    // Auto-calculate review schedule if solved and confidence changed or schedule missing
    if (updated.status === 'Solved') {
      const confidenceChanged =
        updates.confidence !== undefined && updates.confidence !== existing.confidence;
      const statusBecameSolved = existing.status !== 'Solved';
      const missingSchedule = !updated.nextReviewDate;

      if (
        updates.nextReviewDate === undefined &&
        (confidenceChanged || statusBecameSolved || missingSchedule)
      ) {
        const attemptsCount = await db.attempts.where('problemId').equals(id).count();
        const schedule = calculateNextReview({
          difficulty: updated.difficulty,
          confidence: updated.confidence || 3,
          hintsUsed: updated.hintsUsed || 0,
          timeSpentMinutes: updated.timeSpentMinutes ?? null,
          attemptsCount: Math.max(1, attemptsCount),
          previousIntervalDays: updated.reviewIntervalDays ?? null,
          previousEaseFactor: updated.easeFactor,
          previousRepetitionCount: updated.repetitionCount ?? 0,
          baseDate: updated.dateSolved || existing.dateSolved || new Date().toISOString(),
        });
        updated.nextReviewDate = schedule.nextReviewDate;
        updated.reviewIntervalDays = schedule.intervalDays;
        updated.reviewStage = schedule.stage;
        updated.easeFactor = schedule.easeFactor;
        if (updated.repetitionCount === undefined) {
          updated.repetitionCount = 0;
        }
      }
    } else if (updates.status && updates.status !== 'Solved') {
      updated.nextReviewDate = null;
      updated.reviewIntervalDays = null;
      updated.reviewStage = undefined;
    }

    await db.problems.put(updated);
    return updated;
  },

  /**
   * Records a completed revision session for spaced repetition (DSA-SRS).
   */
  async completeReview(
    id: string,
    data: {
      confidence: 1 | 2 | 3 | 4 | 5;
      timeSpentMinutes?: number;
      notes?: string;
    }
  ): Promise<Problem> {
    const existing = await db.problems.get(id);
    if (!existing) {
      throw new Error(`Problem with id ${id} not found`);
    }

    const attemptsCount = await db.attempts.where('problemId').equals(id).count();
    const now = new Date().toISOString();

    const schedule = calculateNextReview({
      difficulty: existing.difficulty,
      confidence: data.confidence,
      hintsUsed: existing.hintsUsed || 0,
      timeSpentMinutes: data.timeSpentMinutes ?? existing.timeSpentMinutes,
      attemptsCount: Math.max(1, attemptsCount),
      previousIntervalDays: existing.reviewIntervalDays ?? null,
      previousEaseFactor: existing.easeFactor,
      previousRepetitionCount: existing.repetitionCount ?? 0,
      isReviewSession: true,
      baseDate: now,
    });

    const updated: Problem = {
      ...existing,
      confidence: data.confidence,
      lastReviewedAt: now,
      nextReviewDate: schedule.nextReviewDate,
      reviewIntervalDays: schedule.intervalDays,
      repetitionCount: schedule.repetitionCount,
      easeFactor: schedule.easeFactor,
      reviewStage: schedule.stage,
      timeSpentMinutes:
        data.timeSpentMinutes !== undefined
          ? (existing.timeSpentMinutes ?? 0) + data.timeSpentMinutes
          : existing.timeSpentMinutes,
      notes: data.notes !== undefined ? data.notes : existing.notes,
      updatedAt: now,
    };

    await db.problems.put(updated);
    return updated;
  },

  /**
   * Archives the current problem workspace state (attempts, hints, reviews, notes, time, confidence)
   * into a permanent RevisionRecord, and resets the active workspace to a clean slate
   * (0 attempts, hints re-locked to avoid spoilers, time reset, status 'In Progress')
   * for a genuine, fresh revision test.
   */
  async startNewRevision(id: string): Promise<{ problem: Problem; revision: RevisionRecord }> {
    const problem = await db.problems.get(id);
    if (!problem) {
      throw new Error(`Problem with id ${id} not found`);
    }

    const attempts = await db.attempts.where('problemId').equals(id).toArray();
    const mentorMessages = await db.mentorMessages.where('problemId').equals(id).toArray();
    const noteReviews = await db.noteReviews.where('problemId').equals(id).toArray();
    const existingRevisions = await db.revisions.where('problemId').equals(id).toArray();

    const now = new Date().toISOString();
    const revisionNumber = existingRevisions.length;

    const maxHintUsed = mentorMessages.reduce((max, m) => Math.max(max, m.level), 0);
    const hintsUsed = Math.max(problem.hintsUsed || 0, maxHintUsed) as 0 | 1 | 2 | 3 | 4;

    const revisionSnapshot: RevisionRecord = {
      id: generateUuid(),
      problemId: id,
      revisionNumber,
      title: `Revision #${revisionNumber}`,
      startedAt: problem.dateFirstAttempt || problem.dateAdded,
      completedAt: problem.dateSolved || now,
      timeSpentMinutes: problem.timeSpentMinutes ?? null,
      confidence: problem.confidence ?? null,
      hintsUsed,
      attemptsCount: attempts.length,
      attempts: attempts.sort((a, b) => a.attemptNumber - b.attemptNumber),
      mentorMessages: mentorMessages.sort((a, b) => a.level - b.level),
      notes: problem.notes || '',
      noteReviews: noteReviews.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ),
      statusAtSnapshot: problem.status,
    };

    await db.transaction(
      'rw',
      [db.problems, db.attempts, db.mentorMessages, db.noteReviews, db.revisions],
      async () => {
        await db.revisions.add(revisionSnapshot);

        // Wipe active attempts, hints, note reviews so the workspace is clean and spoiler-free
        await db.attempts.where('problemId').equals(id).delete();
        await db.mentorMessages.where('problemId').equals(id).delete();
        await db.noteReviews.where('problemId').equals(id).delete();

        // Reset active problem state
        const updated: Problem = {
          ...problem,
          status: 'In Progress',
          confidence: null,
          timeSpentMinutes: null,
          hintsUsed: 0,
          notes: '',
          dateFirstAttempt: now,
          dateSolved: null,
          repetitionCount: (problem.repetitionCount ?? 0) + 1,
          updatedAt: now,
        };

        await db.problems.put(updated);
      }
    );

    const refreshed = await db.problems.get(id);
    return { problem: refreshed!, revision: revisionSnapshot };
  },

  /**
   * Cascading delete inside a Dexie transaction (NFR-4, FR-1.5)
   */
  async delete(id: string): Promise<void> {
    await db.transaction(
      'rw',
      [db.problems, db.attempts, db.mentorMessages, db.noteReviews, db.revisions],
      async () => {
        await db.problems.delete(id);
        await db.attempts.where('problemId').equals(id).delete();
        await db.mentorMessages.where('problemId').equals(id).delete();
        await db.noteReviews.where('problemId').equals(id).delete();
        await db.revisions.where('problemId').equals(id).delete();
      }
    );
  },

  async getById(id: string): Promise<Problem | undefined> {
    return db.problems.get(id);
  },

  async getByNumber(num: number): Promise<Problem | undefined> {
    return db.problems.where('number').equals(num).first();
  },

  async getAll(): Promise<Problem[]> {
    return db.problems.toArray();
  },

  /**
   * Filter, search and sort problems
   */
  async list(params: ProblemFilterParams = {}): Promise<Problem[]> {
    let items = await db.problems.toArray();

    // 1. Search Query: whitespace-separated tokens, AND-ed across tokens, matching case-insensitively
    if (params.query && params.query.trim()) {
      const tokens = params.query.toLowerCase().trim().split(/\s+/).filter(Boolean);
      items = items.filter((p) => {
        const acronyms = [
          ...(p.topics || []).map((t) =>
            t
              .split(/\s+/)
              .map((w) => w[0])
              .join('')
              .toLowerCase()
          ),
          ...(p.patterns || []).map((pt) =>
            pt
              .split(/\s+/)
              .map((w) => w[0])
              .join('')
              .toLowerCase()
          ),
        ];
        const textFields = [
          p.title.toLowerCase(),
          p.number !== null ? String(p.number) : '',
          ...(p.topics || []).map((t) => t.toLowerCase()),
          ...(p.patterns || []).map((pt) => pt.toLowerCase()),
          ...acronyms,
        ];
        return tokens.every((token) => textFields.some((field) => field.includes(token)));
      });
    }

    // 2. Filters
    // Difficulty (OR within facet)
    if (params.difficulty && params.difficulty.length > 0) {
      const set = new Set<Difficulty>(params.difficulty);
      items = items.filter((p) => set.has(p.difficulty));
    }

    // Status (OR within facet)
    if (params.status && params.status.length > 0) {
      const set = new Set<Status>(params.status);
      items = items.filter((p) => set.has(p.status));
    }

    // Topics (OR within facet)
    if (params.topics && params.topics.length > 0) {
      const set = new Set(params.topics.map((t) => t.toLowerCase()));
      items = items.filter((p) => p.topics?.some((t) => set.has(t.toLowerCase())));
    }

    // Patterns (OR within facet)
    if (params.patterns && params.patterns.length > 0) {
      const set = new Set(params.patterns.map((pt) => pt.toLowerCase()));
      items = items.filter((p) => p.patterns?.some((pt) => set.has(pt.toLowerCase())));
    }

    // Confidence
    if (params.confidence && params.confidence.length > 0) {
      const hasUnrated = params.confidence.includes('unrated');
      const numericRatings = new Set(
        params.confidence.filter((c): c is 1 | 2 | 3 | 4 | 5 => c !== 'unrated')
      );

      items = items.filter((p) => {
        if (p.confidence === null) return hasUnrated;
        return numericRatings.has(p.confidence);
      });
    }

    // Starred only
    if (params.starredOnly) {
      items = items.filter((p) => p.starred);
    }

    // Review queue: intelligent spaced repetition (due/overdue OR low confidence <= 3)
    if (params.reviewQueueOnly) {
      items = items.filter((p) => isProblemInReviewQueue(p));
    }

    // Overdue only: scheduled review date has passed
    if (params.overdueOnly) {
      items = items.filter((p) => isProblemOverdue(p));
    }

    // 3. Sorting (Default review queue/overdue sort: reviewUrgency_desc, else dateAdded_desc)
    const sort =
      (params.reviewQueueOnly || params.overdueOnly) && !params.sort
        ? 'reviewUrgency_desc'
        : params.sort || 'dateAdded_desc';

    if (sort === 'reviewUrgency_desc') {
      items = sortByReviewUrgency(items);
    } else {
      items.sort((a, b) => {
        switch (sort) {
          case 'nextReview_asc': {
            const rA = a.nextReviewDate ? new Date(a.nextReviewDate).getTime() : Infinity;
            const rB = b.nextReviewDate ? new Date(b.nextReviewDate).getTime() : Infinity;
            return rA - rB;
          }
          case 'dateAdded_desc':
            return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime();
          case 'dateAdded_asc':
            return new Date(a.dateAdded).getTime() - new Date(b.dateAdded).getTime();
          case 'dateSolved_desc': {
            const tA = a.dateSolved ? new Date(a.dateSolved).getTime() : 0;
            const tB = b.dateSolved ? new Date(b.dateSolved).getTime() : 0;
            return tB - tA;
          }
          case 'dateSolved_asc': {
            const tA = a.dateSolved ? new Date(a.dateSolved).getTime() : Infinity;
            const tB = b.dateSolved ? new Date(b.dateSolved).getTime() : Infinity;
            return tA - tB;
          }
          case 'number_asc': {
            const nA = a.number ?? Infinity;
            const nB = b.number ?? Infinity;
            return nA - nB;
          }
          case 'number_desc': {
            const nA = a.number ?? -1;
            const nB = b.number ?? -1;
            return nB - nA;
          }
          case 'title_asc':
            return a.title.localeCompare(b.title);
          case 'title_desc':
            return b.title.localeCompare(a.title);
          case 'difficulty_asc': {
            const order: Record<Difficulty, number> = { Easy: 1, Medium: 2, Hard: 3 };
            return order[a.difficulty] - order[b.difficulty];
          }
          case 'difficulty_desc': {
            const order: Record<Difficulty, number> = { Easy: 1, Medium: 2, Hard: 3 };
            return order[b.difficulty] - order[a.difficulty];
          }
          case 'confidence_asc': {
            const cA = a.confidence ?? Infinity;
            const cB = b.confidence ?? Infinity;
            if (cA !== cB) return cA - cB;
            // Tie breaker for review queue: dateSolved ascending
            const tA = a.dateSolved ? new Date(a.dateSolved).getTime() : Infinity;
            const tB = b.dateSolved ? new Date(b.dateSolved).getTime() : Infinity;
            return tA - tB;
          }
          case 'confidence_desc': {
            const cA = a.confidence ?? -1;
            const cB = b.confidence ?? -1;
            return cB - cA;
          }
          case 'timeSpent_desc':
            return (b.timeSpentMinutes ?? -1) - (a.timeSpentMinutes ?? -1);
          case 'timeSpent_asc':
            return (a.timeSpentMinutes ?? Infinity) - (b.timeSpentMinutes ?? Infinity);
          default:
            return 0;
        }
      });
    }

    return items;
  },
};

// ==========================================
// Attempts Repository
// ==========================================
export const attemptsRepo = {
  /**
   * Creates an attempt with monotonic attemptNumber per problem (FR-4.2)
   */
  async create(data: {
    problemId: string;
    code: string;
    language: string;
    userComment?: string;
    review?: CodeReview | null;
  }): Promise<Attempt> {
    return db.transaction('rw', [db.attempts, db.problems], async () => {
      // Find max existing attemptNumber
      const existing = await db.attempts.where('problemId').equals(data.problemId).toArray();

      const maxNumber = existing.reduce((max, curr) => Math.max(max, curr.attemptNumber), 0);
      const attemptNumber = maxNumber + 1;

      const attempt: Attempt = {
        id: generateUuid(),
        problemId: data.problemId,
        attemptNumber,
        code: data.code,
        language: data.language,
        userComment: data.userComment || '',
        createdAt: new Date().toISOString(),
        review: data.review || null,
      };

      await db.attempts.add(attempt);

      // Auto-transition problem status: Not Started -> In Progress on 1st attempt (FR-7.2)
      const problem = await db.problems.get(data.problemId);
      if (problem && problem.status === 'Not Started') {
        await db.problems.update(data.problemId, {
          status: 'In Progress',
          dateFirstAttempt: problem.dateFirstAttempt || attempt.createdAt,
          updatedAt: new Date().toISOString(),
        });
      }

      return attempt;
    });
  },

  async attachReview(attemptId: string, review: CodeReview): Promise<void> {
    await db.attempts.update(attemptId, { review });
  },

  async listForProblem(problemId: string): Promise<Attempt[]> {
    const list = await db.attempts.where('problemId').equals(problemId).toArray();
    return list.sort((a, b) => b.attemptNumber - a.attemptNumber); // Newest first
  },

  async getLatestForProblem(problemId: string): Promise<Attempt | undefined> {
    const list = await this.listForProblem(problemId);
    return list[0];
  },

  async countForProblem(problemId: string): Promise<number> {
    return db.attempts.where('problemId').equals(problemId).count();
  },
};

// ==========================================
// Mentor Messages Repository
// ==========================================
export const mentorRepo = {
  async getByLevel(problemId: string, level: 1 | 2 | 3 | 4): Promise<MentorMessage | undefined> {
    return db.mentorMessages
      .where('problemId')
      .equals(problemId)
      .and((msg) => msg.level === level)
      .first();
  },

  async listForProblem(problemId: string): Promise<MentorMessage[]> {
    const messages = await db.mentorMessages.where('problemId').equals(problemId).toArray();
    return messages.sort((a, b) => a.level - b.level);
  },

  /**
   * Save or replace message for a given level
   */
  async saveMessage(data: {
    id?: string;
    problemId: string;
    level: 1 | 2 | 3 | 4;
    content: string;
    model: string;
    createdAt?: string;
  }): Promise<MentorMessage> {
    return db.transaction('rw', [db.mentorMessages, db.problems], async () => {
      const existing = await db.mentorMessages
        .where('problemId')
        .equals(data.problemId)
        .and((m) => m.level === data.level)
        .first();

      const message: MentorMessage = {
        id: data.id || (existing ? existing.id : generateUuid()),
        problemId: data.problemId,
        level: data.level,
        content: data.content,
        model: data.model,
        createdAt: data.createdAt || (existing ? existing.createdAt : new Date().toISOString()),
      };

      await db.mentorMessages.put(message);

      // Update problem hintsUsed = max(hintsUsed, level)
      const problem = await db.problems.get(data.problemId);
      if (problem) {
        const newHintsUsed = Math.max(problem.hintsUsed || 0, data.level) as 0 | 1 | 2 | 3 | 4;
        const updates: Partial<Problem> = {
          hintsUsed: newHintsUsed,
          updatedAt: new Date().toISOString(),
        };
        // Also auto-transition Not Started -> In Progress on 1st hint unlock (FR-7.2)
        if (problem.status === 'Not Started') {
          updates.status = 'In Progress';
          updates.dateFirstAttempt = problem.dateFirstAttempt || message.createdAt;
        }
        await db.problems.update(data.problemId, updates);
      }

      return message;
    });
  },
};

// ==========================================
// Note Reviews Repository
// ==========================================
export const noteReviewsRepo = {
  async create(data: Omit<NoteReview, 'id' | 'createdAt'>): Promise<NoteReview> {
    const review: NoteReview = {
      ...data,
      id: generateUuid(),
      createdAt: new Date().toISOString(),
    };
    await db.noteReviews.add(review);
    return review;
  },

  async listForProblem(problemId: string): Promise<NoteReview[]> {
    const list = await db.noteReviews.where('problemId').equals(problemId).toArray();
    // Newest first (FR-6.5)
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },
};

// ==========================================
// Settings Repository
// ==========================================
export const settingsRepo = {
  async get(): Promise<Settings> {
    const existing = await db.settings.get('current');
    const today = getTodayDateString();

    if (!existing) {
      await db.settings.put(DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    }

    const merged: Settings = {
      ...DEFAULT_SETTINGS,
      ...existing,
    };

    // Reset daily counter if date changed
    if (existing.dailyRequestDate !== today) {
      merged.dailyRequestCount = 0;
      merged.dailyRequestDate = today;
      await db.settings.put(merged);
    }

    return merged;
  },

  async update(partial: Partial<Settings>): Promise<Settings> {
    return db.transaction('rw', db.settings, async () => {
      const existing = await db.settings.get('current');
      const current = existing ? { ...DEFAULT_SETTINGS, ...existing } : DEFAULT_SETTINGS;
      const isConfiguringKey =
        partial.geminiApiKey !== undefined && partial.geminiApiKey.trim().length > 0;
      const updated: Settings = {
        ...current,
        ...partial,
        hasConfiguredApiKey:
          partial.hasConfiguredApiKey ??
          (isConfiguringKey ? true : (current.hasConfiguredApiKey ?? false)),
        key: 'current',
      };
      await db.settings.put(updated);
      return updated;
    });
  },

  async incrementDailyUsage(): Promise<number> {
    const current = await this.get();
    const newCount = current.dailyRequestCount + 1;
    await db.settings.put({
      ...current,
      dailyRequestCount: newCount,
    });
    return newCount;
  },

  async incrementDailyRequestCount(): Promise<number> {
    return this.incrementDailyUsage();
  },
};

// ==========================================
// Revisions Repository
// ==========================================
export const revisionsRepo = {
  async listForProblem(problemId: string): Promise<RevisionRecord[]> {
    const list = await db.revisions.where('problemId').equals(problemId).toArray();
    return list.sort((a, b) => b.revisionNumber - a.revisionNumber); // Newest first
  },

  async getById(id: string): Promise<RevisionRecord | undefined> {
    return db.revisions.get(id);
  },

  async delete(id: string): Promise<void> {
    await db.revisions.delete(id);
  },
};

// ==========================================
// Database utilities (Clear and Danger Zone)
// ==========================================
export async function clearAllLocalData(): Promise<void> {
  try {
    sessionStorage.removeItem('dsa_welcome_banner_dismissed');
    localStorage.removeItem('dsa_welcome_banner_dismissed');
  } catch {
    // Ignore environments where storage is not available
  }
  await db.transaction(
    'rw',
    [db.problems, db.attempts, db.mentorMessages, db.noteReviews, db.revisions, db.settings],
    async () => {
      await db.problems.clear();
      await db.attempts.clear();
      await db.mentorMessages.clear();
      await db.noteReviews.clear();
      await db.revisions.clear();
      await db.settings.clear();
      await db.settings.put(DEFAULT_SETTINGS);
    }
  );
}
