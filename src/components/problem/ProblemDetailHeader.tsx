import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ExternalLink,
  Star,
  Edit2,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
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
      const latestAttempt = await attemptsRepo.getLatestForProblem(
        problem.id
      );

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
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Title & Metadata */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-sm font-semibold text-slate-500 dark:text-slate-400">
                {problem.number ? `#${problem.number}` : ''}
              </span>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {problem.title}
              </h1>

              {/* External Leetcode Link */}
              {problem.url && (
                <a
                  href={problem.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors p-1"
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
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label={problem.starred ? 'Unstar problem' : 'Star problem'}
              >
                <Star
                  className={`w-5 h-5 ${problem.starred
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
            <div className="flex items-center gap-1.5">
              <label htmlFor="detail-status" className="text-xs font-medium text-slate-500">
                Status:
              </label>
              <select
                id="detail-status"
                value={problem.status}
                onChange={(e) => handleStatusChange(e.target.value as Status)}
                className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="Not Started">Not Started</option>
                <option value="In Progress">In Progress</option>
                <option value="Solved">
                  Solved {problem.manuallyMarkedSolved ? '(*)' : ''}
                </option>
              </select>
            </div>

            {/* Confidence Controls */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-700">
              <span className="text-xs font-medium text-slate-500">Confidence:</span>
              <ConfidenceDots
                confidence={problem.confidence}
                interactive={true}
                onChange={handleConfidenceChange}
                size="md"
              />
            </div>

            {/* Edit & Delete Action Buttons */}
            <div className="flex items-center gap-1 pl-2 border-l border-slate-200 dark:border-slate-700">
              <Link
                to={`/problem/${problem.id}/edit`}
                className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Edit problem"
                aria-label="Edit problem"
              >
                <Edit2 className="w-4 h-4" />
              </Link>
              <button
                type="button"
                onClick={() => setIsDeleteDialogOpen(true)}
                className="p-2 text-rose-500 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
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
