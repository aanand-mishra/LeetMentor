import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Star, AlertCircle, Bookmark, ChevronDown } from 'lucide-react';
import type {
  Difficulty,
  Status,
  ProblemFilterParams,
  SortOption,
} from '../../types';

interface Props {
  filters: ProblemFilterParams;
  onFilterChange: (newFilters: Partial<ProblemFilterParams>) => void;
  onClearAll: () => void;
  allAvailableTopics: string[];
  allAvailablePatterns: string[];
}

export const FilterPanel: React.FC<Props> = ({
  filters,
  onFilterChange,
  onClearAll,
  allAvailableTopics,
  allAvailablePatterns,
}) => {
  const [searchInput, setSearchInput] = useState(filters.query || '');
  const [topicDropdownOpen, setTopicDropdownOpen] = useState(false);
  const [patternDropdownOpen, setPatternDropdownOpen] = useState(false);
  const [topicSearch, setTopicSearch] = useState('');
  const [patternSearch, setPatternSearch] = useState('');

  const topicDropdownRef = useRef<HTMLDivElement>(null);
  const patternDropdownRef = useRef<HTMLDivElement>(null);

  // 200ms debounce for search input (FR-2.2)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== (filters.query || '')) {
        onFilterChange({ query: searchInput });
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [searchInput, filters.query, onFilterChange]);

  // Keep searchInput synced if external change (e.g. URL back/forward)
  useEffect(() => {
    setSearchInput(filters.query || '');
  }, [filters.query]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (topicDropdownRef.current && !topicDropdownRef.current.contains(e.target as Node)) {
        setTopicDropdownOpen(false);
      }
      if (patternDropdownRef.current && !patternDropdownRef.current.contains(e.target as Node)) {
        setPatternDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper toggle functions
  const toggleDifficulty = (d: Difficulty) => {
    const current = filters.difficulty || [];
    const next = current.includes(d) ? current.filter((x) => x !== d) : [...current, d];
    onFilterChange({ difficulty: next });
  };

  const toggleStatus = (s: Status) => {
    const current = filters.status || [];
    const next = current.includes(s) ? current.filter((x) => x !== s) : [...current, s];
    onFilterChange({ status: next });
  };

  const toggleTopic = (t: string) => {
    const current = filters.topics || [];
    const next = current.includes(t) ? current.filter((x) => x !== t) : [...current, t];
    onFilterChange({ topics: next });
  };

  const togglePattern = (p: string) => {
    const current = filters.patterns || [];
    const next = current.includes(p) ? current.filter((x) => x !== p) : [...current, p];
    onFilterChange({ patterns: next });
  };

  const toggleConfidence = (c: 1 | 2 | 3 | 4 | 5 | 'unrated') => {
    const current = filters.confidence || [];
    const next = current.includes(c) ? current.filter((x) => x !== c) : [...current, c];
    onFilterChange({ confidence: next });
  };

  // Has active filters check
  const hasActiveFilters =
    Boolean(filters.query) ||
    (filters.difficulty && filters.difficulty.length > 0) ||
    (filters.status && filters.status.length > 0) ||
    (filters.topics && filters.topics.length > 0) ||
    (filters.patterns && filters.patterns.length > 0) ||
    (filters.confidence && filters.confidence.length > 0) ||
    Boolean(filters.starredOnly) ||
    Boolean(filters.reviewQueueOnly) ||
    Boolean(filters.unresolvedReviewOnly);

  const filteredTopicList = allAvailableTopics.filter((t) =>
    t.toLowerCase().includes(topicSearch.toLowerCase().trim())
  );

  const filteredPatternList = allAvailablePatterns.filter((p) =>
    p.toLowerCase().includes(patternSearch.toLowerCase().trim())
  );

  return (
    <div className="space-y-4 mb-6">
      {/* Top Row: Search Input and Sort Dropdown */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Search Input with hotkey indicator */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="search-input"
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by title, number, topic, pattern..."
            className="w-full pl-9 pr-14 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {searchInput ? (
              <button
                onClick={() => setSearchInput('')}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded">
                /
              </kbd>
            )}
          </div>
        </div>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-2">
          <label htmlFor="sort-select" className="text-xs font-medium text-slate-500 shrink-0">
            Sort:
          </label>
          <select
            id="sort-select"
            value={filters.sort || 'dateAdded_desc'}
            onChange={(e) => onFilterChange({ sort: e.target.value as SortOption })}
            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="dateAdded_desc">Date added (newest)</option>
            <option value="dateAdded_asc">Date added (oldest)</option>
            <option value="dateSolved_desc">Date solved (newest)</option>
            <option value="dateSolved_asc">Date solved (oldest)</option>
            <option value="number_asc">Number (low to high)</option>
            <option value="number_desc">Number (high to low)</option>
            <option value="title_asc">Title (A → Z)</option>
            <option value="title_desc">Title (Z → A)</option>
            <option value="difficulty_asc">Difficulty (Easy → Hard)</option>
            <option value="difficulty_desc">Difficulty (Hard → Easy)</option>
            <option value="confidence_asc">Confidence (low to high)</option>
            <option value="confidence_desc">Confidence (high to low)</option>
            <option value="timeSpent_desc">Time spent (high to low)</option>
            <option value="timeSpent_asc">Time spent (low to high)</option>
          </select>
        </div>
      </div>

      {/* Filter Facet Controls Bar */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {/* Quick Toggles */}
        <button
          type="button"
          onClick={() => onFilterChange({ starredOnly: !filters.starredOnly })}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-medium transition-colors ${
            filters.starredOnly
              ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
              : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <Star className={`w-3.5 h-3.5 ${filters.starredOnly ? 'fill-current' : ''}`} />
          Starred
        </button>

        <button
          type="button"
          onClick={() => onFilterChange({ reviewQueueOnly: !filters.reviewQueueOnly })}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-medium transition-colors ${
            filters.reviewQueueOnly
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
              : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
          title="Problems solved with confidence <= 3, sorted by confidence asc then dateSolved asc"
        >
          <Bookmark className="w-3.5 h-3.5" />
          Review Queue
        </button>

        <button
          type="button"
          onClick={() => onFilterChange({ unresolvedReviewOnly: !filters.unresolvedReviewOnly })}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-medium transition-colors ${
            filters.unresolvedReviewOnly
              ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
              : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
          title="Latest attempt received a revise verdict"
        >
          <AlertCircle className="w-3.5 h-3.5" />
          Unresolved Review
        </button>

        {/* Difficulty Pill Selectors */}
        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1 hidden sm:block" />

        {(['Easy', 'Medium', 'Hard'] as Difficulty[]).map((diff) => {
          const isSelected = filters.difficulty?.includes(diff);
          return (
            <button
              key={diff}
              type="button"
              onClick={() => toggleDifficulty(diff)}
              className={`px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${
                isSelected
                  ? diff === 'Easy'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : diff === 'Medium'
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-rose-600 text-white border-rose-600'
                  : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {diff}
            </button>
          );
        })}

        {/* Status Pill Selectors */}
        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1 hidden sm:block" />

        {(['Not Started', 'In Progress', 'Solved'] as Status[]).map((st) => {
          const isSelected = filters.status?.includes(st);
          return (
            <button
              key={st}
              type="button"
              onClick={() => toggleStatus(st)}
              className={`px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${
                isSelected
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {st}
            </button>
          );
        })}

        {/* Topics Dropdown with In-Dropdown Search */}
        <div className="relative" ref={topicDropdownRef}>
          <button
            type="button"
            onClick={() => setTopicDropdownOpen((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-medium transition-colors ${
              (filters.topics || []).length > 0
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950/60 dark:border-indigo-800 dark:text-indigo-300'
                : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            Topics {(filters.topics || []).length > 0 && `(${(filters.topics || []).length})`}
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {topicDropdownOpen && (
            <div className="absolute left-0 top-full mt-1.5 w-60 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-30 p-2 text-xs">
              <input
                type="text"
                value={topicSearch}
                onChange={(e) => setTopicSearch(e.target.value)}
                placeholder="Search topics..."
                className="w-full px-2 py-1.5 mb-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <div className="max-h-48 overflow-y-auto space-y-1">
                {filteredTopicList.map((topic) => {
                  const isChecked = filters.topics?.includes(topic);
                  return (
                    <label
                      key={topic}
                      className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-slate-800 dark:text-slate-200"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleTopic(topic)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{topic}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Patterns Dropdown with In-Dropdown Search */}
        <div className="relative" ref={patternDropdownRef}>
          <button
            type="button"
            onClick={() => setPatternDropdownOpen((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-medium transition-colors ${
              (filters.patterns || []).length > 0
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950/60 dark:border-indigo-800 dark:text-indigo-300'
                : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            Patterns {(filters.patterns || []).length > 0 && `(${(filters.patterns || []).length})`}
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {patternDropdownOpen && (
            <div className="absolute left-0 top-full mt-1.5 w-60 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-30 p-2 text-xs">
              <input
                type="text"
                value={patternSearch}
                onChange={(e) => setPatternSearch(e.target.value)}
                placeholder="Search patterns..."
                className="w-full px-2 py-1.5 mb-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <div className="max-h-48 overflow-y-auto space-y-1">
                {filteredPatternList.map((pat) => {
                  const isChecked = filters.patterns?.includes(pat);
                  return (
                    <label
                      key={pat}
                      className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-slate-800 dark:text-slate-200"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => togglePattern(pat)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{pat}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Confidence Filters */}
        <div className="flex items-center gap-1">
          <span className="text-slate-400 ml-1">Rating:</span>
          {([1, 2, 3, 4, 5] as const).map((conf) => {
            const isSelected = filters.confidence?.includes(conf);
            return (
              <button
                key={conf}
                type="button"
                onClick={() => toggleConfidence(conf)}
                className={`w-6 h-6 rounded flex items-center justify-center font-bold text-xs transition-colors ${
                  isSelected
                    ? 'bg-amber-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {conf}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => toggleConfidence('unrated')}
            className={`px-2 py-1 rounded text-xs transition-colors ${
              filters.confidence?.includes('unrated')
                ? 'bg-slate-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Unrated
          </button>
        </div>
      </div>

      {/* Active Filter Chips with 'Clear all' (FR-2.3) */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-xs text-slate-500 font-medium">Active filters:</span>

          {filters.query && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              "{filters.query}"
              <button onClick={() => onFilterChange({ query: '' })}>
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {filters.difficulty?.map((d) => (
            <span
              key={d}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300"
            >
              {d}
              <button onClick={() => toggleDifficulty(d)}>
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {filters.status?.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300"
            >
              {s}
              <button onClick={() => toggleStatus(s)}>
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {filters.topics?.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            >
              Topic: {t}
              <button onClick={() => toggleTopic(t)}>
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {filters.patterns?.map((p) => (
            <span
              key={p}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            >
              Pattern: {p}
              <button onClick={() => togglePattern(p)}>
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {filters.confidence?.map((c) => (
            <span
              key={c}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200"
            >
              Rating: {c}
              <button onClick={() => toggleConfidence(c)}>
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {filters.starredOnly && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200">
              Starred
              <button onClick={() => onFilterChange({ starredOnly: false })}>
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {filters.reviewQueueOnly && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
              Review Queue
              <button onClick={() => onFilterChange({ reviewQueueOnly: false })}>
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {filters.unresolvedReviewOnly && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200">
              Unresolved Review
              <button onClick={() => onFilterChange({ unresolvedReviewOnly: false })}>
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          <button
            onClick={onClearAll}
            className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline ml-1"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
};
