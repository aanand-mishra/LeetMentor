import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProblemDetailHeader } from '../components/problem/ProblemDetailHeader';
import { ConfidenceDots } from '../components/common/ConfidenceDots';
import { problemsRepo, attemptsRepo, mentorRepo, clearAllLocalData, db } from '../db';
import { ToastProvider } from '../context/ToastContext';
import { BrowserRouter } from 'react-router-dom';
import type { Problem } from '../types';

describe('FR-7 — Confidence Rating and Status Logic Acceptance Tests', () => {
  let sampleProblem: Problem;

  beforeEach(async () => {
    await clearAllLocalData();
    sampleProblem = await problemsRepo.create({
      number: 1,
      title: 'Two Sum',
      url: 'https://leetcode.com/problems/two-sum/',
      statement: 'Problem text',
      difficulty: 'Easy',
      topics: ['Array'],
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
  });

  it('renders exact confidence labels for 1 to 5 per FR-7.1 table', () => {
    const onChange = vi.fn();
    render(<ConfidenceDots confidence={null} interactive={true} onChange={onChange} />);

    expect(screen.getByLabelText(/1: Lost — I could not redo this/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/2: Shaky — I'd need the hints again/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/3: Okay — I'd struggle but get there/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/4: Solid — I could redo this comfortably/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/5: Fluent — I could teach this/i)).toBeInTheDocument();
  });

  it('auto-transitions Not Started to In Progress on first attempt save and sets dateFirstAttempt (FR-7.2)', async () => {
    expect(sampleProblem.status).toBe('Not Started');
    expect(sampleProblem.dateFirstAttempt).toBeNull();

    await attemptsRepo.create({
      problemId: sampleProblem.id,
      code: 'def solve(): pass',
      language: 'python',
    });

    const updated = await db.problems.get(sampleProblem.id);
    expect(updated?.status).toBe('In Progress');
    expect(updated?.dateFirstAttempt).toBeTruthy();
  });

  it('auto-transitions Not Started to In Progress on first hint unlock and sets dateFirstAttempt (FR-7.2)', async () => {
    expect(sampleProblem.status).toBe('Not Started');

    await mentorRepo.saveMessage({
      problemId: sampleProblem.id,
      level: 1,
      content: 'Nudge hint',
      model: 'gemini-1.5-flash',
    });

    const updated = await db.problems.get(sampleProblem.id);
    expect(updated?.status).toBe('In Progress');
    expect(updated?.hintsUsed).toBe(1);
    expect(updated?.dateFirstAttempt).toBeTruthy();
  });

  it('blocks direct Solved transition if latest attempt has no passing review, triggering manual override modal (FR-7.2)', async () => {
    const user = userEvent.setup();
    const onProblemUpdated = vi.fn();

    // Create an unreviewed or revise attempt
    const attempt = await attemptsRepo.create({
      problemId: sampleProblem.id,
      code: 'def solve(): return False',
      language: 'python',
    });

    await attemptsRepo.attachReview(attempt.id, {
      verdict: 'revise',
      summary: 'Incorrect logic',
      correctness: { status: 'incorrect', failingCases: ['[2, 7], target=9'] },
      complexity: {
        time: 'O(N^2)',
        space: 'O(1)',
        optimalTime: 'O(N)',
        optimalSpace: 'O(N)',
        isOptimal: false,
      },
      issues: [],
      positives: ['Good formatting'],
      nextStep: 'Fix algorithm',
      model: 'gemini-1.5-flash',
      createdAt: new Date().toISOString(),
    });

    render(
      <BrowserRouter>
        <ToastProvider>
          <ProblemDetailHeader
            problem={{ ...sampleProblem, status: 'In Progress' }}
            onProblemUpdated={onProblemUpdated}
          />
        </ToastProvider>
      </BrowserRouter>
    );

    const statusSelect = screen.getByLabelText(/Status:/i);
    await user.selectOptions(statusSelect, 'Solved');

    // Should prompt manual override confirmation modal with exact text per FR-7.2
    await waitFor(() => {
      expect(
        screen.getByText(/No passing review yet\. Mark solved anyway\?/i)
      ).toBeInTheDocument();
    });

    // Confirm manual override
    const markSolvedAnywayBtn = screen.getByRole('button', { name: /Mark Solved Anyway/i });
    await user.click(markSolvedAnywayBtn);

    await waitFor(async () => {
      const stored = await db.problems.get(sampleProblem.id);
      expect(stored?.status).toBe('Solved');
      expect(stored?.dateSolved).toBeTruthy();
      expect(stored?.manuallyMarkedSolved).toBe(true);
    });
  });

  it('allows clean Solved transition and triggers confidence modal when attempt has passing review (FR-7.2, FR-7.3)', async () => {
    const user = userEvent.setup();
    const onProblemUpdated = vi.fn();
    const onOpenConfidenceModal = vi.fn();

    // Create a passing attempt
    const attempt = await attemptsRepo.create({
      problemId: sampleProblem.id,
      code: 'def solve(): return True',
      language: 'python',
    });

    await attemptsRepo.attachReview(attempt.id, {
      verdict: 'pass',
      summary: 'Optimal solution',
      correctness: { status: 'correct', failingCases: [] },
      complexity: {
        time: 'O(N)',
        space: 'O(N)',
        optimalTime: 'O(N)',
        optimalSpace: 'O(N)',
        isOptimal: true,
      },
      issues: [],
      positives: ['Clean and optimal'],
      nextStep: 'Try 3Sum next',
      model: 'gemini-1.5-flash',
      createdAt: new Date().toISOString(),
    });

    render(
      <BrowserRouter>
        <ToastProvider>
          <ProblemDetailHeader
            problem={{ ...sampleProblem, status: 'In Progress', confidence: null }}
            onProblemUpdated={onProblemUpdated}
            onOpenConfidenceModal={onOpenConfidenceModal}
          />
        </ToastProvider>
      </BrowserRouter>
    );

    const statusSelect = screen.getByLabelText(/Status:/i);
    await user.selectOptions(statusSelect, 'Solved');

    await waitFor(async () => {
      const stored = await db.problems.get(sampleProblem.id);
      expect(stored?.status).toBe('Solved');
      expect(stored?.dateSolved).toBeTruthy();
      expect(stored?.manuallyMarkedSolved).toBe(false);
      expect(onOpenConfidenceModal).toHaveBeenCalled();
    });
  });

  it('reverting from Solved clears dateSolved but retains confidence (FR-7.2)', async () => {
    const user = userEvent.setup();
    const onProblemUpdated = vi.fn();

    const solvedProblem = await problemsRepo.create({
      number: 2,
      title: 'Add Two Numbers',
      url: null,
      statement: '',
      difficulty: 'Medium',
      topics: ['Linked List'],
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
      dateFirstAttempt: new Date().toISOString(),
      dateSolved: new Date().toISOString(),
    });

    render(
      <BrowserRouter>
        <ToastProvider>
          <ProblemDetailHeader
            problem={solvedProblem}
            onProblemUpdated={onProblemUpdated}
          />
        </ToastProvider>
      </BrowserRouter>
    );

    const statusSelect = screen.getByLabelText(/Status:/i);
    await user.selectOptions(statusSelect, 'In Progress');

    await waitFor(async () => {
      const stored = await db.problems.get(solvedProblem.id);
      expect(stored?.status).toBe('In Progress');
      expect(stored?.dateSolved).toBeNull();
      expect(stored?.confidence).toBe(4); // Retained
    });
  });
});
