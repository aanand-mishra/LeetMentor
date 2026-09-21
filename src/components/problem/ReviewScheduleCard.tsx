import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Brain,
  Sparkles,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Trophy,
  HelpCircle,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { Problem, ReviewStage } from '../../types';
import {
  calculateNextReview,
  getProblemReviewStatus,
  CONFIDENCE_LABELS,
} from '../../utils/reviewScheduler';
import { problemsRepo } from '../../db';
import { useToast } from '../../hooks/useToast';

interface Props {
  problem: Problem;
  attemptsCount?: number;
  onProblemUpdated: () => void;
}

const STAGE_CONFIG: Record<
  ReviewStage,
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  learning: {
    label: 'Stage 1: Learning',
    color: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
    icon: Brain,
  },
  reviewing: {
    label: 'Stage 2: Reviewing',
    color: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
    icon: RotateCcw,
  },
  consolidated: {
    label: 'Stage 3: Consolidated',
    color: 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800',
    icon: Sparkles,
  },
  mastered: {
    label: 'Stage 4: Mastered',
    color: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
    icon: Trophy,
  },
};

export const ReviewScheduleCard: React.FC<Props> = ({
  problem,
  attemptsCount = 1,
  onProblemUpdated,
}) => {
  const toast = useToast();
  const [showFactors, setShowFactors] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reviewConfidence, setReviewConfidence] = useState<1 | 2 | 3 | 4 | 5>(
    problem.confidence || 4
  );
  const [reviewTimeMinutes, setReviewTimeMinutes] = useState<string>('');
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  if (problem.status !== 'Solved') return null;

  const status = getProblemReviewStatus(problem, attemptsCount);
  const scheduleDetails = calculateNextReview({
    difficulty: problem.difficulty,
    confidence: problem.confidence || 3,
    hintsUsed: problem.hintsUsed || 0,
    timeSpentMinutes: problem.timeSpentMinutes,
    attemptsCount,
    previousIntervalDays: problem.reviewIntervalDays,
    previousEaseFactor: problem.easeFactor,
    previousRepetitionCount: problem.repetitionCount,
    baseDate: problem.dateSolved || problem.updatedAt || problem.dateAdded,
  });

  const stage = problem.reviewStage || status.stage;
  const stageInfo = STAGE_CONFIG[stage];
  const StageIcon = stageInfo.icon;

  const formattedTargetDate = status.nextReviewDate
    ? (() => {
        try {
          return format(parseISO(status.nextReviewDate), 'MMM d, yyyy');
        } catch {
          return 'Scheduled';
        }
      })()
    : 'Not Scheduled';

  const handleCompleteReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const parsedTime = reviewTimeMinutes.trim() ? parseInt(reviewTimeMinutes.trim(), 10) : undefined;
      const additionalNotes = reviewNotes.trim()
        ? `${problem.notes ? `${problem.notes}\n\n` : ''}**[Revision ${format(new Date(), 'yyyy-MM-dd')} - ${reviewConfidence}/5 confidence]**\n${reviewNotes.trim()}`
        : undefined;

      await problemsRepo.completeReview(problem.id, {
        confidence: reviewConfidence,
        timeSpentMinutes: parsedTime && !isNaN(parsedTime) && parsedTime > 0 ? parsedTime : undefined,
        notes: additionalNotes,
      });

      toast.success(
        reviewConfidence >= 3
          ? 'Revision logged! Interval expanded for long-term retention.'
          : 'Revision logged. Concept flagged for rapid follow-up.'
      );
      setIsModalOpen(false);
      setReviewNotes('');
      setReviewTimeMinutes('');
      onProblemUpdated();
    } catch (err) {
      console.error('Failed to complete review:', err);
      toast.error('Failed to save review session');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Intelligent Spaced Repetition</span>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${stageInfo.color}`}
                >
                  <StageIcon className="w-3 h-3" />
                  {stageInfo.label}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                DSA-Adaptive Spaced Repetition (DSA-SRS) algorithm tailored for high cognitive retention
              </p>
            </div>
          </div>

          {/* Quick Action Button */}
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Complete Revision</span>
          </button>
        </div>

        {/* Status Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Due Status */}
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Review Status</span>
              {status.isOverdue ? (
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
              ) : (
                <Calendar className="w-3.5 h-3.5 text-indigo-500" />
              )}
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-block px-2 py-0.5 rounded text-xs font-bold border ${status.badgeClass}`}
              >
                {status.statusText}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Target: {formattedTargetDate}
            </p>
          </div>

          {/* Spaced Interval */}
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Current Gap</span>
              <Clock className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">
              {problem.reviewIntervalDays ?? status.intervalDays}
              <span className="text-xs font-normal text-slate-500 ml-1">days</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Min 2d avoids spam; max 35d
            </p>
          </div>

          {/* Repetition Count */}
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Repetitions</span>
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">
              #{problem.repetitionCount ?? 0}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {problem.lastReviewedAt
                ? `Last: ${format(parseISO(problem.lastReviewedAt), 'MMM d')}`
                : 'Initial solve round'}
            </p>
          </div>

          {/* Ease Factor / Memory Strength */}
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Ease Multiplier</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">
              {(problem.easeFactor ?? 2.2).toFixed(2)}x
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Adapts dynamically with recall
            </p>
          </div>
        </div>

        {/* Algorithm Explainability Dropdown */}
        <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
          <button
            type="button"
            onClick={() => setShowFactors(!showFactors)}
            className="flex items-center justify-between w-full text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>How was this interval calculated? View algorithmic factors</span>
            </span>
            {showFactors ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showFactors && (
            <div className="mt-3 p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-lg text-xs space-y-2 border border-slate-200/80 dark:border-slate-700/80">
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                Factor Breakdown & Adaptive Weights:
              </p>
              <ul className="space-y-1 text-slate-600 dark:text-slate-300">
                {scheduleDetails.factors.explanations.map((expl, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-indigo-500 font-bold">•</span>
                    <span>{expl}</span>
                  </li>
                ))}
              </ul>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-[11px]">
                💡 <strong>Philosophy:</strong> Revisions are scheduled with a minimum gap of 2 days to ensure true conceptual retrieval rather than surface syntax regurgitation, while allowing you to comfortably learn new problems.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Complete Revision Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <span>Log Revision Session</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Record how re-solving or reviewing {problem.title} went
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCompleteReview} className="space-y-4 text-xs">
              {/* Confidence Selection */}
              <div className="space-y-2">
                <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                  How confident do you feel after this revision?
                </label>
                <div className="grid grid-cols-1 gap-1.5">
                  {([1, 2, 3, 4, 5] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setReviewConfidence(r)}
                      className={`p-2 rounded-lg border text-left flex items-center justify-between transition-all ${
                        reviewConfidence === r
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 dark:border-indigo-500 ring-1 ring-indigo-500'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {CONFIDENCE_LABELS[r]}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {r >= 3 ? 'Expands interval' : 'Relapse check-in'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Revision Time */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                  Time spent on this revision (minutes, optional):
                </label>
                <input
                  type="number"
                  min="0"
                  max="300"
                  placeholder="e.g. 15"
                  value={reviewTimeMinutes}
                  onChange={(e) => setReviewTimeMinutes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              {/* Revision Notes */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                  Revision reflection / key insight (optional):
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Remembered the stack invariant immediately, clean code with 0 bugs."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save & Update Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
