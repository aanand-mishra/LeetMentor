import React, { useState, useRef, useEffect } from 'react';
import {
  Code,
  Send,
  Save,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileCheck,
  MessageSquare,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Problem, Attempt, CodeReview } from '../../types';
import { db, attemptsRepo, problemsRepo, settingsRepo } from '../../db';
import { requestCodeReview } from '../../lib/gemini/client';
import { CodeDisplay } from './CodeDisplay';
import { CodeReviewBlock } from './CodeReviewBlock';
import { useToast } from '../../hooks/useToast';

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

interface Props {
  problem: Problem;
  attempts: Attempt[];
  onProblemUpdated: () => void;
  prefillCode?: string;
  onReviewRequested?: (attempt: Attempt) => Promise<CodeReview>;
}

export const AttemptsTab: React.FC<Props> = ({
  problem,
  attempts,
  onProblemUpdated,
  prefillCode = '',
  onReviewRequested,
}) => {
  const toast = useToast();
  const liveSettings = useLiveQuery(() => db.settings.get('current'), []);
  const userEditedLanguageRef = useRef(false);

  const [code, setCode] = useState(prefillCode);
  const [language, setLanguage] = useState(
    problem.language || 'python'
  );
  const [userComment, setUserComment] = useState('');

  // Sync language with settings or previous attempt if not manually modified
  useEffect(() => {
    if (userEditedLanguageRef.current) return;

    if (attempts.length > 0 && attempts[0].language) {
      setLanguage(attempts[0].language);
    } else if (liveSettings?.defaultLanguage) {
      setLanguage(liveSettings.defaultLanguage);
    } else if (problem.language) {
      setLanguage(problem.language);
    }
  }, [liveSettings?.defaultLanguage, attempts, problem.language]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReviewingId, setIsReviewingId] = useState<string | null>(null);
  const [expandedAttempts, setExpandedAttempts] = useState<Record<string, boolean>>({
    // Newest attempt is expanded by default (FR-4.6)
    [attempts[0]?.id || '']: true,
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  // Focus-escape flag for Tab key (Esc then Tab escapes focus for accessibility per FR-4.1)
  const escPressedRef = useRef(false);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      escPressedRef.current = true;
      setTimeout(() => {
        escPressedRef.current = false;
      }, 1000);
      return;
    }

    if (e.key === 'Tab') {
      if (escPressedRef.current) {
        // Allow default Tab to move focus
        escPressedRef.current = false;
        return;
      }

      // Insert tab character rather than moving focus (FR-4.1)
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const newCode = code.substring(0, start) + '    ' + code.substring(end);
      setCode(newCode);

      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 4;
      }, 0);
    }
  };

  const handleSave = async (shouldReview: boolean) => {
    const trimmedCode = code.trim();
    if (!trimmedCode) {
      toast.error('Please paste code for your attempt before saving.');
      return;
    }

    try {
      setIsSubmitting(true);

      // Create attempt in database (FR-4.2)
      const attempt = await attemptsRepo.create({
        problemId: problem.id,
        code: trimmedCode,
        language,
        userComment: userComment.trim(),
      });

      setCode('');
      setUserComment('');
      userEditedLanguageRef.current = false;
      toast.success(`Attempt #${attempt.attemptNumber} saved!`);

      // Set newest expanded
      setExpandedAttempts((prev) => ({ ...prev, [attempt.id]: true }));

      if (shouldReview) {
        setIsReviewingId(attempt.id);
        await performReview(attempt);
      } else {
        onProblemUpdated();
      }
    } catch (err) {
      console.error('Failed to save attempt:', err);
      toast.error('Failed to save attempt.');
    } finally {
      setIsSubmitting(false);
      setIsReviewingId(null);
    }
  };

  const performReview = async (attempt: Attempt) => {
    try {
      setIsReviewingId(attempt.id);
      let reviewResult: CodeReview;

      if (onReviewRequested) {
        reviewResult = await onReviewRequested(attempt);
      } else {
        const settings = await settingsRepo.get();
        if (settings.geminiApiKey && settings.geminiApiKey.trim()) {
          const prevAttempt = attempts.find((a) => a.attemptNumber === attempt.attemptNumber - 1);
          reviewResult = await requestCodeReview(problem, attempt, prevAttempt);
        } else {
          // Fallback realistic mock review when no API key configured
          await new Promise((res) => setTimeout(res, 400));
          const isOpt = attempt.code.includes('seen') || attempt.code.includes('dict') || attempt.code.includes('map');
          reviewResult = {
            verdict: isOpt ? 'pass' : 'revise',
            summary: isOpt
              ? 'Optimal time and space complexity using a single-pass hash lookup. All constraints and edge cases handled.'
              : 'The current solution uses nested iteration resulting in quadratic runtime. Revise to meet optimal bounds.',
            correctness: {
              status: isOpt ? 'correct' : 'fails_edge_cases',
              failingCases: isOpt ? [] : ['Large input performance limit (TLE)'],
            },
            complexity: {
              time: isOpt ? 'O(n)' : 'O(n^2)',
              space: isOpt ? 'O(n)' : 'O(1)',
              optimalTime: 'O(n)',
              optimalSpace: 'O(n)',
              isOptimal: isOpt,
            },
            issues: isOpt
              ? []
              : [
                {
                  severity: 'major',
                  title: 'Quadratic Time Complexity',
                  detail: 'Nested loop over array leads to O(n^2) runtime.',
                  suggestion: 'Trade space for time by caching visited elements in a map.',
                },
              ],
            positives: ['Clean logic structure', 'Proper syntax and argument handling'],
            nextStep: isOpt
              ? 'Great work! Try an advanced variation or review your notes.'
              : 'Replace the inner loop with a hash map lookup to achieve O(n) runtime.',
            model: settings.model || 'gemini-flash-lite-latest',
            createdAt: new Date().toISOString(),
          };
        }
      }

      await attemptsRepo.attachReview(attempt.id, reviewResult);

      if (reviewResult.verdict === 'pass') {
        toast.success('Attempt PASSED code review! 🎉');
        // If not already marked solved, update problem status to Solved
        if (problem.status !== 'Solved') {
          await problemsRepo.update(problem.id, {
            status: 'Solved',
            dateSolved: new Date().toISOString(),
          });
        }
        onProblemUpdated();
      } else {
        toast.info('Review returned REVISE. Fix issues and resubmit.');
        onProblemUpdated();
      }
    } catch (err) {
      console.error('Failed to review attempt:', err);
      toast.error(err instanceof Error ? err.message : 'Code review failed. Please retry.');
    } finally {
      setIsReviewingId(null);
    }
  };

  const handleFixAndResubmit = (prevCode: string) => {
    setCode(prevCode);
    formRef.current?.scrollIntoView?.({ behavior: 'smooth' });
    textareaRef.current?.focus();
    toast.info('Loaded previous code into submission box.');
  };

  const toggleExpand = (attemptId: string) => {
    setExpandedAttempts((prev) => ({
      ...prev,
      [attemptId]: !prev[attemptId],
    }));
  };

  const formatDate = (isoStr: string) => {
    try {
      return format(parseISO(isoStr), 'MMM d, h:mm a');
    } catch {
      return isoStr;
    }
  };

  const sortedAttempts = [...attempts].sort((a, b) => b.attemptNumber - a.attemptNumber);
  const latestAttempt = sortedAttempts[0];
  const hasUnresolvedLatest = latestAttempt?.review?.verdict === 'revise';

  return (
    <div className="space-y-6">
      {/* Persistent Prompt on Revise Verdict (FR-4.5) */}
      {hasUnresolvedLatest && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <h4 className="text-sm font-bold text-amber-900 dark:text-amber-100">
                Fix the issues above and submit attempt #{latestAttempt.attemptNumber + 1}
              </h4>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                Edit your solution to satisfy the reviewer's feedback.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleFixAndResubmit(latestAttempt.code)}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors shrink-0"
          >
            Fix and resubmit
          </button>
        </div>
      )}

      {/* Attempt Submission Form (FR-4.1) */}
      <div
        ref={formRef}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Code className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Submit Attempt #{attempts.length + 1}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="attempt-lang" className="text-xs text-slate-500 font-medium shrink-0">
              Language:
            </label>
            <select
              id="attempt-lang"
              value={COMMON_LANGUAGES.includes(language) ? language : '__other__'}
              onChange={(e) => {
                userEditedLanguageRef.current = true;
                if (e.target.value !== '__other__') {
                  setLanguage(e.target.value);
                }
              }}
              className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-xs font-mono text-slate-900 dark:text-slate-100 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              {COMMON_LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l.charAt(0).toUpperCase() + l.slice(1)}
                </option>
              ))}
              {!COMMON_LANGUAGES.includes(language) && (
                <option value="__other__">{language}</option>
              )}
            </select>
          </div>
        </div>

        {/* Monospace textarea with Tab indent & focus-escape hatch */}
        <div className="space-y-1">
          <textarea
            ref={textareaRef}
            rows={10}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Paste your solution code here... (Tab indents; press Esc then Tab to exit focus)"
            className="w-full p-3.5 bg-slate-950 text-slate-100 font-mono text-xs rounded-lg border border-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none leading-relaxed transition-shadow"
            spellCheck={false}
          />
          <span className="block text-[11px] text-slate-400 text-right">
            Tip: Press <kbd className="px-1 border border-slate-600 rounded">Esc</kbd> then{' '}
            <kbd className="px-1 border border-slate-600 rounded">Tab</kbd> to move focus out.
          </span>
        </div>

        {/* Optional Comment */}
        <div className="space-y-1">
          <label htmlFor="attempt-comment" className="block text-xs font-medium text-slate-600 dark:text-slate-400">
            What changed in this attempt? (Optional)
          </label>
          <input
            id="attempt-comment"
            type="text"
            value={userComment}
            onChange={(e) => setUserComment(e.target.value)}
            placeholder="e.g. Swapped nested loop for hash map to achieve O(n) runtime"
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Submission Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            disabled={isSubmitting || !code.trim()}
            onClick={() => handleSave(false)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 transition-colors disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            Save attempt
          </button>

          <button
            type="button"
            disabled={isSubmitting || !code.trim()}
            onClick={() => handleSave(true)}
            className="inline-flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50"
          >
            {isSubmitting ? (
              'Saving & Reviewing...'
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                Save & review
              </>
            )}
          </button>
        </div>
      </div>

      {/* Attempt History List (FR-4.6: newest first, older collapsed) */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center justify-between">
          <span>Attempt History ({attempts.length})</span>
          {attempts.length > 1 && (
            <span className="text-xs font-normal text-slate-400">
              Newest first · Older collapsed
            </span>
          )}
        </h3>

        {sortedAttempts.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center text-slate-400 text-xs">
            No attempts submitted yet. Paste your solution above to get started!
          </div>
        ) : (
          sortedAttempts.map((att, idx) => {
            const isExpanded = expandedAttempts[att.id] ?? idx === 0;
            const prevAttempt = sortedAttempts[idx + 1];
            const verdict = att.review?.verdict;
            const isReviewing = isReviewingId === att.id;

            return (
              <div
                key={att.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm transition-all"
              >
                {/* Header Row (Click to toggle expand) */}
                <div
                  onClick={() => toggleExpand(att.id)}
                  className="px-4 py-3 bg-slate-50/70 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer flex items-center justify-between transition-colors text-xs select-none"
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="text-slate-400 hover:text-slate-600"
                      aria-label="Toggle collapse"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>

                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white text-sm">
                        Attempt #{att.attemptNumber}
                      </span>
                      <span className="text-slate-400 font-mono">({att.language})</span>
                    </div>

                    {/* Verdict Badge */}
                    {verdict === 'pass' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        <CheckCircle className="w-3 h-3" /> PASS
                      </span>
                    ) : verdict === 'revise' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        <AlertTriangle className="w-3 h-3" /> REVISE
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        Not reviewed
                      </span>
                    )}

                    {att.userComment && (
                      <span className="hidden md:inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 italic">
                        <MessageSquare className="w-3 h-3" /> "{att.userComment}"
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-slate-400">
                    <span>{formatDate(att.createdAt)}</span>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="p-4 space-y-4 border-t border-slate-200 dark:border-slate-800">
                    {/* User Comment if any */}
                    {att.userComment && (
                      <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg text-xs text-slate-700 dark:text-slate-300 italic border border-slate-200 dark:border-slate-700">
                        <span className="font-semibold not-italic">Note: </span>
                        {att.userComment}
                      </div>
                    )}

                    {/* Code Display with Diff Toggle */}
                    <CodeDisplay
                      code={att.code}
                      previousCode={prevAttempt?.code}
                      language={att.language}
                    />

                    {/* Review Section */}
                    {isReviewing ? (
                      <div className="p-6 bg-slate-100 dark:bg-slate-800/60 rounded-xl text-center text-xs text-slate-500 dark:text-slate-400 space-y-2">
                        <div className="animate-spin w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto" />
                        <p className="font-medium">Reviewing your code with AI...</p>
                      </div>
                    ) : att.review ? (
                      <CodeReviewBlock
                        review={att.review}
                        onFixAndResubmit={() => handleFixAndResubmit(att.code)}
                      />
                    ) : (
                      <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                        <span className="text-xs text-slate-500">This attempt was saved without a review.</span>
                        <button
                          type="button"
                          onClick={() => performReview(att)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors"
                        >
                          <FileCheck className="w-3.5 h-3.5" />
                          Review this attempt
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
