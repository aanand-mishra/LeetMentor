export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export type Status = 'Not Started' | 'In Progress' | 'Solved';

export interface Problem {
  id: string;                    // uuid v4
  number: number | null;         // Leetcode problem number, optional
  title: string;                 // required, 1-200 chars
  url: string | null;            // optional, must match leetcode.com/problems/* if present
  statement: string;             // optional but strongly encouraged
  difficulty: Difficulty;        // required
  topics: string[];              // e.g. ['Array', 'Hash Table']
  patterns: string[];            // e.g. ['Two Pointers', 'Sliding Window']
  status: Status;                // see transition rules
  confidence: 1 | 2 | 3 | 4 | 5 | null;  // set after solving
  timeSpentMinutes: number | null;
  hintsUsed: 0 | 1 | 2 | 3 | 4;  // highest mentor level unlocked
  starred: boolean;
  userTimeComplexity: string | null;   // user's own claim, e.g. "O(n log n)"
  userSpaceComplexity: string | null;
  notes: string;                 // markdown; "what I learned"
  language: string;              // e.g. 'python', inherits from settings default
  dateAdded: string;             // ISO 8601
  dateFirstAttempt: string | null;
  dateSolved: string | null;
  updatedAt: string;
  manuallyMarkedSolved?: boolean; // manual override flag
}

export interface Attempt {
  id: string;
  problemId: string;
  attemptNumber: number;         // 1-indexed, monotonic per problem
  code: string;                  // pasted plain text
  language: string;
  userComment: string;           // optional: "what I changed this time"
  createdAt: string;
  review: CodeReview | null;     // null until reviewed
}

export interface CodeReviewIssue {
  severity: 'critical' | 'major' | 'minor';
  title: string;
  detail: string;
  suggestion: string;
}

export interface CodeReview {
  verdict: 'pass' | 'revise';
  summary: string;
  correctness: {
    status: 'correct' | 'fails_edge_cases' | 'incorrect';
    failingCases: string[];
  };
  complexity: {
    time: string;
    space: string;
    optimalTime: string;
    optimalSpace: string;
    isOptimal: boolean;
  };
  issues: CodeReviewIssue[];
  positives: string[];
  nextStep: string;
  model: string;
  createdAt: string;
}

export interface MentorMessage {
  id: string;
  problemId: string;
  level: 1 | 2 | 3 | 4;
  content: string;               // markdown
  model: string;
  createdAt: string;
}

export interface NoteCorrection {
  claim: string;
  issue: string;
  correction: string;
}

export interface NoteReview {
  id: string;
  problemId: string;
  notesSnapshot: string;         // the notes text as reviewed
  rating: 1 | 2 | 3 | 4 | 5;
  verdict: 'solid' | 'needs_work';
  corrections: NoteCorrection[];
  gaps: string[];
  strengths: string[];
  keyTakeaway: string;
  recallQuestions: string[];     // 3 questions, no answers
  model: string;
  createdAt: string;
}

export interface Settings {
  key?: string;                  // Dexie key for singleton row, e.g. 'current'
  geminiApiKey: string;
  model: string;                 // e.g. 'gemini-flash-lite-latest'
  defaultLanguage: string;
  responseLanguage?: string;     // human output language (e.g. English, Hinglish, Nepali+English(Romanized)), default 'English'
  theme: 'light' | 'dark' | 'system';
  temperature: number;           // default 0.4
  dailyRequestCount: number;     // local counter, resets at local midnight
  dailyRequestDate: string;      // YYYY-MM-DD
  lastExportDate?: string | null;
}

export type SortOption =
  | 'dateAdded_desc'
  | 'dateAdded_asc'
  | 'dateSolved_desc'
  | 'dateSolved_asc'
  | 'number_asc'
  | 'number_desc'
  | 'title_asc'
  | 'title_desc'
  | 'difficulty_asc'
  | 'difficulty_desc'
  | 'confidence_asc'
  | 'confidence_desc'
  | 'timeSpent_desc'
  | 'timeSpent_asc';

export interface ProblemFilterParams {
  query?: string;
  difficulty?: Difficulty[];
  status?: Status[];
  topics?: string[];
  patterns?: string[];
  confidence?: (1 | 2 | 3 | 4 | 5 | 'unrated')[];
  starredOnly?: boolean;
  reviewQueueOnly?: boolean;
  unresolvedReviewOnly?: boolean;
  sort?: SortOption;
}

// §5.4 Suggested taxonomy
export const TAXONOMY_TOPICS = [
  'Array',
  'String',
  'Hash Table',
  'Linked List',
  'Stack',
  'Queue',
  'Heap',
  'Tree',
  'Binary Tree',
  'Binary Search Tree',
  'Graph',
  'Trie',
  'Matrix',
  'Math',
  'Bit Manipulation',
  'Dynamic Programming',
  'Greedy',
  'Backtracking',
  'Sorting',
  'Recursion',
  'Union Find',
  'Interval',
  'Design',
] as const;

export const TAXONOMY_PATTERNS = [
  'Two Pointers',
  'Sliding Window',
  'Fast & Slow Pointers',
  'Binary Search',
  'BFS',
  'DFS',
  'Topological Sort',
  'Prefix Sum',
  'Monotonic Stack',
  'Memoization',
  'Tabulation',
  'Divide & Conquer',
  'In-place Reversal',
  "Kadane's",
  'Cyclic Sort',
  'Merge Intervals',
  'Top-K Elements',
] as const;
