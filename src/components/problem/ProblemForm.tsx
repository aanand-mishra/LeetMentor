import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, AlertTriangle, ArrowLeft } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Problem, Difficulty, Status } from '../../types';
import { TAXONOMY_TOPICS, TAXONOMY_PATTERNS } from '../../types';
import type { LeetCodeCatalogEntry } from '../../data/leetcodeCatalog';
import { TagInput } from '../common/TagInput';
import { LeetCodePicker } from './LeetCodePicker';
import { db, problemsRepo } from '../../db';

const COMMON_LANGUAGES = [
  'python',
  'javascript',
  'typescript',
  'cpp',
  'java',
  'go',
  'rust',
  'csharp',
];

export interface ProblemFormData {
  number: number | null;
  title: string;
  url: string | null;
  statement: string;
  difficulty: Difficulty;
  topics: string[];
  patterns: string[];
  status: Status;
  language: string;
  timeSpentMinutes: number | null;
}

interface Props {
  initialData?: Partial<Problem>;
  onSubmit: (data: ProblemFormData) => Promise<void>;
  isSubmitting?: boolean;
  submitButtonText?: string;
  cancelHref?: string;
}

const LEETCODE_URL_REGEX = /^https?:\/\/(www\.)?leetcode\.com\/problems\/[a-z0-9-]+\/?/i;

export const ProblemForm: React.FC<Props> = ({
  initialData,
  onSubmit,
  isSubmitting = false,
  submitButtonText = 'Save Problem',
  cancelHref = '/',
}) => {
  const [number, setNumber] = useState<string>(
    initialData?.number !== undefined && initialData.number !== null
      ? String(initialData.number)
      : ''
  );
  const [title, setTitle] = useState(initialData?.title || '');
  const [url, setUrl] = useState(initialData?.url || '');
  const [statement, setStatement] = useState(initialData?.statement || '');
  const [difficulty, setDifficulty] = useState<Difficulty>(initialData?.difficulty || 'Medium');
  const [topics, setTopics] = useState<string[]>(initialData?.topics || []);
  const [patterns, setPatterns] = useState<string[]>(initialData?.patterns || []);
  const [status, setStatus] = useState<Status>(initialData?.status || 'Not Started');
  const [language, setLanguage] = useState(initialData?.language || 'python');
  const [timeSpentMinutes, setTimeSpentMinutes] = useState<string>(
    initialData?.timeSpentMinutes ? String(initialData.timeSpentMinutes) : ''
  );

  // Errors & Warnings
  const [titleError, setTitleError] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [numberWarning, setNumberWarning] = useState<{ id: string; title: string } | null>(null);

  // Catalog auto-fill source (null = manual entry). Kept for the confirmation
  // chip only — the field states above remain the single source of truth and
  // stay fully editable after a fill.
  const [catalogEntry, setCatalogEntry] = useState<LeetCodeCatalogEntry | null>(null);
  // Guards against out-of-order fills when the catalog chunk resolves slowly
  // and the user picks two entries in quick succession (last pick wins).
  const catalogSelectSeq = useRef(0);

  /**
   * Fill every catalog-mapped field from a LeetCode catalog entry.
   * Status / language / time-spent are deliberately untouched: they describe
   * *your* progress, not the problem itself.
   *
   * The catalog module (~4k entries) is imported lazily so it ships in its
   * own code-split chunk instead of bloating the initial bundle.
   */
  const handleCatalogSelect = async (entry: LeetCodeCatalogEntry) => {
    const seq = ++catalogSelectSeq.current;
    const { toProblemFormPrefill } = await import('../../data/leetcodeCatalog');
    if (seq !== catalogSelectSeq.current) return; // a newer pick superseded this one
    const prefill = toProblemFormPrefill(entry);
    setNumber(String(prefill.number));
    setTitle(prefill.title);
    setUrl(prefill.url);
    setStatement(prefill.statement);
    setDifficulty(prefill.difficulty);
    setTopics(prefill.topics);
    setPatterns(prefill.patterns);
    setTitleError(null);
    setUrlError(null);
    setCatalogEntry(entry);
  };

  /** Dismiss the chip when the user manually diverges from the filled entry. */
  const handleNumberChange = (value: string) => {
    setNumber(value);
    if (catalogEntry && value.trim() !== String(catalogEntry.number)) {
      setCatalogEntry(null);
    }
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (titleError) setTitleError(null);
    if (catalogEntry && value.trim() !== catalogEntry.title) {
      setCatalogEntry(null);
    }
  };

  // Reactive settings from Dexie
  const liveSettings = useLiveQuery(() => db.settings.get('current'), []);
  const userEditedLanguageRef = useRef(false);

  // Sync default language from settings if adding new problem and user hasn't typed custom language
  useEffect(() => {
    if (!initialData?.language && liveSettings?.defaultLanguage && !userEditedLanguageRef.current) {
      setLanguage(liveSettings.defaultLanguage);
    }
  }, [initialData?.language, liveSettings?.defaultLanguage]);

  // If initialData changes (e.g. loaded in edit mode)
  useEffect(() => {
    if (initialData?.language) {
      setLanguage(initialData.language);
    }
  }, [initialData?.language]);

  // Check duplicate problem number (non-blocking warning per FR-1.2)
  useEffect(() => {
    const num = parseInt(number, 10);
    if (!isNaN(num) && num > 0) {
      problemsRepo.getByNumber(num).then((found) => {
        if (found && found.id !== initialData?.id) {
          setNumberWarning({ id: found.id, title: found.title });
        } else {
          setNumberWarning(null);
        }
      });
    } else {
      setNumberWarning(null);
    }
  }, [number, initialData?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let hasError = false;

    // Validate Title: required, trimmed, 1-200 chars (FR-1.2)
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setTitleError('Title is required');
      hasError = true;
    } else if (trimmedTitle.length > 200) {
      setTitleError('Title must be 200 characters or fewer');
      hasError = true;
    } else {
      setTitleError(null);
    }

    // Validate URL: if present, must match regex (FR-1.2)
    const trimmedUrl = url.trim();
    if (trimmedUrl && !LEETCODE_URL_REGEX.test(trimmedUrl)) {
      setUrlError('URL must match https://leetcode.com/problems/<problem-slug>/');
      hasError = true;
    } else {
      setUrlError(null);
    }

    if (hasError) return;

    const parsedNumber = number.trim() ? parseInt(number.trim(), 10) : null;
    const parsedTime = timeSpentMinutes.trim() ? parseInt(timeSpentMinutes.trim(), 10) : null;
    const finalStatus =
      parsedTime !== null && !isNaN(parsedTime) && parsedTime >= 0 ? 'Solved' : status;

    await onSubmit({
      number: !isNaN(parsedNumber as number) && (parsedNumber as number) > 0 ? parsedNumber : null,
      title: trimmedTitle,
      url: trimmedUrl || null,
      statement: statement.trim(),
      difficulty,
      topics,
      patterns,
      status: finalStatus,
      language: language.trim() || 'python',
      timeSpentMinutes:
        finalStatus === 'Solved' && !isNaN(parsedTime as number) && (parsedTime as number) >= 0
          ? parsedTime
          : null,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          handleSubmit(e);
        }
      }}
      className="space-y-6 max-w-3xl"
    >
      {/* Top Header & Breadcrumb Nav */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-800">
        <Link
          to={cancelHref}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Cancel &amp; return</span>
        </Link>
        <span className="text-xs text-slate-400 font-mono hidden sm:inline">
          Tip: Press Ctrl+Enter to save
        </span>
      </div>

      {/* Catalog Quick Picker */}
      <LeetCodePicker
        onSelect={handleCatalogSelect}
        selectedEntry={catalogEntry}
        onClearSelection={() => setCatalogEntry(null)}
        disabled={isSubmitting}
      />

      {/* Card 1: Problem Identity */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Problem Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Problem Number */}
          <div className="space-y-1.5 md:col-span-1">
            <label
              htmlFor="problem-number"
              className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
            >
              Leetcode Number
            </label>
            <input
              id="problem-number"
              type="number"
              min="1"
              value={number}
              onChange={(e) => handleNumberChange(e.target.value)}
              placeholder="e.g. 75"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
            />
          </div>

          {/* Title */}
          <div className="space-y-1.5 md:col-span-3">
            <label
              htmlFor="problem-title"
              className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
            >
              Title <span className="text-rose-500">*</span>
            </label>
            <input
              id="problem-title"
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="e.g. Sort colors"
              maxLength={200}
              className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border rounded-xl text-sm focus:ring-2 outline-none transition-shadow ${
                titleError
                  ? 'border-rose-500 focus:ring-rose-500'
                  : 'border-slate-200 dark:border-slate-700 focus:ring-indigo-500 focus:border-indigo-500'
              }`}
            />
            {titleError && (
              <p className="flex items-center gap-1 text-xs text-rose-500 mt-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {titleError}
              </p>
            )}
          </div>
        </div>

        {/* Duplicate Number Non-blocking Warning (FR-1.2) */}
        {numberWarning && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div>
              Problem #{number} already exists:{' '}
              <Link
                to={`/problem/${numberWarning.id}`}
                className="font-semibold underline hover:text-amber-900 dark:hover:text-amber-100"
              >
                {numberWarning.title}
              </Link>
              . You can still save this problem if intentional.
            </div>
          </div>
        )}

        {/* URL */}
        <div className="space-y-1.5">
          <label
            htmlFor="problem-url"
            className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
          >
            Leetcode URL
          </label>
          <input
            id="problem-url"
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (urlError) setUrlError(null);
            }}
            placeholder="https://leetcode.com/problems/sort-colors/"
            className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border rounded-xl text-sm focus:ring-2 outline-none transition-shadow ${
              urlError
                ? 'border-rose-500 focus:ring-rose-500'
                : 'border-slate-200 dark:border-slate-700 focus:ring-indigo-500 focus:border-indigo-500'
            }`}
          />
          {urlError && (
            <p className="flex items-center gap-1 text-xs text-rose-500 mt-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {urlError}
            </p>
          )}
        </div>
      </div>

      {/* Card 2: Problem Statement */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-2">
        <label
          htmlFor="problem-statement"
          className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
        >
          Problem statement (paste or summarize — improves mentor quality a lot)
        </label>
        <textarea
          id="problem-statement"
          rows={6}
          value={statement}
          onChange={(e) => setStatement(e.target.value)}
          placeholder="Paste problem description, examples, and constraints here..."
          className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-sans focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow leading-relaxed"
        />
      </div>

      {/* Card 3: Classification & Taxonomy */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Classification &amp; Practice State
        </h3>
        {/* Difficulty and Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Difficulty */}
          <div className="space-y-1.5">
            <label
              htmlFor="problem-difficulty"
              className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
            >
              Difficulty <span className="text-rose-500">*</span>
            </label>
            <select
              id="problem-difficulty"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as Difficulty)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none cursor-pointer"
            >
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <label
              htmlFor="problem-status"
              className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
            >
              Status
            </label>
            <select
              id="problem-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as Status)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none cursor-pointer"
            >
              <option value="Not Started">Not Started</option>
              <option value="In Progress">In Progress</option>
              <option value="Solved">Solved</option>
            </select>
          </div>
        </div>

        {/* Topics & Patterns Tag Inputs */}
        <div className="space-y-4 pt-1">
          <TagInput
            label="Topics"
            tags={topics}
            suggestions={TAXONOMY_TOPICS}
            onChange={setTopics}
            placeholder="e.g. Array, Hash Table"
          />

          <TagInput
            label="Patterns"
            tags={patterns}
            suggestions={TAXONOMY_PATTERNS}
            onChange={setPatterns}
            placeholder="e.g. Two Pointers, Sliding Window"
          />
        </div>

        {/* Language & Time spent (only shown when status === 'Solved') */}
        <div
          className={`grid gap-4 pt-1 ${status === 'Solved' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}
        >
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Language
            </label>
            <select
              value={COMMON_LANGUAGES.includes(language) ? language : '__other__'}
              onChange={(e) => {
                userEditedLanguageRef.current = true;
                if (e.target.value !== '__other__') {
                  setLanguage(e.target.value);
                }
              }}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none cursor-pointer"
            >
              {COMMON_LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l.charAt(0).toUpperCase() + l.slice(1)}
                </option>
              ))}
              {!COMMON_LANGUAGES.includes(language) && language && (
                <option value="__other__">{language}</option>
              )}
            </select>
          </div>

          {status === 'Solved' && (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Time Spent (minutes)
              </label>
              <input
                type="number"
                min="0"
                value={timeSpentMinutes}
                onChange={(e) => setTimeSpentMinutes(e.target.value)}
                placeholder="e.g. 25"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
          )}
        </div>
      </div>

      {/* Primary Submit Action Bar */}
      <div className="pt-2 flex items-center justify-end gap-3">
        <Link
          to={cancelHref}
          className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
        >
          Cancel
        </Link>
        <button
          type="submit"
          data-testid="submit-problem-btn"
          disabled={isSubmitting}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-semibold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
        >
          {isSubmitting ? 'Saving...' : submitButtonText}
        </button>
      </div>
    </form>
  );
};
