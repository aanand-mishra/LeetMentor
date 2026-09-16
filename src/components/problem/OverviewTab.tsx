import React, { useState } from 'react';
import { MarkdownRenderer } from '../common/MarkdownRenderer';
import { ChevronDown, ChevronUp, Clock, Calendar, CheckCircle, Code, Lightbulb, BookOpen } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { Problem, Attempt, MentorMessage, NoteReview } from '../../types';
import { problemsRepo } from '../../db';
import { useToast } from '../../hooks/useToast';

interface Props {
  problem: Problem;
  attempts: Attempt[];
  mentorMessages: MentorMessage[];
  noteReviews: NoteReview[];
  onProblemUpdated: () => void;
}

export const OverviewTab: React.FC<Props> = ({
  problem,
  attempts,
  mentorMessages,
  noteReviews,
  onProblemUpdated,
}) => {
  const toast = useToast();
  const [statementExpanded, setStatementExpanded] = useState(false);
  const [userTimeComplexity, setUserTimeComplexity] = useState(problem.userTimeComplexity || '');
  const [userSpaceComplexity, setUserSpaceComplexity] = useState(problem.userSpaceComplexity || '');
  const [isEditingComplexity, setIsEditingComplexity] = useState(false);

  const handleSaveComplexity = async () => {
    try {
      await problemsRepo.update(problem.id, {
        userTimeComplexity: userTimeComplexity.trim() || null,
        userSpaceComplexity: userSpaceComplexity.trim() || null,
      });
      setIsEditingComplexity(false);
      onProblemUpdated();
      toast.success('Updated complexity claims');
    } catch (err) {
      console.error('Failed to save complexity:', err);
      toast.error('Failed to save complexity');
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try {
      return format(parseISO(dateStr), 'MMM d, yyyy h:mm a');
    } catch {
      return dateStr;
    }
  };

  // Build unified chronological activity timeline
  const timelineEvents = [
    ...attempts.map((a) => ({
      id: a.id,
      date: a.createdAt,
      type: 'attempt' as const,
      title: `Attempt #${a.attemptNumber} (${a.language})`,
      description: a.review
        ? `Reviewed: ${a.review.verdict.toUpperCase()} — ${a.review.summary}`
        : 'Saved attempt (unreviewed)',
      icon: Code,
      color: a.review?.verdict === 'pass' ? 'text-emerald-500' : 'text-blue-500',
    })),
    ...mentorMessages.map((m) => ({
      id: m.id,
      date: m.createdAt,
      type: 'mentor' as const,
      title: `Mentor Hint Unlocked: Level ${m.level}`,
      description: m.content.slice(0, 100) + '...',
      icon: Lightbulb,
      color: 'text-amber-500',
    })),
    ...noteReviews.map((nr) => ({
      id: nr.id,
      date: nr.createdAt,
      type: 'noteReview' as const,
      title: `Notes Reviewed: ${nr.rating}/5 stars (${nr.verdict})`,
      description: nr.keyTakeaway,
      icon: BookOpen,
      color: 'text-purple-500',
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left 2 Cols: Statement & Tags */}
      <div className="lg:col-span-2 space-y-6">
        {/* Problem Statement Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Problem Statement</h2>
            {problem.statement && problem.statement.length > 280 && (
              <button
                type="button"
                onClick={() => setStatementExpanded((prev) => !prev)}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                {statementExpanded ? (
                  <>
                    Show less <ChevronUp className="w-3.5 h-3.5" />
                  </>
                ) : (
                  <>
                    Show all <ChevronDown className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            )}
          </div>

          {problem.statement ? (
            <div
              className={`prose prose-sm dark:prose-invert max-w-none transition-all leading-relaxed ${
                !statementExpanded && problem.statement.length > 280
                  ? 'max-h-48 overflow-hidden relative'
                  : ''
              }`}
            >
              <MarkdownRenderer content={problem.statement} />
              {!statementExpanded && problem.statement.length > 280 && (
                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white dark:from-slate-900 pointer-events-none" />
              )}
            </div>
          ) : (
            <div className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
              No problem statement provided yet.{' '}
              <a href={`/problem/${problem.id}/edit`} className="text-indigo-600 dark:text-indigo-400 underline">
                Add it to improve mentor quality →
              </a>
            </div>
          )}
        </div>

        {/* Topics & Patterns */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Topics</h3>
            <div className="flex flex-wrap gap-1.5">
              {problem.topics && problem.topics.length > 0 ? (
                problem.topics.map((t) => (
                  <span
                    key={t}
                    className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700"
                  >
                    {t}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-400 italic">No topics assigned</span>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Patterns</h3>
            <div className="flex flex-wrap gap-1.5">
              {problem.patterns && problem.patterns.length > 0 ? (
                problem.patterns.map((p) => (
                  <span
                    key={p}
                    className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-medium rounded-lg border border-indigo-200 dark:border-indigo-800"
                  >
                    {p}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-400 italic">No patterns assigned</span>
              )}
            </div>
          </div>
        </div>

        {/* User Complexity Claims */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Your Complexity Claims</h3>
            {!isEditingComplexity ? (
              <button
                type="button"
                onClick={() => setIsEditingComplexity(true)}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Edit claims
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingComplexity(false)}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveComplexity}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Save
                </button>
              </div>
            )}
          </div>

          {isEditingComplexity ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Time Complexity</label>
                <input
                  type="text"
                  value={userTimeComplexity}
                  onChange={(e) => setUserTimeComplexity(e.target.value)}
                  placeholder="e.g. O(n log n)"
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-xs outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Space Complexity</label>
                <input
                  type="text"
                  value={userSpaceComplexity}
                  onChange={(e) => setUserSpaceComplexity(e.target.value)}
                  placeholder="e.g. O(1)"
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-xs outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="block text-[11px] text-slate-400 mb-0.5">Time:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {problem.userTimeComplexity || 'Not specified'}
                </span>
              </div>
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="block text-[11px] text-slate-400 mb-0.5">Space:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {problem.userSpaceComplexity || 'Not specified'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Key Dates & Activity Timeline */}
      <div className="space-y-6">
        {/* Key Dates & Time Spent */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Session Information</h3>

          <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="flex items-center gap-1.5 text-slate-500">
                <Clock className="w-3.5 h-3.5" /> Time Spent:
              </span>
              <span className="font-semibold">
                {problem.timeSpentMinutes ? `${problem.timeSpentMinutes} mins` : '—'}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="flex items-center gap-1.5 text-slate-500">
                <Calendar className="w-3.5 h-3.5" /> Date Added:
              </span>
              <span>{formatDate(problem.dateAdded)}</span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="flex items-center gap-1.5 text-slate-500">
                <Calendar className="w-3.5 h-3.5" /> First Attempt:
              </span>
              <span>{formatDate(problem.dateFirstAttempt)}</span>
            </div>

            <div className="flex items-center justify-between py-1">
              <span className="flex items-center gap-1.5 text-slate-500">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Date Solved:
              </span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {formatDate(problem.dateSolved)}
              </span>
            </div>
          </div>
        </div>

        {/* Mini Activity Timeline */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Activity Timeline</h3>

          {timelineEvents.length === 0 ? (
            <p className="text-xs text-slate-400 py-3 text-center">No activity recorded yet.</p>
          ) : (
            <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
              {timelineEvents.slice(0, 8).map((evt) => {
                const IconComponent = evt.icon;
                return (
                  <div key={evt.id} className="relative group">
                    <div
                      className={`absolute -left-6 top-0.5 w-4 h-4 rounded-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 flex items-center justify-center ${evt.color}`}
                    >
                      <IconComponent className="w-2.5 h-2.5" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {evt.title}
                      </div>
                      <div className="text-[11px] text-slate-400">{formatDate(evt.date)}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                        {evt.description}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
