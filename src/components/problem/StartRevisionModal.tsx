import React, { useState } from 'react';
import {
  RotateCcw,
  Archive,
  Sparkles,
  AlertCircle,
  Clock,
  Code2,
  Brain,
  FileText,
} from 'lucide-react';
import type { Problem, Attempt } from '../../types';
import { problemsRepo } from '../../db';
import { useToast } from '../../hooks/useToast';

interface Props {
  isOpen: boolean;
  problem: Problem;
  attempts: Attempt[];
  onClose: () => void;
  onRevisionStarted: () => void;
}

export const StartRevisionModal: React.FC<Props> = ({
  isOpen,
  problem,
  attempts,
  onClose,
  onRevisionStarted,
}) => {
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleStartFreshRevision = async () => {
    setSubmitting(true);
    try {
      const { revision } = await problemsRepo.startNewRevision(problem.id);
      toast.success(
        `Archived as Revision #${revision.revisionNumber}! Workspace reset for a fresh recall session. 🎉`
      );
      onRevisionStarted();
      onClose();
    } catch (err) {
      console.error('Failed to start fresh revision:', err);
      toast.error('Failed to start revision session');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Revise Now: Start Fresh Session
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Archive current work and test your pure recall from scratch
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Explainability / Value Prop */}
        <div className="p-3.5 bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 rounded-xl space-y-2 text-xs">
          <div className="flex items-center gap-2 text-indigo-800 dark:text-indigo-300 font-semibold">
            <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Intelligent Revision Record Keeping</span>
          </div>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            All your code attempts, mentor hints, time logs, confidence, and notes from this session
            will be safely preserved into a permanent <strong>Revision History Record</strong>.
          </p>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            Your active workspace will be initialized to a <strong>clean slate</strong> (0 attempts,
            hints re-locked to eliminate spoilers, timer reset) so you can genuinely re-solve and
            measure your mastery over time.
          </p>
        </div>

        {/* Snapshot Summary of Current State */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Session Snapshot to be Archived
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
              <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mb-1">
                <Code2 className="w-3.5 h-3.5" />
                <span>Attempts</span>
              </div>
              <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                {attempts.length} {attempts.length === 1 ? 'attempt' : 'attempts'}
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
              <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mb-1">
                <Brain className="w-3.5 h-3.5" />
                <span>Hints</span>
              </div>
              <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                {problem.hintsUsed ? `L${problem.hintsUsed}/4` : '0 (None)'}
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
              <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mb-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Time</span>
              </div>
              <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                {problem.timeSpentMinutes ? `${problem.timeSpentMinutes}m` : 'Unrecorded'}
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
              <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mb-1">
                <FileText className="w-3.5 h-3.5" />
                <span>Confidence</span>
              </div>
              <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                {problem.confidence ? `${problem.confidence}/5` : 'Unrated'}
              </div>
            </div>
          </div>
        </div>

        {/* Clean Slate Confirmation Alert */}
        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl text-xs text-amber-800 dark:text-amber-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Ready to test your recall? Once started, your active code workspace will be cleared and
            status changed to <strong>In Progress</strong>. You can view all archived sessions
            anytime in the <strong>Revisions</strong> tab.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleStartFreshRevision}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all disabled:opacity-50 cursor-pointer"
          >
            <Archive className="w-4 h-4" />
            <span>
              {submitting ? 'Archiving & Resetting...' : 'Archive & Start Fresh Revision'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
