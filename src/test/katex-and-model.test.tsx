import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarkdownRenderer, MathText } from '../components/common/MarkdownRenderer';
import { MentorTab } from '../components/problem/MentorTab';
import { ToastProvider } from '../context/ToastContext';
import { clearAllLocalData, problemsRepo, settingsRepo } from '../db';
import type { Problem, MentorMessage } from '../types';

describe('Site-wide KaTeX rendering and Model configuration', () => {
  let sampleProblem: Problem;

  beforeEach(async () => {
    await clearAllLocalData();
    sampleProblem = await problemsRepo.create({
      number: 1,
      title: 'Two Sum',
      url: null,
      statement: 'Given an array $nums$ of size $N$, find indices adding to $target$. Constraint: $1 \\le N \\le 10^4$.',
      difficulty: 'Easy',
      topics: ['Array', 'Hash Table'],
      patterns: ['Hash Map'],
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

  describe('KaTeX rendering', () => {
    it('renders inline math expressions with KaTeX classes', () => {
      const { container } = render(
        <MarkdownRenderer content="The brute-force approach leads to an $O(n^2)$ time complexity." />
      );

      const katexEl = container.querySelector('.katex');
      expect(katexEl).toBeInTheDocument();
      expect(container.querySelector('annotation')?.textContent).toBe('O(n^2)');
    });

    it('renders mathcal notation and text operators', () => {
      const { container } = render(
        <MarkdownRenderer content={'Complexity is $\\mathcal{O}(N)$ and complement is $\\text{target} - x$.'} />
      );

      const katexElements = container.querySelectorAll('.katex');
      expect(katexElements.length).toBe(2);
      expect(container.querySelector('.mathcal')).toBeInTheDocument();
      expect(container.querySelector('.text')).toBeInTheDocument();
    });

    it('renders display/block math with .katex-display', () => {
      const { container } = render(
        <MarkdownRenderer content={'Formula:\n\n$$\n\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}\n$$'} />
      );

      const displayEl = container.querySelector('.katex-display');
      expect(displayEl).toBeInTheDocument();
    });

    it('MathText renders inline math without block paragraph wrapper', () => {
      const { container } = render(
        <div>
          <span>Time: <MathText content="$O(1)$" /></span>
        </div>
      );

      expect(container.querySelector('p')).toBeNull();
      expect(container.querySelector('.katex')).toBeInTheDocument();
    });
  });

  describe('MentorTab model configuration', () => {
    it('displays the configured model when settings is set to custom model (e.g. gemini-3.6-flash)', async () => {
      await settingsRepo.update({ model: 'gemini-3.6-flash' });

      const mentorMessage: MentorMessage = {
        id: 'msg-1',
        problemId: sampleProblem.id,
        level: 2,
        content: 'Use a Hash Map for $O(1)$ lookups.',
        model: 'gemini-3.6-flash',
        createdAt: new Date().toISOString(),
      };

      render(
        <ToastProvider>
          <MentorTab
            problem={{ ...sampleProblem, hintsUsed: 2 }}
            mentorMessages={[mentorMessage]}
            onProblemUpdated={() => {}}
          />
        </ToastProvider>
      );

      expect(await screen.findByText(/Model: gemini-3.6-flash/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Unlocked/i).length).toBeGreaterThan(0);
    });

    it('falls back to settings.model if a legacy hint has hardcoded gemini-1.5-flash', async () => {
      await settingsRepo.update({ model: 'gemini-3.6-flash' });

      const legacyMessage: MentorMessage = {
        id: 'msg-legacy',
        problemId: sampleProblem.id,
        level: 2,
        content: 'Legacy hint content with $O(n^2)$ complexity.',
        model: 'gemini-1.5-flash',
        createdAt: new Date().toISOString(),
      };

      render(
        <ToastProvider>
          <MentorTab
            problem={{ ...sampleProblem, hintsUsed: 2 }}
            mentorMessages={[legacyMessage]}
            onProblemUpdated={() => {}}
          />
        </ToastProvider>
      );

      expect(await screen.findByText(/Model: gemini-3.6-flash/i)).toBeInTheDocument();
    });
  });
});
