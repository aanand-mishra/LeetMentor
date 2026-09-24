import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ExternalLink, Star, Edit2, Trash2, AlertTriangle } from 'lucide-react';
import type { Problem, Status } from '../../types';
import { DifficultyBadge } from '../common/Badges';
import { ConfidenceDots } from '../common/ConfidenceDots';
import { DeleteProblemDialog } from './DeleteProblemDialog';
import { problemsRepo, attemptsRepo } from '../../db';
import { useToast } from '../../hooks/useToast';

interface Props {
  problem: Problem;
  onProblemUpdated: () => void;
  onOpenConfidenceModal?: () => void;
}

export const ProblemDetailHeader: React.FC<Props> = ({
  problem,
  onProblemUpdated,
  onOpenConfidenceModal,
}) => {
  const navigate = useNavigate();
  const toast = useToast();

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showManualSolvedConfirm, setShowManualSolvedConfirm] = useState(false);

  // Time Spent quick-edit input
  const timeSpentDisplay =
    problem.timeSpentMinutes !== null && problem.timeSpentMinutes !== undefined
      ? String(problem.timeSpentMinutes)
      : '';
  const [timeSpentInput, setTimeSpentInput] = useState<string>(timeSpentDisplay);

  // Keep input in sync when the problem refreshes
  useEffect(() => {
    setTimeSpentInput(timeSpentDisplay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problem.id, problem.timeSpentMinutes]);

  const commitTimeSpent = async () => {
    const trimmed = timeSpentInput.trim();
    if (trimmed === timeSpentDisplay) return;

    let newTime: number | null = null;
    if (trimmed) {
      const parsed = parseInt(trimmed, 10);
      if (isNaN(parsed) || parsed < 0) {
        toast.error('Please enter a valid positive number for minutes.');
        setTimeSpentInput(timeSpentDisplay);
        return;
      }
      newTime = parsed;
    }

    try {
      await problemsRepo.update(problem.id, { timeSpentMinutes: newTime });
      toast.success(
        newTime !== null ? `Time spent updated to ${newTime} mins` : 'Time spent cleared'
      );
      onProblemUpdated();
    } catch (err) {
      console.error('Failed to update time spent:', err);
      toast.error('Failed to update time spent');
    }
  };

  // Toggle Star
  const handleToggleStar = async () => {
    try {
      await problemsRepo.update(problem.id, { starred: !problem.starred });
      onProblemUpdated();
    } catch (err) {
      console.error('Failed to toggle star:', err);
    }
  };

  // Update Confidence
  const handleConfidenceChange = async (conf: 1 | 2 | 3 | 4 | 5) => {
    try {
      await problemsRepo.update(problem.id, { confidence: conf });
      onProblemUpdated();
      toast.success(`Updated confidence to ${conf}/5`);
    } catch (err) {
      console.error('Failed to update confidence:', err);
    }
  };

  // Handle Status change (FR-7.2)
  const handleStatusChange = async (newStatus: Status) => {
    if (newStatus === problem.status) return;

    if (newStatus === 'Solved') {
      // Check if latest attempt has pass verdict
      const latestAttempt = await attemptsRepo.getLatestForProblem(problem.id);

      const hasPassingReview = latestAttempt?.review?.verdict === 'pass';

      if (!hasPassingReview) {
        // Show manual override confirmation modal (FR-7.2)
        setShowManualSolvedConfirm(true);
        return;
      }

      // Mark solved cleanly
      await applySolvedTransition(false);
    } else {
      // Reverting or switching status (FR-7.2)
      // Reverting from Solved clears dateSolved but retains confidence
      const updates: Partial<Problem> = {
        status: newStatus,
        manuallyMarkedSolved: false,
      };
      if (problem.status === 'Solved') {
        updates.dateSolved = null;
      }
      await problemsRepo.update(problem.id, updates);
      onProblemUpdated();
      toast.success(`Status changed to ${newStatus}`);
    }
  };

  const applySolvedTransition = async (manualOverride: boolean) => {
    const now = new Date().toISOString();
    await problemsRepo.update(problem.id, {
      status: 'Solved',
      dateSolved: now,
      manuallyMarkedSolved: manualOverride,
    });
    onProblemUpdated();
    toast.success('Marked as Solved! 🎉');

    // Prompt for solved completion modal (time spent + confidence)
    if (onOpenConfidenceModal) {
      onOpenConfidenceModal();
    }
  };

  // Delete problem with cascade (FR-1.5)
  const handleDeleteConfirm = async () => {
    try {
      setIsDeleting(true);
      await problemsRepo.delete(problem.id);
      toast.success(`Deleted problem "${problem.title}"`);
      navigate('/');
    } catch (err) {
      console.error('Failed to delete problem:', err);
      toast.error('Failed to delete problem');
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4 mb-6 transition-all">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Title & Metadata */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              {problem.number && (
                <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-mono text-xs font-bold text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
                  #{problem.number}
                </span>
              )}
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {problem.title}
              </h1>

              {/* External Leetcode Link */}
              {problem.url && (
                <a
                  href={problem.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  title="Open on Leetcode (opens in new tab)"
                  aria-label="Open on Leetcode"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}

              <DifficultyBadge difficulty={problem.difficulty} size="md" />

              {/* Star toggle */}
              <button
                type="button"
                onClick={handleToggleStar}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label={problem.starred ? 'Unstar problem' : 'Star problem'}
              >
                <Star
                  className={`w-5 h-5 transition-transform hover:scale-110 ${
                    problem.starred
                      ? 'text-amber-500 fill-amber-500'
                      : 'text-slate-300 dark:text-slate-600 hover:text-amber-400'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Actions & Status Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Status Selector */}
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/70 p-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700">
              <label
                htmlFor="detail-status"
                className="text-xs font-bold uppercase tracking-wider text-slate-400 pl-1"
              >
                Status:
              </label>
              <select
                id="detail-status"
                value={problem.status}
                onChange={(e) => handleStatusChange(e.target.value as Status)}
                className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer shadow-xs"
              >
                <option value="Not Started">Not Started</option>
                <option value="In Progress">In Progress</option>
                <option value="Solved">Solved {problem.manuallyMarkedSolved ? '(*)' : ''}</option>
              </select>
            </div>

            {/* Time Spent Input */}
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/70 p-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700">
              <label
                htmlFor="detail-time-spent"
                className="text-xs font-bold uppercase tracking-wider text-slate-400 pl-1"
              >
                Time:
              </label>
              <input
                id="detail-time-spent"
                type="number"
                min="0"
                value={timeSpentInput}
                onChange={(e) => setTimeSpentInput(e.target.value)}
                onBlur={commitTimeSpent}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    (e.target as HTMLInputElement).blur();
                  }
                  if (e.key === 'Escape') {
                    setTimeSpentInput(timeSpentDisplay);
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                placeholder="0"
                aria-label="Time spent in minutes"
                className="w-14 px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none shadow-xs"
              />
              <span className="text-xs font-medium text-slate-400 pr-1">mins</span>
            </div>

            {/* Confidence Controls */}
            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200/80 dark:border-slate-700">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Confidence:
              </span>
              <ConfidenceDots
                confidence={problem.confidence}
                interactive={true}
                onChange={handleConfidenceChange}
                size="md"
              />
            </div>

            {/* Edit & Delete Action Buttons */}
            <div className="flex items-center gap-1 pl-1">
              <Link
                to={`/problem/${problem.id}/edit`}
                className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                title="Edit problem"
                aria-label="Edit problem"
              >
                <Edit2 className="w-4 h-4" />
              </Link>
              <button
                type="button"
                onClick={() => setIsDeleteDialogOpen(true)}
                className="p-2 text-rose-500 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                title="Delete problem"
                aria-label="Delete problem"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Manual Mark Solved Confirmation Modal (FR-7.2) */}
      {showManualSolvedConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 text-slate-900 dark:text-slate-100">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-3">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-base">Mark problem as Solved?</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
              No passing review yet. Mark solved anyway?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowManualSolvedConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowManualSolvedConfirm(false);
                  await applySolvedTransition(true);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
              >
                Mark Solved Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cascading Deletion Confirmation Dialog (FR-1.5) */}
      <DeleteProblemDialog
        isOpen={isDeleteDialogOpen}
        problemTitle={problem.title}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
      />
    </>
  );
};
