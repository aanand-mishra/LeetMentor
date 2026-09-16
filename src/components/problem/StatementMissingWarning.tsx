import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';

interface Props {
  problemId: string;
}

export const StatementMissingWarning: React.FC<Props> = ({ problemId }) => {
  return (
    <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-lg flex items-center justify-between gap-3 text-xs text-amber-800 dark:text-amber-200 mb-4">
      <div className="flex items-center gap-2">
        <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <span>Mentor accuracy is limited without the problem statement.</span>
      </div>
      <Link
        to={`/problem/${problemId}/edit`}
        className="font-semibold text-amber-900 dark:text-amber-100 underline hover:text-amber-700 whitespace-nowrap"
      >
        Add it →
      </Link>
    </div>
  );
};
