import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { HomePage } from '../pages/HomePage';
import { problemsRepo, clearAllLocalData } from '../db';
import { ToastProvider } from '../context/ToastContext';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

describe('FR-2 — Home Page Acceptance Criteria', () => {
  beforeEach(async () => {
    await clearAllLocalData();
  });

  it('multi-token search returns correct AND intersection across fields (FR-2 Acceptance)', async () => {
    // Problem A matches 'dp' (topics) and 'array' (topics)
    await problemsRepo.create({
      number: 10,
      title: 'Regular Expression Matching',
      url: null,
      statement: '',
      difficulty: 'Hard',
      topics: ['String', 'Dynamic Programming'],
      patterns: ['Tabulation'],
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

    // Problem B matches 'dp' but NOT 'array'
    await problemsRepo.create({
      number: 70,
      title: 'Climbing Stairs',
      url: null,
      statement: '',
      difficulty: 'Easy',
      topics: ['Math', 'Dynamic Programming'],
      patterns: ['Memoization'],
      status: 'Solved',
      confidence: 4,
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

    // Problem C matches 'array' but NOT 'dp'
    await problemsRepo.create({
      number: 1,
      title: 'Two Sum',
      url: null,
      statement: '',
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

    // Problem D matches both 'dp' and 'array'
    await problemsRepo.create({
      number: 53,
      title: 'Maximum Subarray',
      url: null,
      statement: '',
      difficulty: 'Medium',
      topics: ['Array', 'Dynamic Programming'],
      patterns: ["Kadane's"],
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

    // Query with 'dp array'
    const results = await problemsRepo.list({ query: 'dp array' });
    expect(results.length).toBe(1);
    expect(results[0].title).toBe('Maximum Subarray');
  });

  it('combined filters (Difficulty + Status) return correct intersection (FR-2 Acceptance)', async () => {
    // Easy + Solved
    await problemsRepo.create({
      number: 1,
      title: 'Two Sum',
      url: null,
      statement: '',
      difficulty: 'Easy',
      topics: ['Array'],
      patterns: [],
      status: 'Solved',
      confidence: 4,
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

    // Medium + Solved
    await problemsRepo.create({
      number: 3,
      title: 'Longest Substring',
      url: null,
      statement: '',
      difficulty: 'Medium',
      topics: ['String'],
      patterns: [],
      status: 'Solved',
      confidence: 4,
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

    // Medium + In Progress
    await problemsRepo.create({
      number: 15,
      title: '3Sum',
      url: null,
      statement: '',
      difficulty: 'Medium',
      topics: ['Array'],
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

    const results = await problemsRepo.list({
      difficulty: ['Medium'],
      status: ['Solved'],
    });

    expect(results.length).toBe(1);
    expect(results[0].title).toBe('Longest Substring');
  });

  it('reproduces identical view from URL search params (FR-2 Acceptance)', async () => {
    await problemsRepo.create({
      number: 11,
      title: 'Container With Most Water',
      url: null,
      statement: '',
      difficulty: 'Medium',
      topics: ['Array'],
      patterns: ['Two Pointers'],
      status: 'Solved',
      confidence: 3,
      timeSpentMinutes: null,
      hintsUsed: 0,
      starred: false,
      userTimeComplexity: null,
      userSpaceComplexity: null,
      notes: '',
      language: 'python',
      dateFirstAttempt: null,
      dateSolved: new Date().toISOString(),
    });

    render(
      <MemoryRouter initialEntries={['/?difficulty=Medium&status=Solved']}>
        <ToastProvider>
          <Routes>
            <Route path="/" element={<HomePage />} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Container With Most Water')[0]).toBeInTheDocument();
    });
  });

  it('focuses search input when / key is pressed (FR-2 Acceptance, NFR-9)', async () => {
    await problemsRepo.create({
      number: 1,
      title: 'Two Sum',
      url: null,
      statement: '',
      difficulty: 'Easy',
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

    const TestHomeWithShortcuts = () => {
      useKeyboardShortcuts();
      return <HomePage />;
    };

    render(
      <MemoryRouter initialEntries={['/']}>
        <ToastProvider>
          <Routes>
            <Route path="/" element={<TestHomeWithShortcuts />} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Two Sum')[0]).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search by title/i);
    expect(searchInput).not.toHaveFocus();

    // Trigger '/' key
    const user = userEvent.setup();
    await user.keyboard('/');

    expect(searchInput).toHaveFocus();
  });

  it('search stays responsive with 2,000 problems (under 100ms) (FR-2 & NFR-1 Acceptance)', async () => {
    // Generate 2,000 mock items directly for fast memory benchmark
    const mockProblems = [];
    for (let i = 1; i <= 2000; i++) {
      mockProblems.push({
        id: `prob-${i}`,
        number: i,
        title: `Problem Number ${i} Algorithm`,
        url: null,
        statement: '',
        difficulty: (i % 3 === 0 ? 'Hard' : i % 2 === 0 ? 'Medium' : 'Easy') as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        topics: ['Array', 'Dynamic Programming'],
        patterns: ['Two Pointers'],
        status: (i % 3 === 0 ? 'Solved' : 'In Progress') as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        confidence: 3 as const,
        timeSpentMinutes: 20,
        hintsUsed: 1 as const,
        starred: false,
        userTimeComplexity: null,
        userSpaceComplexity: null,
        notes: '',
        language: 'python',
        dateAdded: new Date().toISOString(),
        dateFirstAttempt: null,
        dateSolved: null,
        updatedAt: new Date().toISOString(),
      });
    }

    await problemsRepo.delete('dummy').catch(() => {});
    await (problemsRepo as any).getAll; // eslint-disable-line @typescript-eslint/no-explicit-any
    await problemsRepo['delete']?.('dummy').catch(() => {});
    // Bulk insert into Dexie table
    const { db } = await import('../db');
    await db.problems.bulkAdd(mockProblems);

    const start = performance.now();
    const filtered = await problemsRepo.list({ query: '1999' });
    const duration = performance.now() - start;

    expect(filtered.length).toBe(1);
    expect(filtered[0].title).toBe('Problem Number 1999 Algorithm');
    // Spec requires interaction under 100ms
    expect(duration).toBeLessThan(100);
  });
});
