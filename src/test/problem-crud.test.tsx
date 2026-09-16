import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { ProblemForm } from '../components/problem/ProblemForm';
import { problemsRepo, attemptsRepo, clearAllLocalData, db } from '../db';
import { ToastProvider } from '../context/ToastContext';

describe('FR-1 — Problem CRUD Acceptance Criteria', () => {
  beforeEach(async () => {
    await clearAllLocalData();
  });

  it('creating a problem with only title and difficulty succeeds (FR-1 Acceptance)', async () => {
    let savedData: unknown = null;
    const handleSubmit = async (data: unknown) => {
      savedData = data;
    };

    render(
      <BrowserRouter>
        <ToastProvider>
          <ProblemForm onSubmit={handleSubmit} />
        </ToastProvider>
      </BrowserRouter>
    );

    const user = userEvent.setup();

    // Fill only title
    const titleInput = screen.getByLabelText(/Title/);
    await user.type(titleInput, 'Invert Binary Tree');

    // Submit form
    const submitBtn = screen.getByTestId('submit-problem-btn');
    await user.click(submitBtn);

    await waitFor(() => {
      expect(savedData).not.toBeNull();
    });

    // Verify DB write
    const problem = await problemsRepo.create(savedData as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(problem.id).toBeDefined();
    expect(problem.title).toBe('Invert Binary Tree');
    expect(problem.difficulty).toBe('Medium');
  });

  it('submitting with an empty title shows an inline error and does not write to the database (FR-1 Acceptance)', async () => {
    let submitted = false;
    const handleSubmit = async () => {
      submitted = true;
    };

    render(
      <BrowserRouter>
        <ToastProvider>
          <ProblemForm onSubmit={handleSubmit} />
        </ToastProvider>
      </BrowserRouter>
    );

    const user = userEvent.setup();
    const submitBtn = screen.getByTestId('submit-problem-btn');
    await user.click(submitBtn);

    // Expect inline error
    await waitFor(() => {
      expect(screen.getByText(/Title is required/i)).toBeInTheDocument();
    });

    expect(submitted).toBe(false);
    const allProblems = await problemsRepo.getAll();
    expect(allProblems.length).toBe(0);
  });

  it('entering a duplicate problem number shows a non-blocking warning naming the existing problem, with a link to it (FR-1 Acceptance)', async () => {
    // Seed existing problem #1
    const existing = await problemsRepo.create({
      number: 1,
      title: 'Two Sum',
      url: null,
      statement: '',
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

    render(
      <BrowserRouter>
        <ToastProvider>
          <ProblemForm onSubmit={async () => {}} />
        </ToastProvider>
      </BrowserRouter>
    );

    const user = userEvent.setup();
    const numberInput = screen.getByLabelText(/Leetcode Number/i);
    await user.type(numberInput, '1');

    await waitFor(() => {
      expect(screen.getByText(/Problem #1 already exists/i)).toBeInTheDocument();
      expect(screen.getByText('Two Sum')).toBeInTheDocument();
    });

    // Confirm link points to existing problem
    const link = screen.getByRole('link', { name: 'Two Sum' });
    expect(link).toHaveAttribute('href', `/problem/${existing.id}`);
  });

  it('deleting a problem with 3 attempts removes all 3 attempt rows from IndexedDB (FR-1 Acceptance)', async () => {
    const problem = await problemsRepo.create({
      number: 15,
      title: '3Sum',
      url: null,
      statement: '',
      difficulty: 'Medium',
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

    await attemptsRepo.create({ problemId: problem.id, code: 'attempt 1', language: 'python' });
    await attemptsRepo.create({ problemId: problem.id, code: 'attempt 2', language: 'python' });
    await attemptsRepo.create({ problemId: problem.id, code: 'attempt 3', language: 'python' });

    expect(await db.attempts.where('problemId').equals(problem.id).count()).toBe(3);

    // Delete problem
    await problemsRepo.delete(problem.id);

    // Verify cascading deletion
    expect(await problemsRepo.getById(problem.id)).toBeUndefined();
    expect(await db.attempts.where('problemId').equals(problem.id).count()).toBe(0);
  });

  it('hides time spent field when status is not Solved, and reveals it when status is Solved', async () => {
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <ToastProvider>
          <ProblemForm onSubmit={async () => {}} />
        </ToastProvider>
      </BrowserRouter>
    );

    // Default status is 'Not Started', so Time Spent input should NOT be present
    expect(screen.queryByPlaceholderText(/e\.g\. 25/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Time Spent \(minutes\)/i)).not.toBeInTheDocument();

    // Change status to 'Solved'
    const statusSelect = screen.getByLabelText(/^Status/i);
    await user.selectOptions(statusSelect, 'Solved');

    // Time Spent input should now be visible
    expect(screen.getByPlaceholderText(/e\.g\. 25/i)).toBeInTheDocument();
    expect(screen.getByText(/Time Spent \(minutes\)/i)).toBeInTheDocument();

    // Change status back to 'In Progress'
    await user.selectOptions(statusSelect, 'In Progress');
    expect(screen.queryByPlaceholderText(/e\.g\. 25/i)).not.toBeInTheDocument();
  });
});
