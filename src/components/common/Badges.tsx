import React from 'react';
import type { Difficulty, Status } from '../../types';

export const DifficultyBadge: React.FC<{ difficulty: Difficulty; size?: 'sm' | 'md' }> = ({
  difficulty,
  size = 'sm',
}) => {
  const styles: Record<Difficulty, string> = {
    Easy: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
    Medium:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
    Hard: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
  };

  const textSizes = size === 'md' ? 'text-xs px-2.5 py-1' : 'text-[11px] px-2 py-0.5';

  return (
    <span
      className={`inline-flex items-center font-medium rounded border ${styles[difficulty]} ${textSizes}`}
    >
      {difficulty}
    </span>
  );
};

export const StatusBadge: React.FC<{
  status: Status;
  manuallyMarkedSolved?: boolean;
  size?: 'sm' | 'md';
}> = ({ status, manuallyMarkedSolved = false, size = 'sm' }) => {
  const styles: Record<Status, string> = {
    'Not Started':
      'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    'In Progress':
      'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
    Solved:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
  };

  const textSizes = size === 'md' ? 'text-xs px-2.5 py-1' : 'text-[11px] px-2 py-0.5';

  return (
    <span
      className={`inline-flex items-center font-medium rounded border ${styles[status]} ${textSizes}`}
      title={
        manuallyMarkedSolved ? 'Manually marked as solved without passing AI review' : undefined
      }
    >
      {status}
      {status === 'Solved' && manuallyMarkedSolved && (
        <span
          className="ml-1 text-xs font-bold text-amber-600 dark:text-amber-400"
          title="Manually marked solved"
        >
          *
        </span>
      )}
    </span>
  );
};

export const UnassistedBadge: React.FC = () => {
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded"
      title="Solved with 0 hints used"
    >
      unassisted
    </span>
  );
};
