import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AttemptsTab } from '../components/problem/AttemptsTab';
import { problemsRepo, attemptsRepo, clearAllLocalData, db } from '../db';
import { ToastProvider } from '../context/ToastContext';
import type { Problem, CodeReview } from '../types';

describe('FR-4 — Attempts and Code Review Loop Acceptance Criteria', () => {
  let sampleProblem: Problem;

  beforeEach(async () => {
    await clearAllLocalData();
    sampleProblem = await problemsRepo.create({
      number: 1,
      title: 'Two Sum',
      url: null,
      statement: 'Two sum description',
      difficulty: 'Easy',
      topics: ['Array'],
      patterns: ['Two Pointers'],
      status: 'In Progress',
      confidence: null,
      timeSpentMinutes: null,
      hintsUsed: 0,
      starred: false,
      userTimeComplexity: null,
      userSpaceComplexity: null,
      notes: '',
      language: 'python',
      dateFirstAttempt: new Date().toISOString(),
      dateSolved: null,
    });
  });

  it('submitting a second attempt never mutates the first attempt record (FR-4 Acceptance)', async () => {
    const attempt1 = await attemptsRepo.create({
      problemId: sampleProblem.id,
      code: 'def solve(): return 1',
      language: 'python',
      userComment: 'First try',
    });

    const attempt2 = await attemptsRepo.create({
      problemId: sampleProblem.id,
      code: 'def solve(): return 2',
      language: 'python',
      userComment: 'Second try',
    });

    expect(attempt1.attemptNumber).toBe(1);
    expect(attempt2.attemptNumber).toBe(2);

    // Verify record in db for attempt1
    const stored1 = await db.attempts.get(attempt1.id);
    const stored2 = await db.attempts.get(attempt2.id);

    expect(stored1?.code).toBe('def solve(): return 1');
    expect(stored2?.code).toBe('def solve(): return 2');
    expect(stored1?.attemptNumber).toBe(1);
    expect(stored2?.attemptNumber).toBe(2);
  });

  it('a revise verdict renders every returned issue, sorted critical -> major -> minor (FR-4 Acceptance)', async () => {
    const mockReview: CodeReview = {
      verdict: 'revise',
      summary: 'Needs work on time complexity and edge cases.',
      correctness: { status: 'fails_edge_cases', failingCases: ['Empty array'] },
      complexity: {
        time: 'O(n^2)',
        space: 'O(1)',
        optimalTime: 'O(n)',
        optimalSpace: 'O(n)',
        isOptimal: false,
      },
      issues: [
        {
          severity: 'minor',
          title: 'Minor Issue Title',
          detail: 'Clean up names',
          suggestion: 'Rename var',
        },
        {
          severity: 'critical',
          title: 'Critical Issue Title',
          detail: 'Crash on null',
          suggestion: 'Add null check',
        },
        {
          severity: 'major',
          title: 'Major Issue Title',
          detail: 'Slow loop',
          suggestion: 'Use hash set',
        },
      ],
      positives: ['Good formatting'],
      nextStep: 'Fix critical null check first.',
      model: 'gemini-flash-lite-latest',
      createdAt: new Date().toISOString(),
    };

    const attempt = await attemptsRepo.create({
      problemId: sampleProblem.id,
      code: 'def bad(): pass',
      language: 'python',
      review: mockReview,
    });

    render(
      <ToastProvider>
        <AttemptsTab problem={sampleProblem} attempts={[attempt]} onProblemUpdated={() => {}} />
      </ToastProvider>
    );

    // Verify all 3 issues are rendered
    expect(screen.getByText('Critical Issue Title')).toBeInTheDocument();
    expect(screen.getByText('Major Issue Title')).toBeInTheDocument();
    expect(screen.getByText('Minor Issue Title')).toBeInTheDocument();

    // Verify ordering: Critical appears before Major, which appears before Minor
    const criticalEl = screen.getByText('Critical Issue Title');
    const majorEl = screen.getByText('Major Issue Title');
    const minorEl = screen.getByText('Minor Issue Title');

    expect(criticalEl.compareDocumentPosition(majorEl)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(majorEl.compareDocumentPosition(minorEl)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('clicking Fix and resubmit pre-fills the textarea with previous attempt exact code (FR-4 Acceptance)', async () => {
    const mockReview: CodeReview = {
      verdict: 'revise',
      summary: 'Revise code',
      correctness: { status: 'incorrect', failingCases: [] },
      complexity: {
        time: 'O(n^2)',
        space: 'O(1)',
        optimalTime: 'O(n)',
        optimalSpace: 'O(n)',
        isOptimal: false,
      },
      issues: [{ severity: 'major', title: 'Slow', detail: 'Slow loop', suggestion: 'Use map' }],
      positives: ['Nice start'],
      nextStep: 'Fix loop',
      model: 'gemini-flash-lite-latest',
      createdAt: new Date().toISOString(),
    };

    const attempt = await attemptsRepo.create({
      problemId: sampleProblem.id,
      code: 'def original_attempt_code():\n    return 42',
      language: 'python',
      review: mockReview,
    });

    render(
      <ToastProvider>
        <AttemptsTab problem={sampleProblem} attempts={[attempt]} onProblemUpdated={() => {}} />
      </ToastProvider>
    );

    const user = userEvent.setup();

    // Click "Fix and resubmit"
    const fixBtns = screen.getAllByRole('button', { name: /Fix and resubmit/i });
    await user.click(fixBtns[0]);

    // Check textarea
    const textarea = screen.getByPlaceholderText(/Paste your solution code here/i);
    await waitFor(() => {
      expect((textarea as HTMLTextAreaElement).value).toBe(
        'def original_attempt_code():\n    return 42'
      );
    });
  });

  it('reviews persist correctly across reload (FR-4 Acceptance)', async () => {
    const mockReview: CodeReview = {
      verdict: 'pass',
      summary: 'Optimal solution!',
      correctness: { status: 'correct', failingCases: [] },
      complexity: {
        time: 'O(n)',
        space: 'O(n)',
        optimalTime: 'O(n)',
        optimalSpace: 'O(n)',
        isOptimal: true,
      },
      issues: [],
      positives: ['Clean'],
      nextStep: 'Try another problem',
      model: 'gemini-flash-lite-latest',
      createdAt: new Date().toISOString(),
    };

    const attempt = await attemptsRepo.create({
      problemId: sampleProblem.id,
      code: 'def optimal(): pass',
      language: 'python',
    });

    await attemptsRepo.attachReview(attempt.id, mockReview);

    // Retrieve fresh from database (simulating reload)
    const freshAttempts = await attemptsRepo.listForProblem(sampleProblem.id);
    expect(freshAttempts[0].review).not.toBeNull();
    expect(freshAttempts[0].review?.verdict).toBe('pass');
    expect(freshAttempts[0].review?.summary).toBe('Optimal solution!');
  });
});
