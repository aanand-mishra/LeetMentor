import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { BookOpenCheck, Check, Crown, Loader2, Search, X } from 'lucide-react';
import type { LeetCodeCatalogEntry } from '../../data/leetcodeCatalog';

// The catalog (~4k entries) is lazy-loaded so the initial bundle stays small.
// Helpers are pure and imported from the same module once it resolves.
type CatalogModule = typeof import('../../data/leetcodeCatalog');

interface Props {
  /** Called with the chosen entry; parent fills the form fields. */
  onSelect: (entry: LeetCodeCatalogEntry) => void;
  /** Currently applied entry (if any), shown as a confirmation chip. */
  selectedEntry: LeetCodeCatalogEntry | null;
  /** Clears the applied-entry chip (form values are kept for manual editing). */
  onClearSelection: () => void;
  disabled?: boolean;
}

const DIFFICULTY_DOT: Record<string, string> = {
  Easy: 'bg-emerald-500',
  Medium: 'bg-amber-500',
  Hard: 'bg-rose-500',
};

const DIFFICULTY_TEXT: Record<string, string> = {
  Easy: 'text-emerald-700 dark:text-emerald-300',
  Medium: 'text-amber-700 dark:text-amber-300',
  Hard: 'text-rose-700 dark:text-rose-300',
};

/**
 * Search-as-you-type picker over the offline LeetCode catalog.
 * Searches by question number and title; selecting an entry lets the
 * parent form auto-fill number, title, URL, statement, difficulty,
 * topics, and patterns.
 */
export const LeetCodePicker: React.FC<Props> = ({
  onSelect,
  selectedEntry,
  onClearSelection,
  disabled = false,
}) => {
  const [catalog, setCatalog] = useState<readonly LeetCodeCatalogEntry[] | null>(null);
  const [searchFn, setSearchFn] = useState<CatalogModule['searchLeetCodeCatalog'] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const inputId = useId();

  // Lazy-load the ~4k-entry catalog on first mount (code-split chunk,
  // works fully offline once bundled — no network request at runtime).
  useEffect(() => {
    let cancelled = false;
    import('../../data/leetcodeCatalog')
      .then((mod) => {
        if (cancelled) return;
        setCatalog(mod.LEETCODE_CATALOG);
        setSearchFn(() => mod.searchLeetCodeCatalog);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Close dropdown on outside click.
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const results = useMemo(() => {
    if (!catalog || !searchFn || !query.trim()) return [];
    return searchFn(query, 8, catalog);
  }, [catalog, searchFn, query]);

  // Keep the highlighted index in range as results change.
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (activeIndex >= results.length && results.length > 0) {
      setActiveIndex(results.length - 1);
    }
  }, [results.length, activeIndex]);

  const handleSelect = (entry: LeetCodeCatalogEntry) => {
    onSelect(entry);
    setQuery('');
    setIsOpen(false);
    setActiveIndex(0);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && results.length > 0) {
      e.preventDefault();
      setIsOpen(true);
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp' && results.length > 0) {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === 'Enter' && isOpen && results.length > 0) {
      e.preventDefault();
      handleSelect(results[activeIndex] ?? results[0]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const isLoading = !catalog && !loadError;

  return (
    <div
      ref={containerRef}
      className="rounded-2xl border border-indigo-200/80 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/20 p-4 sm:p-5 shadow-xs transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookOpenCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-300 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Quick fill from LeetCode catalog
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Search by number or title — selecting fills the whole form. You can still edit
              everything afterwards.
            </p>
          </div>
        </div>
        {selectedEntry && (
          <span className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 text-xs font-medium bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 rounded-full whitespace-nowrap">
            <Check className="w-3.5 h-3.5" />#{selectedEntry.number} ·{' '}
            {selectedEntry.title.length > 24
              ? `${selectedEntry.title.slice(0, 24)}…`
              : selectedEntry.title}
            <button
              type="button"
              onClick={onClearSelection}
              aria-label="Clear auto-filled selection"
              className="p-0.5 rounded-full hover:bg-emerald-200 dark:hover:bg-emerald-800 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </span>
        )}
      </div>

      <div className="relative mt-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={isOpen && results.length > 0}
          aria-controls={listId}
          aria-activedescendant={
            isOpen && results.length > 0 ? `${listId}-option-${activeIndex}` : undefined
          }
          autoComplete="off"
          spellCheck={false}
          disabled={disabled || isLoading || loadError}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (query.trim()) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={
            isLoading
              ? 'Loading 4,055 LeetCode problems…'
              : loadError
                ? 'Catalog failed to load — fill the form manually'
                : 'e.g. 1, 121, or “Two Sum”…'
          }
          className="w-full pl-9 pr-9 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow disabled:opacity-60"
        />
        {isLoading ? (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
        ) : (
          query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setIsOpen(false);
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )
        )}

        {isOpen && results.length > 0 && (
          <ul
            id={listId}
            role="listbox"
            aria-label="Matching LeetCode problems"
            className="absolute left-0 right-0 top-full mt-1.5 max-h-72 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-20 py-1"
          >
            {results.map((entry, idx) => (
              <li
                key={entry.number}
                id={`${listId}-option-${idx}`}
                role="option"
                aria-selected={idx === activeIndex}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => handleSelect(entry)}
                className={`px-3 py-2 cursor-pointer flex items-center gap-2.5 transition-colors ${
                  idx === activeIndex ? 'bg-indigo-50 dark:bg-indigo-900/40' : 'bg-transparent'
                }`}
              >
                <span className="text-xs font-mono font-semibold text-slate-400 dark:text-slate-500 w-11 shrink-0">
                  #{entry.number}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                    {entry.title}
                    {entry.paidOnly && (
                      <Crown
                        className="inline w-3.5 h-3.5 ml-1.5 -mt-0.5 text-amber-500"
                        aria-label="Premium-only problem"
                      />
                    )}
                  </span>
                  <span className="block text-[11px] text-slate-400 dark:text-slate-500 truncate">
                    {entry.topics.length > 0
                      ? entry.topics.slice(0, 3).join(' · ')
                      : 'Topics not curated yet'}
                  </span>
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-medium shrink-0 ${DIFFICULTY_TEXT[entry.difficulty]}`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${DIFFICULTY_DOT[entry.difficulty]}`}
                  />
                  {entry.difficulty}
                </span>
              </li>
            ))}
          </ul>
        )}

        {isOpen && query.trim() && !isLoading && results.length === 0 && (
          <div className="absolute left-0 right-0 top-full mt-1.5 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-20 text-sm text-slate-500 dark:text-slate-400">
            No LeetCode problem matches “{query.trim()}”. Try a number (e.g. 75) or a title keyword
            — or just fill the form manually below.
          </div>
        )}
      </div>

      <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
        {loadError
          ? 'Catalog unavailable. All fields below still work manually.'
          : '4,055 problems · works offline · fills number, title, URL, difficulty, topics, patterns & statement stub.'}
      </p>
    </div>
  );
};
