import Dexie, { type Table } from 'dexie';
import type {
  Problem,
  Attempt,
  CodeReview,
  MentorMessage,
  NoteReview,
  Settings,
  ProblemFilterParams,
  Difficulty,
  Status,
} from '../types';
import { generateUuid } from '../utils/uuid';

export class DSATrackerDB extends Dexie {
  problems!: Table<Problem, string>;
  attempts!: Table<Attempt, string>;
  mentorMessages!: Table<MentorMessage, string>;
  noteReviews!: Table<NoteReview, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super('dsa-tracker');
    this.version(1).stores({
      problems: 'id, number, title, difficulty, status, confidence, dateAdded, dateSolved, updatedAt, *topics',
      attempts: 'id, problemId, attemptNumber, createdAt',
      mentorMessages: 'id, problemId, level, createdAt',
      noteReviews: 'id, problemId, createdAt',
      settings: 'key',
    });
  }
}

export const db = new DSATrackerDB();

// Helper to get today's date in YYYY-MM-DD
export function getTodayDateString(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

// Default Settings
export const DEFAULT_SETTINGS: Settings = {
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
};

// ==========================================
// Problems Repository
// ==========================================
export const problemsRepo = {
  async create(data: Omit<Problem, 'id' | 'dateAdded' | 'updatedAt'>): Promise<Problem> {
    const now = new Date().toISOString();
    const problem: Problem = {
      ...data,
      id: generateUuid(),
      title: data.title.trim(),
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

    const updated: Problem = {
      ...existing,
      ...data,
      title: data.title !== undefined ? data.title.trim() : existing.title,
      updatedAt: new Date().toISOString(),
    };

    await db.problems.put(updated);
    return updated;
  },

  /**
   * Cascading delete inside a Dexie transaction (NFR-4, FR-1.5)
   */
  async delete(id: string): Promise<void> {
    await db.transaction('rw', [db.problems, db.attempts, db.mentorMessages, db.noteReviews], async () => {
      await db.problems.delete(id);
      await db.attempts.where('problemId').equals(id).delete();
      await db.mentorMessages.where('problemId').equals(id).delete();
      await db.noteReviews.where('problemId').equals(id).delete();
    });
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
          ...(p.topics || []).map((t) => t.split(/\s+/).map((w) => w[0]).join('').toLowerCase()),
          ...(p.patterns || []).map((pt) => pt.split(/\s+/).map((w) => w[0]).join('').toLowerCase()),
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
      const numericRatings = new Set(params.confidence.filter((c): c is 1 | 2 | 3 | 4 | 5 => c !== 'unrated'));

      items = items.filter((p) => {
        if (p.confidence === null) return hasUnrated;
        return numericRatings.has(p.confidence);
      });
    }

    // Starred only
    if (params.starredOnly) {
      items = items.filter((p) => p.starred);
    }

    // Review queue (FR-2.4: status === 'Solved' && confidence !== null && confidence <= 3)
    if (params.reviewQueueOnly) {
      items = items.filter(
        (p) => p.status === 'Solved' && p.confidence !== null && p.confidence <= 3
      );
    }

    // Has unresolved review (latest attempt verdict is 'revise')
    if (params.unresolvedReviewOnly) {
      const problemIdsWithUnresolved = new Set<string>();
      const allAttempts = await db.attempts.toArray();
      // Group by problemId and find latest
      const latestAttemptsByProblem = new Map<string, Attempt>();
      for (const att of allAttempts) {
        const curr = latestAttemptsByProblem.get(att.problemId);
        if (!curr || att.attemptNumber > curr.attemptNumber) {
          latestAttemptsByProblem.set(att.problemId, att);
        }
      }
      for (const [probId, att] of latestAttemptsByProblem.entries()) {
        if (att.review && att.review.verdict === 'revise') {
          problemIdsWithUnresolved.add(probId);
        }
      }
      items = items.filter((p) => problemIdsWithUnresolved.has(p.id));
    }

    // 3. Sorting (FR-2.4 review queue default sort: confidence asc, then dateSolved asc)
    const sort = params.reviewQueueOnly && !params.sort ? 'confidence_asc' : params.sort || 'dateAdded_desc';

    items.sort((a, b) => {
      switch (sort) {
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
      const existing = await db.attempts
        .where('problemId')
        .equals(data.problemId)
        .toArray();

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
        const newHintsUsed = Math.max(problem.hintsUsed, data.level) as 0 | 1 | 2 | 3 | 4;
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
      const updated: Settings = {
        ...current,
        ...partial,
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
// Database utilities (Clear and Danger Zone)
// ==========================================
export async function clearAllLocalData(): Promise<void> {
  await db.transaction('rw', [db.problems, db.attempts, db.mentorMessages, db.noteReviews, db.settings], async () => {
    await db.problems.clear();
    await db.attempts.clear();
    await db.mentorMessages.clear();
    await db.noteReviews.clear();
    await db.settings.clear();
    await db.settings.put(DEFAULT_SETTINGS);
  });
}
