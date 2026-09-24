import React, { useState } from 'react';
import {
  RotateCcw,
  Sparkles,
  TrendingDown,
  Brain,
  CheckCircle2,
  Clock,
  Code2,
  FileText,
  ChevronDown,
  ChevronUp,
  Trash2,
  Zap,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { Problem, RevisionRecord, Attempt } from '../../types';
import { revisionsRepo } from '../../db';
import { CodeDisplay } from './CodeDisplay';
import { CodeReviewBlock } from './CodeReviewBlock';
import { StartRevisionModal } from './StartRevisionModal';
import { useToast } from '../../hooks/useToast';

interface Props {
  problem: Problem;
  revisions: RevisionRecord[];
  activeAttempts: Attempt[];
  onProblemUpdated: () => void;
}

export const RevisionsTab: React.FC<Props> = ({
  problem,
  revisions,
  activeAttempts,
  onProblemUpdated,
}) => {
  const toast = useToast();
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [expandedRevId, setExpandedRevId] = useState<string | null>(
    revisions.length > 0 ? revisions[0].id : null
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Sort chronological for progression analysis (oldest first)
  const chronological = [...revisions].sort((a, b) => a.revisionNumber - b.revisionNumber);

  // Newest first for list display
  const newestFirst = [...revisions].sort((a, b) => b.revisionNumber - a.revisionNumber);

  // Compute analytics
  const firstRev = chronological[0];
  const latestRev = chronological[chronological.length - 1];

  // Time reduction analysis
  let timeDeltaPct: number | null = null;
  if (
    firstRev?.timeSpentMinutes &&
    latestRev?.timeSpentMinutes &&
    firstRev.timeSpentMinutes > 0 &&
    chronological.length >= 2
  ) {
    const diff = firstRev.timeSpentMinutes - latestRev.timeSpentMinutes;
    timeDeltaPct = Math.round((diff / firstRev.timeSpentMinutes) * 100);
  }

  // Hint independence improvement
  const initialHints = firstRev ? firstRev.hintsUsed : problem.hintsUsed;
  const latestHints = latestRev ? latestRev.hintsUsed : 0;
  const isNowUnassisted = latestRev ? latestRev.hintsUsed === 0 : false;

  // Attempt count progression
  const initialAttempts = firstRev ? firstRev.attemptsCount : activeAttempts.length;
  const latestAttempts = latestRev ? latestRev.attemptsCount : 0;

  // Confidence progression
  const initialConfidence = firstRev?.confidence ?? problem.confidence;
  const latestConfidence = latestRev?.confidence ?? problem.confidence;

  const handleDeleteRevision = async (revId: string, revNum: number) => {
    if (!window.confirm(`Are you sure you want to delete Revision #${revNum}?`)) {
      return;
    }
    try {
      setDeletingId(revId);
      await revisionsRepo.delete(revId);
      toast.success(`Deleted Revision #${revNum}`);
      onProblemUpdated();
    } catch (err) {
      console.error('Failed to delete revision:', err);
      toast.error('Failed to delete revision');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Analytics Summary Cards (when at least 1 revision exists) */}
      {revisions.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Speed / Time Reduction */}
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>Time to Solve</span>
              <Clock className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {latestRev?.timeSpentMinutes ? `${latestRev.timeSpentMinutes}m` : '--'}
              </span>
              {firstRev?.timeSpentMinutes && firstRev !== latestRev && (
                <span className="text-xs text-slate-500 line-through">
                  {firstRev.timeSpentMinutes}m
                </span>
              )}
            </div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {timeDeltaPct !== null ? (
                <span
                  className={
                    timeDeltaPct > 0
                      ? 'text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-bold'
                      : 'text-slate-500'
                  }
                >
                  {timeDeltaPct > 0 && <TrendingDown className="w-3.5 h-3.5" />}
                  {timeDeltaPct > 0 ? `${timeDeltaPct}% faster than Rev #1` : 'Similar solve time'}
                </span>
              ) : (
                <span>Recorded across revisions</span>
              )}
            </div>
          </div>

          {/* Hint Independence */}
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>Autonomy</span>
              <Brain className="w-4 h-4 text-amber-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {isNowUnassisted ? 'L0' : `L${latestHints}`}
              </span>
              <span className="text-xs font-semibold text-slate-500">
                {isNowUnassisted ? 'Unassisted' : `Hints Used`}
              </span>
            </div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {initialHints > 0 && isNowUnassisted ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Weaned off L{initialHints} hint!
                </span>
              ) : (
                <span>Initial: L{initialHints}/4 hints</span>
              )}
            </div>
          </div>

          {/* Attempt Accuracy */}
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>Attempts Needed</span>
              <Code2 className="w-4 h-4 text-blue-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {latestAttempts}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {latestAttempts === 1 ? '1st-try pass' : 'attempts'}
              </span>
            </div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {firstRev && firstRev !== latestRev ? (
                <span>Started at {initialAttempts} attempts</span>
              ) : (
                <span>Accuracy on recent solve</span>
              )}
            </div>
          </div>

          {/* Confidence Trajectory */}
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>Confidence</span>
              <Zap className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {latestConfidence ? `${latestConfidence}/5` : 'Unrated'}
              </span>
              {initialConfidence && initialConfidence !== latestConfidence && (
                <span className="text-xs text-slate-500 line-through">{initialConfidence}/5</span>
              )}
            </div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {latestConfidence && latestConfidence >= 4 ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                  Solid conceptual mastery
                </span>
              ) : (
                <span>Spaced review recommended</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Revisions List */}
      {revisions.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <RotateCcw className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              No Revisions Archived Yet
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Whenever you want to test your recall or revise this problem, click{' '}
              <strong>"Revise Now"</strong>. All your current code attempts, AI code reviews, hints,
              and notes will be permanently archived here for deep analytics, and your workspace
              will reset fresh so you can re-solve from memory without spoilers.
            </p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setIsStartModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Archive Current State & Start Revision</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
            Archived Revision Sessions ({revisions.length})
          </div>

          {newestFirst.map((rev) => {
            const isExpanded = expandedRevId === rev.id;
            let formattedDate = 'Archived Session';
            try {
              formattedDate = format(parseISO(rev.completedAt), 'MMM d, yyyy · h:mm a');
            } catch {
              // fallback
            }

            return (
              <div
                key={rev.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm transition-all"
              >
                {/* Revision Header Summary */}
                <div
                  onClick={() => setExpandedRevId(isExpanded ? null : rev.id)}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-800/40 select-none"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-sm shrink-0">
                      #{rev.revisionNumber}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white text-sm">
                          {rev.title || `Revision #${rev.revisionNumber}`}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border ${
                            rev.statusAtSnapshot === 'Solved'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                              : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                          }`}
                        >
                          {rev.statusAtSnapshot}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {formattedDate}
                      </p>
                    </div>
                  </div>

                  {/* Summary Metric Pills */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Time */}
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {rev.timeSpentMinutes ? `${rev.timeSpentMinutes} min` : 'No time'}
                    </span>

                    {/* Confidence */}
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                      {rev.confidence ? `${rev.confidence}/5` : 'Unrated'}
                    </span>

                    {/* Hints */}
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium ${
                        rev.hintsUsed === 0
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                          : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                      }`}
                    >
                      <Brain className="w-3.5 h-3.5" />
                      {rev.hintsUsed === 0 ? 'L0 Unassisted' : `L${rev.hintsUsed} Hint`}
                    </span>

                    {/* Attempts */}
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      <Code2 className="w-3.5 h-3.5 text-blue-500" />
                      {rev.attemptsCount} {rev.attemptsCount === 1 ? 'attempt' : 'attempts'}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteRevision(rev.id, rev.revisionNumber);
                      }}
                      disabled={deletingId === rev.id}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors ml-1"
                      title="Delete revision record"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <div className="p-1 text-slate-400">
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Details: Notes, Code Attempts, Hints */}
                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-slate-800 p-5 space-y-6 bg-slate-50/40 dark:bg-slate-900/40">
                    {/* Notes recorded */}
                    {rev.notes ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                          <FileText className="w-3.5 h-3.5 text-purple-500" />
                          <span>Notes Recorded During This Revision</span>
                        </div>
                        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                          {rev.notes}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 italic">
                        No notes recorded in this revision.
                      </div>
                    )}

                    {/* Attempts in this revision */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                          <Code2 className="w-3.5 h-3.5 text-blue-500" />
                          <span>Archived Code Attempts ({rev.attempts?.length || 0})</span>
                        </span>
                      </div>

                      {rev.attempts && rev.attempts.length > 0 ? (
                        <div className="space-y-4">
                          {rev.attempts.map((att) => (
                            <div
                              key={att.id}
                              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm space-y-3"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                    Attempt #{att.attemptNumber}
                                  </span>
                                  <span className="text-xs font-mono text-slate-500">
                                    {att.language}
                                  </span>
                                  {att.userComment && (
                                    <span className="text-xs text-slate-500 italic">
                                      "{att.userComment}"
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-slate-400">
                                  {format(parseISO(att.createdAt), 'h:mm a')}
                                </span>
                              </div>

                              <CodeDisplay code={att.code} language={att.language} />

                              {att.review && <CodeReviewBlock review={att.review} />}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 italic p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
                          No code attempts were recorded for this session.
                        </div>
                      )}
                    </div>

                    {/* Mentor hints unlocked */}
                    {rev.mentorMessages && rev.mentorMessages.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                          <Brain className="w-3.5 h-3.5 text-amber-500" />
                          <span>Hints Unlocked During This Revision</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {rev.mentorMessages.map((msg) => (
                            <div
                              key={msg.id}
                              className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs space-y-1"
                            >
                              <div className="font-semibold text-amber-600 dark:text-amber-400 flex items-center justify-between">
                                <span>Level {msg.level} Hint</span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {msg.model}
                                </span>
                              </div>
                              <p className="text-slate-600 dark:text-slate-300 line-clamp-3">
                                {msg.content}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Start Fresh Revision Modal */}
      <StartRevisionModal
        isOpen={isStartModalOpen}
        problem={problem}
        attempts={activeAttempts}
        onClose={() => setIsStartModalOpen(false)}
        onRevisionStarted={() => {
          onProblemUpdated();
          setExpandedRevId(null);
        }}
      />
    </div>
  );
};
