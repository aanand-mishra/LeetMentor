import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProblemDetailPage } from '../pages/ProblemDetailPage';
import { VisualizeTab } from '../components/problem/VisualizeTab';
import { problemsRepo, clearAllLocalData } from '../db';
import { ToastProvider } from '../context/ToastContext';
import {
  buildVisualizationPrompt,
  COMMON_PROGRAMMING_LANGUAGES,
  COMMON_HUMAN_LANGUAGES,
} from '../utils/visualizePrompt';
import type { Problem, Attempt } from '../types';

describe('Visualize Tab & Prompt Generator', () => {
  beforeEach(async () => {
    await clearAllLocalData();
    vi.restoreAllMocks();
  });

  describe('1. buildVisualizationPrompt utility', () => {
    const sampleProblem: Problem = {
      id: 'prob-1',
      number: 15,
      title: '3Sum',
      url: null,
      difficulty: 'Medium',
      status: 'In Progress',
      confidence: 3,
      timeSpentMinutes: null,
      hintsUsed: 0,
      starred: false,
      userTimeComplexity: null,
      userSpaceComplexity: null,
      language: 'python',
      dateFirstAttempt: null,
      dateSolved: null,
      topics: ['Array', 'Two Pointers', 'Sorting'],
      patterns: ['Two Pointers'],
      statement:
        'Given an integer array nums, return all the triplets [nums[i], nums[j], nums[k]] such that i != j, i != k, and j != k, and nums[i] + nums[j] + nums[k] == 0.',
      dateAdded: '2026-09-01',
      updatedAt: '2026-09-01',
      notes: '',
    };

    const sampleAttempt: Attempt = {
      id: 'att-1',
      problemId: 'prob-1',
      attemptNumber: 1,
      code: 'class Solution:\n    def threeSum(self, nums: List[int]) -> List[List[int]]:\n        pass',
      language: 'python',
      userComment: 'sort then two pointers',
      timeSpentMinutes: 20,
      status: 'accepted',
      createdAt: '2026-09-01T10:00:00Z',
      review: null,
    } as Attempt;

    it('builds a comprehensive prompt with all problem specifications', () => {
      const prompt = buildVisualizationPrompt({
        problem: sampleProblem,
        latestAttempt: sampleAttempt,
        programmingLanguage: 'Python',
        humanLanguage: 'English',
        includeCode: true,
      });

      expect(prompt).toContain('Problem: 15. 3Sum');
      expect(prompt).toContain('Difficulty: Medium');
      expect(prompt).toContain('Topics / Data Structures: Array, Two Pointers, Sorting');
      expect(prompt).toContain('Core Pattern: Two Pointers');
      expect(prompt).toContain('Programming Language for Code Trace: Python');
      expect(prompt).toContain('Primary Human Language for Explanations & Mentorship: English');
      expect(prompt).toContain('Given an integer array nums');
      expect(prompt).toContain("STUDENT'S RECENT CODE ATTEMPT");
      expect(prompt).toContain('def threeSum');
      expect(prompt).toContain('Self-Contained Single File');
      expect(prompt).toContain('Step-by-Step Guided Mode');
      expect(prompt).toContain('Invariant Zones');
    });

    it('handles missing statement and omits code when includeCode is false', () => {
      const noStatementProblem: Problem = {
        ...sampleProblem,
        statement: '',
      };

      const prompt = buildVisualizationPrompt({
        problem: noStatementProblem,
        latestAttempt: sampleAttempt,
        programmingLanguage: 'Java',
        humanLanguage: 'Hinglish',
        includeCode: false,
      });

      expect(prompt).toContain('Programming Language for Code Trace: Java');
      expect(prompt).toContain('Primary Human Language for Explanations & Mentorship: Hinglish');
      expect(prompt).toContain('Problem statement not provided in tracker');
      expect(prompt).not.toContain("STUDENT'S RECENT CODE ATTEMPT");
      expect(prompt).not.toContain('def threeSum');
    });

    it('exports standard common programming and human languages lists', () => {
      expect(COMMON_PROGRAMMING_LANGUAGES).toContain('Python');
      expect(COMMON_PROGRAMMING_LANGUAGES).toContain('JavaScript');
      expect(COMMON_PROGRAMMING_LANGUAGES).toContain('Java');
      expect(COMMON_PROGRAMMING_LANGUAGES).toContain('C++');

      expect(COMMON_HUMAN_LANGUAGES).toContain('English');
      expect(COMMON_HUMAN_LANGUAGES).toContain('Hinglish');
      expect(COMMON_HUMAN_LANGUAGES).toContain('Nepali');
    });
  });

  describe('2. VisualizeTab UI Component', () => {
    const mockProblem: Problem = {
      id: 'prob-two-sum',
      number: 1,
      title: 'Two Sum',
      url: null,
      difficulty: 'Easy',
      status: 'Solved',
      confidence: 4,
      timeSpentMinutes: 10,
      hintsUsed: 0,
      starred: false,
      userTimeComplexity: null,
      userSpaceComplexity: null,
      language: 'python',
      dateFirstAttempt: null,
      dateSolved: '2026-09-01',
      topics: ['Array', 'Hash Table'],
      patterns: ['Hash Map Lookup'],
      statement:
        'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
      dateAdded: '2026-09-01',
      updatedAt: '2026-09-01',
      notes: '',
    };

    const mockAttempt: Attempt = {
      id: 'att-ts',
      problemId: 'prob-two-sum',
      attemptNumber: 1,
      code: 'def twoSum(nums, target):\n    lookup = {}\n    for i, n in enumerate(nums):\n        if target - n in lookup:\n            return [lookup[target - n], i]\n        lookup[n] = i',
      language: 'python',
      userComment: 'hash map for complement',
      createdAt: '2026-09-01T12:00:00Z',
      review: null,
    };

    it('renders the VisualizeTab with selectors, preview, and LLM shortcuts', async () => {
      render(
        <ToastProvider>
          <MemoryRouter>
            <VisualizeTab problem={mockProblem} latestAttempt={mockAttempt} />
          </MemoryRouter>
        </ToastProvider>
      );

      expect(screen.getByTestId('vis-prog-lang-select')).toBeInTheDocument();
      expect(screen.getByTestId('vis-human-lang-select')).toBeInTheDocument();
      expect(screen.getByTestId('prompt-preview')).toBeInTheDocument();

      // Check external AI buttons
      expect(screen.getByText('ChatGPT')).toBeInTheDocument();
      expect(screen.getByText('Claude')).toBeInTheDocument();
      expect(screen.getByText('Gemini')).toBeInTheDocument();
      expect(screen.getByText('DeepSeek')).toBeInTheDocument();
    });

    it('updates prompt dynamically when programming language or human language changes', async () => {
      const user = userEvent.setup();

      render(
        <ToastProvider>
          <MemoryRouter>
            <VisualizeTab problem={mockProblem} latestAttempt={mockAttempt} />
          </MemoryRouter>
        </ToastProvider>
      );

      const preview = screen.getByTestId('prompt-preview');
      expect(preview.textContent).toContain('Programming Language for Code Trace: Python');
      expect(preview.textContent).toContain(
        'Primary Human Language for Explanations & Mentorship: English'
      );

      // Change programming language to Java
      const progSelect = screen.getByTestId('vis-prog-lang-select');
      await user.selectOptions(progSelect, 'Java');

      expect(preview.textContent).toContain('Programming Language for Code Trace: Java');

      // Change human language to Nepali
      const humanSelect = screen.getByTestId('vis-human-lang-select');
      await user.selectOptions(humanSelect, 'Nepali');

      expect(preview.textContent).toContain(
        'Primary Human Language for Explanations & Mentorship: Nepali'
      );
    });

    it('toggles student code attempt inclusion in the prompt', async () => {
      const user = userEvent.setup();

      render(
        <ToastProvider>
          <MemoryRouter>
            <VisualizeTab problem={mockProblem} latestAttempt={mockAttempt} />
          </MemoryRouter>
        </ToastProvider>
      );

      const preview = screen.getByTestId('prompt-preview');
      expect(preview.textContent).toContain("STUDENT'S RECENT CODE ATTEMPT");
      expect(preview.textContent).toContain('def twoSum');

      const checkbox = screen.getByRole('checkbox', { name: /include recent code attempt/i });
      expect(checkbox).toBeChecked();

      // Uncheck
      await user.click(checkbox);
      expect(checkbox).not.toBeChecked();
      expect(preview.textContent).not.toContain("STUDENT'S RECENT CODE ATTEMPT");
    });

    it('copies prompt to clipboard when copy button is clicked', async () => {
      const user = userEvent.setup();
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: writeTextMock,
        },
        configurable: true,
        writable: true,
      });

      render(
        <ToastProvider>
          <MemoryRouter>
            <VisualizeTab problem={mockProblem} latestAttempt={mockAttempt} />
          </MemoryRouter>
        </ToastProvider>
      );

      const copyBtn = screen.getByRole('button', { name: /copy prompt/i });
      await user.click(copyBtn);

      expect(writeTextMock).toHaveBeenCalledTimes(1);
      expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('1. Two Sum'));
      expect(await screen.findByTitle('Copy prompt')).toBeInTheDocument();
    });

    it('shows statement missing warning when problem has no statement', async () => {
      const problemWithoutStatement: Problem = {
        ...mockProblem,
        statement: '',
      };

      render(
        <ToastProvider>
          <MemoryRouter>
            <VisualizeTab problem={problemWithoutStatement} />
          </MemoryRouter>
        </ToastProvider>
      );

      expect(
        screen.getByText('Mentor accuracy is limited without the problem statement.')
      ).toBeInTheDocument();
    });
  });

  describe('3. Integration with ProblemDetailPage', () => {
    it('navigates to Visualize tab and renders the prompt generator', async () => {
      const created = await problemsRepo.create({
        number: 42,
        title: 'Trapping Rain Water',
        url: null,
        difficulty: 'Hard',
        topics: ['Array', 'Two Pointers'],
        patterns: ['Two Pointers'],
        statement:
          'Given n non-negative integers representing an elevation map where the width of each bar is 1, compute how much water it can trap after raining.',
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
        <ToastProvider>
          <MemoryRouter initialEntries={[`/problem/${created.id}#visualize`]}>
            <Routes>
              <Route path="/problem/:id" element={<ProblemDetailPage />} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Trapping Rain Water')).toBeInTheDocument();
      });

      expect(screen.getByTestId('prompt-preview').textContent).toContain('42. Trapping Rain Water');
    });
  });
});
