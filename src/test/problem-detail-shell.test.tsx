import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProblemDetailPage } from '../pages/ProblemDetailPage';
import { problemsRepo, clearAllLocalData } from '../db';
import { ToastProvider } from '../context/ToastContext';

describe('Phase 5 — Problem Detail Page Shell & Hash Routing', () => {
  beforeEach(async () => {
    await clearAllLocalData();
  });

  it('renders sticky header with problem title, number, external link, and difficulty', async () => {
    const problem = await problemsRepo.create({
      number: 1,
      title: 'Two Sum',
      url: 'https://leetcode.com/problems/two-sum/',
      statement: 'Given an array of integers nums...',
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

    render(
      <MemoryRouter initialEntries={[`/problem/${problem.id}`]}>
        <ToastProvider>
          <Routes>
            <Route path="/problem/:id" element={<ProblemDetailPage />} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Two Sum')).toBeInTheDocument();
      expect(screen.getByText('#1')).toBeInTheDocument();
      expect(screen.getByText('Easy')).toBeInTheDocument();
    });

    // Check external link
    const leetcodeLink = screen.getByTitle('Open on Leetcode (opens in new tab)');
    expect(leetcodeLink).toHaveAttribute('href', 'https://leetcode.com/problems/two-sum/');
    expect(leetcodeLink).toHaveAttribute('target', '_blank');
    expect(leetcodeLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('respects URL hash routing to activate the requested tab (FR-3.1)', async () => {
    const problem = await problemsRepo.create({
      number: 42,
      title: 'Trapping Rain Water',
      url: null,
      statement: 'Calculate water trapped...',
      difficulty: 'Hard',
      topics: ['Array'],
      patterns: [],
      status: 'In Progress',
      confidence: null,
      timeSpentMinutes: 30,
      hintsUsed: 2,
      starred: true,
      userTimeComplexity: null,
      userSpaceComplexity: null,
      notes: '',
      language: 'python',
      dateFirstAttempt: null,
      dateSolved: null,
    });

    // Mount with #mentor hash
    render(
      <MemoryRouter initialEntries={[`/problem/${problem.id}#mentor`]}>
        <ToastProvider>
          <Routes>
            <Route path="/problem/:id" element={<ProblemDetailPage />} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/AI Mentor — 4 Gated Progressive Hints/i)).toBeInTheDocument();
    });
  });

  it('displays inline warning on Mentor tab when statement is missing per §5.3', async () => {
    const problem = await problemsRepo.create({
      number: 3,
      title: 'Longest Substring',
      url: null,
      statement: '', // Missing statement
      difficulty: 'Medium',
      topics: ['String'],
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
      <MemoryRouter initialEntries={[`/problem/${problem.id}#mentor`]}>
        <ToastProvider>
          <Routes>
            <Route path="/problem/:id" element={<ProblemDetailPage />} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Mentor accuracy is limited without the problem statement/i)
      ).toBeInTheDocument();
    });
  });

  it('switches tabs on tab button click', async () => {
    const problem = await problemsRepo.create({
      number: 20,
      title: 'Valid Parentheses',
      url: null,
      statement: 'Check parentheses balance',
      difficulty: 'Easy',
      topics: ['Stack'],
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
      <MemoryRouter initialEntries={[`/problem/${problem.id}`]}>
        <ToastProvider>
          <Routes>
            <Route path="/problem/:id" element={<ProblemDetailPage />} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Problem Statement')).toBeInTheDocument();
    });

    // Click Attempts tab
    const user = userEvent.setup();
    const attemptsTabBtn = screen.getByRole('button', { name: /Attempts/i });
    await user.click(attemptsTabBtn);

    await waitFor(() => {
      expect(screen.getByText(/Submit Attempt/i)).toBeInTheDocument();
    });
  });

  it('allows editing Time Spent directly in Session Information on the Overview tab', async () => {
    const user = userEvent.setup();
    const problem = await problemsRepo.create({
      number: 75,
      title: 'Sort Colors',
      url: null,
      statement: 'Sort 0s, 1s, and 2s in-place',
      difficulty: 'Medium',
      topics: ['Array', 'Two Pointers'],
      patterns: ['Dutch National Flag'],
      status: 'Solved',
      confidence: 4,
      timeSpentMinutes: null,
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
      <MemoryRouter initialEntries={[`/problem/${problem.id}#overview`]}>
        <ToastProvider>
          <Routes>
            <Route path="/problem/:id" element={<ProblemDetailPage />} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    );

    // Initial state shows — for Time Spent
    await waitFor(() => {
      expect(screen.getByText('Session Information')).toBeInTheDocument();
    });

    // Click edit button
    const editTimeBtn = screen.getByRole('button', { name: /Edit time spent/i });
    await user.click(editTimeBtn);

    // Input field appears
    const input = screen.getByLabelText(/Edit time spent in minutes/i);
    expect(input).toBeInTheDocument();

    // Type 45 and click save
    await user.type(input, '45');
    const saveBtn = screen.getByRole('button', { name: /Save time spent/i });
    await user.click(saveBtn);

    // Displays 45 mins and persists to IndexedDB
    await waitFor(async () => {
      expect(screen.getByText('45 mins')).toBeInTheDocument();
      const stored = await problemsRepo.getById(problem.id);
      expect(stored?.timeSpentMinutes).toBe(45);
    });
  });
});
