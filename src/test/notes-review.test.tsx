import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotesTab } from '../components/problem/NotesTab';
import { problemsRepo, noteReviewsRepo, clearAllLocalData, db } from '../db';
import { ToastProvider } from '../context/ToastContext';
import type { Problem } from '../types';

describe('FR-6 — Notes and Notes Review Acceptance Criteria', () => {
  let sampleProblem: Problem;

  beforeEach(async () => {
    await clearAllLocalData();
    sampleProblem = await problemsRepo.create({
      number: 1,
      title: 'Two Sum',
      url: null,
      statement: 'Given an array of integers...',
      difficulty: 'Easy',
      topics: ['Array', 'Hash Table'],
      patterns: ['Hash Map'],
      status: 'In Progress',
      confidence: null,
      timeSpentMinutes: null,
      hintsUsed: 1,
      starred: false,
      userTimeComplexity: null,
      userSpaceComplexity: null,
      notes: '',
      language: 'python',
      dateFirstAttempt: new Date().toISOString(),
      dateSolved: null,
    });
  });

  it('scaffold guidance is rendered strictly as placeholder text, never pre-filled content (FR-6.2)', () => {
    render(
      <ToastProvider>
        <NotesTab
          problem={sampleProblem}
          noteReviews={[]}
          onProblemUpdated={vi.fn()}
        />
      </ToastProvider>
    );

    const textarea = screen.getByPlaceholderText(/What was the key insight\?/i) as HTMLTextAreaElement;
    expect(textarea).toBeInTheDocument();
    expect(textarea.value).toBe('');
    expect(textarea.placeholder).toContain('What pattern does this belong to, and what else does that pattern solve?');
    expect(textarea.placeholder).toContain('Why is this complexity optimal?');
    expect(textarea.placeholder).toContain('What did I get wrong first, and why?');
  });

  it('review button is disabled under 50 characters with tooltip indicator (FR-6 Acceptance)', async () => {
    const user = userEvent.setup();

    render(
      <ToastProvider>
        <NotesTab
          problem={sampleProblem}
          noteReviews={[]}
          onProblemUpdated={vi.fn()}
        />
      </ToastProvider>
    );

    const reviewBtn = screen.getByRole('button', { name: /Review my notes/i });
    expect(reviewBtn).toBeDisabled();

    const textarea = screen.getByPlaceholderText(/What was the key insight\?/i);
    // Type 20 chars
    await user.type(textarea, 'Short initial notes.');
    expect(screen.getByText(/20\/50 chars min/i)).toBeInTheDocument();
    expect(reviewBtn).toBeDisabled();
  });

  it('notes persist to IndexedDB automatically without an explicit save click (FR-6 Acceptance)', async () => {
    const user = userEvent.setup();
    const onProblemUpdated = vi.fn();

    render(
      <ToastProvider>
        <NotesTab
          problem={sampleProblem}
          noteReviews={[]}
          onProblemUpdated={onProblemUpdated}
        />
      </ToastProvider>
    );

    const textarea = screen.getByPlaceholderText(/What was the key insight\?/i);
    await user.type(textarea, 'Key insight: Using a hash map achieves O(N) time by trading O(N) auxiliary space.');

    // Wait for 1s debounce to complete and save to IndexedDB
    await waitFor(
      async () => {
        const stored = await db.problems.get(sampleProblem.id);
        expect(stored?.notes).toContain('Key insight: Using a hash map achieves O(N) time');
      },
      { timeout: 2500 }
    );

    expect(screen.getByText(/Saved/i)).toBeInTheDocument();
  });

  it('reviewing twice produces two retained history entries, not a replacement (FR-6 Acceptance)', async () => {
    const user = userEvent.setup();
    const onProblemUpdated = vi.fn();

    const detailedNotes =
      'Key insight: Use a hash map to look up the complement in O(1) time instead of scanning backwards in O(N). Avoids quadratic nested scans.';

    const { rerender } = render(
      <ToastProvider>
        <NotesTab
          problem={{ ...sampleProblem, notes: detailedNotes }}
          noteReviews={[]}
          onProblemUpdated={onProblemUpdated}
        />
      </ToastProvider>
    );

    const reviewBtn = screen.getByRole('button', { name: /Review my notes/i });
    expect(reviewBtn).not.toBeDisabled();

    // First review
    await user.click(reviewBtn);

    await waitFor(() => {
      expect(onProblemUpdated).toHaveBeenCalledTimes(1);
    });

    const reviewsAfterFirst = await noteReviewsRepo.listForProblem(sampleProblem.id);
    expect(reviewsAfterFirst.length).toBe(1);
    expect(reviewsAfterFirst[0].verdict).toBe('solid');

    // Rerender with the 1 review
    rerender(
      <ToastProvider>
        <NotesTab
          problem={{ ...sampleProblem, notes: detailedNotes }}
          noteReviews={reviewsAfterFirst}
          onProblemUpdated={onProblemUpdated}
        />
      </ToastProvider>
    );

    // Second review
    await user.click(screen.getByRole('button', { name: /Review my notes/i }));

    await waitFor(() => {
      expect(onProblemUpdated).toHaveBeenCalledTimes(2);
    });

    // Check IndexedDB: must have 2 retained reviews (not replaced)
    const reviewsAfterSecond = await noteReviewsRepo.listForProblem(sampleProblem.id);
    expect(reviewsAfterSecond.length).toBe(2);
    expect(reviewsAfterSecond[0].id).not.toBe(reviewsAfterSecond[1].id);
  });
});
