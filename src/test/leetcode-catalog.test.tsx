import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import {
  LEETCODE_CATALOG,
  LEETCODE_CATALOG_TOTAL,
  buildCatalogStatement,
  getLeetCodeEntryByNumber,
  leetcodeProblemUrl,
  searchLeetCodeCatalog,
  toProblemFormPrefill,
  type LeetCodeCatalogEntry,
} from '../data/leetcodeCatalog';
import { ProblemForm } from '../components/problem/ProblemForm';
import { ToastProvider } from '../context/ToastContext';
import { clearAllLocalData } from '../db';

const fixture: LeetCodeCatalogEntry[] = [
  {
    number: 1,
    title: 'Two Sum',
    slug: 'two-sum',
    difficulty: 'Easy',
    topics: ['Array'],
    patterns: [],
    paidOnly: false,
  },
  {
    number: 15,
    title: '3Sum',
    slug: '3sum',
    difficulty: 'Medium',
    topics: ['Array'],
    patterns: ['Two Pointers'],
    paidOnly: false,
  },
  {
    number: 121,
    title: 'Best Time to Buy and Sell Stock',
    slug: 'best-time-to-buy-and-sell-stock',
    difficulty: 'Easy',
    topics: ['Array'],
    patterns: [],
    paidOnly: false,
  },
];

describe('LeetCode catalog — data integrity (auto-generated, verified against live API)', () => {
  it(`ships a massive catalog (${LEETCODE_CATALOG_TOTAL} entries)`, () => {
    expect(LEETCODE_CATALOG.length).toBe(LEETCODE_CATALOG_TOTAL);
    expect(LEETCODE_CATALOG.length).toBeGreaterThan(4000);
  });

  it('has unique, positive, ascending numbers with valid titles/slugs/difficulties', () => {
    const numbers = LEETCODE_CATALOG.map((e) => e.number);
    expect(new Set(numbers).size).toBe(numbers.length);
    expect(numbers.every((n) => Number.isInteger(n) && n > 0)).toBe(true);
    const sorted = [...numbers].sort((a, b) => a - b);
    expect(numbers).toEqual(sorted);

    for (const e of LEETCODE_CATALOG) {
      expect(e.title.trim().length).toBeGreaterThan(0);
      expect(e.slug).toMatch(/^[a-z0-9-]+$/);
      expect(['Easy', 'Medium', 'Hard']).toContain(e.difficulty);
      expect(leetcodeProblemUrl(e.slug)).toBe(`https://leetcode.com/problems/${e.slug}/`);
    }
  });

  it('spot-checks well-known problems for accuracy', () => {
    const twoSum = getLeetCodeEntryByNumber(1);
    expect(twoSum?.title).toBe('Two Sum');
    expect(twoSum?.difficulty).toBe('Easy');
    expect(twoSum?.topics).toEqual(expect.arrayContaining(['Array', 'Hash Table']));

    expect(getLeetCodeEntryByNumber(3)?.difficulty).toBe('Medium');
    expect(getLeetCodeEntryByNumber(3)?.patterns).toContain('Sliding Window');

    expect(getLeetCodeEntryByNumber(20)?.title).toBe('Valid Parentheses');
    expect(getLeetCodeEntryByNumber(42)?.difficulty).toBe('Hard');
    expect(getLeetCodeEntryByNumber(121)?.title).toBe('Best Time to Buy and Sell Stock');
    expect(getLeetCodeEntryByNumber(200)?.patterns).toEqual(expect.arrayContaining(['DFS', 'BFS']));
  });

  it('getLeetCodeEntryByNumber rejects non-positive / non-integer input', () => {
    expect(getLeetCodeEntryByNumber(0)).toBeUndefined();
    expect(getLeetCodeEntryByNumber(-5)).toBeUndefined();
    expect(getLeetCodeEntryByNumber(1.5)).toBeUndefined();
    expect(getLeetCodeEntryByNumber(Number.NaN)).toBeUndefined();
  });
});

describe('searchLeetCodeCatalog — ranking (pure, fixture-based)', () => {
  it('returns [] for blank queries', () => {
    expect(searchLeetCodeCatalog('   ', 8, fixture)).toEqual([]);
  });

  it('ranks exact number matches first, then number prefixes', () => {
    const exact = searchLeetCodeCatalog('1', 8, fixture);
    expect(exact[0].number).toBe(1);
    expect(exact.map((e) => e.number)).toContain(15);
    expect(exact.map((e) => e.number)).toContain(121);
  });

  it('matches title substrings case-insensitively', () => {
    const hits = searchLeetCodeCatalog('tWo sUm', 8, fixture);
    expect(hits.map((e) => e.number)).toEqual([1]);
  });

  it('respects the limit', () => {
    expect(searchLeetCodeCatalog('1', 1, fixture)).toHaveLength(1);
  });

  it('finds real entries in the full catalog by number and by title', () => {
    expect(searchLeetCodeCatalog('1', 5)[0].number).toBe(1);
    const byTitle = searchLeetCodeCatalog('Two Sum', 5);
    expect(byTitle[0].number).toBe(1);
    expect(searchLeetCodeCatalog('trapping rain water', 5)[0].number).toBe(42);
    expect(searchLeetCodeCatalog('definitely-not-a-problem-xyz', 5)).toEqual([]);
  });
});

describe('toProblemFormPrefill — form mapping', () => {
  it('maps every catalog field onto the Add-Problem form shape', () => {
    const entry = getLeetCodeEntryByNumber(1)!;
    const prefill = toProblemFormPrefill(entry);
    expect(prefill.number).toBe(1);
    expect(prefill.title).toBe('Two Sum');
    expect(prefill.url).toBe('https://leetcode.com/problems/two-sum/');
    expect(prefill.difficulty).toBe('Easy');
    expect(prefill.topics).toEqual(expect.arrayContaining(['Array', 'Hash Table']));
    expect(prefill.statement).toContain('LeetCode #1');
    expect(prefill.statement).toContain('https://leetcode.com/problems/two-sum/');
  });

  it('returns defensive copies so form edits never mutate the shared catalog', () => {
    const entry = getLeetCodeEntryByNumber(15)!;
    const before = [...entry.topics];
    const prefill = toProblemFormPrefill(entry);
    prefill.topics.push('MUTATED');
    prefill.patterns.push('MUTATED');
    expect(entry.topics).toEqual(before);
    expect(entry.patterns).not.toContain('MUTATED');
  });

  it('buildCatalogStatement stays copyright-safe (stub + link, no verbatim text)', () => {
    const stmt = buildCatalogStatement(getLeetCodeEntryByNumber(121)!);
    expect(stmt).toContain('Best Time to Buy and Sell Stock');
    expect(stmt).toContain('https://leetcode.com/problems/best-time-to-buy-and-sell-stock/');
    expect(stmt).not.toContain('Tip: paste the full problem statement');
  });
});

describe('ProblemForm + LeetCodePicker — auto-fill acceptance', () => {
  beforeEach(async () => {
    await clearAllLocalData();
  });

  it('searching by number and selecting fills the entire form', async () => {
    const user = userEvent.setup();
    let saved: unknown = null;

    render(
      <BrowserRouter>
        <ToastProvider>
          <ProblemForm
            onSubmit={async (data) => {
              saved = data;
            }}
          />
        </ToastProvider>
      </BrowserRouter>
    );

    // Catalog chunk loads lazily — wait for the search box to enable.
    const searchBox = await screen.findByPlaceholderText(/Two Sum/, undefined, {
      timeout: 10000,
    });
    await waitFor(() => expect(searchBox).toBeEnabled());

    await user.type(searchBox, 'Two Sum');
    const listbox = await screen.findByRole('listbox');
    // Ranked search puts the exact match (#1 Two Sum) first.
    const options = within(listbox).getAllByRole('option');
    expect(options[0]).toHaveTextContent('Two Sum');
    await user.click(options[0]);

    // Number, title, URL, difficulty auto-filled…
    await waitFor(() => {
      expect(screen.getByLabelText(/Leetcode Number/i)).toHaveValue(1);
    });
    expect(screen.getByLabelText(/Title/)).toHaveValue('Two Sum');
    expect(screen.getByLabelText(/Leetcode URL/i)).toHaveValue(
      'https://leetcode.com/problems/two-sum/'
    );
    expect(screen.getByLabelText(/Difficulty/i)).toHaveValue('Easy');
    const statementEl = screen.getByLabelText(/Problem statement/i) as HTMLTextAreaElement;
    expect(statementEl.value).toContain('LeetCode #1');
    expect(statementEl.value).toContain('https://leetcode.com/problems/two-sum/');

    // …topics chip rendered, form still submittable with zero typing.
    expect(screen.getByText('Array')).toBeInTheDocument();
    await user.click(screen.getByTestId('submit-problem-btn'));
    await waitFor(() => expect(saved).not.toBeNull());
    expect(saved).toMatchObject({
      number: 1,
      title: 'Two Sum',
      url: 'https://leetcode.com/problems/two-sum/',
      difficulty: 'Easy',
    });
  }, 30000);
});
