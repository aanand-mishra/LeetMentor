import React from 'react';
import type { Problem, Difficulty, Status } from '../../types';
import { CheckCircle2, Clock, CircleDot, Layers } from 'lucide-react';

interface Props {
  problems: Problem[];
  activeStatusFilter?: Status[];
  activeDifficultyFilter?: Difficulty[];
  onSelectStatus: (status: Status) => void;
  onSelectDifficulty: (difficulty: Difficulty) => void;
}

export const SummaryBar: React.FC<Props> = ({
  problems,
  activeStatusFilter = [],
  activeDifficultyFilter = [],
  onSelectStatus,
  onSelectDifficulty,
}) => {
  const total = problems.length;
  const solved = problems.filter((p) => p.status === 'Solved').length;
  const inProgress = problems.filter((p) => p.status === 'In Progress').length;
  const notStarted = problems.filter((p) => p.status === 'Not Started').length;

  const easySolved = problems.filter((p) => p.status === 'Solved' && p.difficulty === 'Easy').length;
  const mediumSolved = problems.filter((p) => p.status === 'Solved' && p.difficulty === 'Medium').length;
  const hardSolved = problems.filter((p) => p.status === 'Solved' && p.difficulty === 'Hard').length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
      {/* Total Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
          <span className="text-xs font-medium uppercase tracking-wider">Total</span>
          <Layers className="w-4 h-4 text-indigo-500" />
        </div>
        <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{total}</div>
      </div>

      {/* Solved Card */}
      <button
        type="button"
        onClick={() => onSelectStatus('Solved')}
        className={`text-left border rounded-lg p-3 shadow-sm transition-all flex flex-col justify-between ${
          activeStatusFilter.includes('Solved')
            ? 'bg-emerald-50 border-emerald-300 dark:bg-emerald-950/60 dark:border-emerald-700 ring-2 ring-emerald-500'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-800'
        }`}
      >
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
          <span className="text-xs font-medium uppercase tracking-wider">Solved</span>
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        </div>
        <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
          {solved}
        </div>
      </button>

      {/* In Progress Card */}
      <button
        type="button"
        onClick={() => onSelectStatus('In Progress')}
        className={`text-left border rounded-lg p-3 shadow-sm transition-all flex flex-col justify-between ${
          activeStatusFilter.includes('In Progress')
            ? 'bg-blue-50 border-blue-300 dark:bg-blue-950/60 dark:border-blue-700 ring-2 ring-blue-500'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-800'
        }`}
      >
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
          <span className="text-xs font-medium uppercase tracking-wider">In Progress</span>
          <Clock className="w-4 h-4 text-blue-500" />
        </div>
        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
          {inProgress}
        </div>
      </button>

      {/* Not Started Card */}
      <button
        type="button"
        onClick={() => onSelectStatus('Not Started')}
        className={`text-left border rounded-lg p-3 shadow-sm transition-all flex flex-col justify-between ${
          activeStatusFilter.includes('Not Started')
            ? 'bg-slate-100 border-slate-300 dark:bg-slate-800 dark:border-slate-600 ring-2 ring-slate-500'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
        }`}
      >
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
          <span className="text-xs font-medium uppercase tracking-wider">Not Started</span>
          <CircleDot className="w-4 h-4 text-slate-400" />
        </div>
        <div className="text-2xl font-bold text-slate-700 dark:text-slate-300 mt-1">
          {notStarted}
        </div>
      </button>

      {/* Easy Solved */}
      <button
        type="button"
        onClick={() => onSelectDifficulty('Easy')}
        className={`text-left border rounded-lg p-3 shadow-sm transition-all flex flex-col justify-between ${
          activeDifficultyFilter.includes('Easy')
            ? 'bg-emerald-50 border-emerald-300 dark:bg-emerald-950/60 dark:border-emerald-700 ring-2 ring-emerald-500'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-800'
        }`}
      >
        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
          Easy Solved
        </span>
        <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
          {easySolved}
        </div>
      </button>

      {/* Medium Solved */}
      <button
        type="button"
        onClick={() => onSelectDifficulty('Medium')}
        className={`text-left border rounded-lg p-3 shadow-sm transition-all flex flex-col justify-between ${
          activeDifficultyFilter.includes('Medium')
            ? 'bg-amber-50 border-amber-300 dark:bg-amber-950/60 dark:border-amber-700 ring-2 ring-amber-500'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-800'
        }`}
      >
        <span className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">
          Medium Solved
        </span>
        <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
          {mediumSolved}
        </div>
      </button>

      {/* Hard Solved */}
      <button
        type="button"
        onClick={() => onSelectDifficulty('Hard')}
        className={`text-left border rounded-lg p-3 shadow-sm transition-all flex flex-col justify-between ${
          activeDifficultyFilter.includes('Hard')
            ? 'bg-rose-50 border-rose-300 dark:bg-rose-950/60 dark:border-rose-700 ring-2 ring-rose-500'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-rose-300 dark:hover:border-rose-800'
        }`}
      >
        <span className="text-xs font-medium text-rose-600 dark:text-rose-400 uppercase tracking-wider">
          Hard Solved
        </span>
        <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
          {hardSolved}
        </div>
      </button>
    </div>
  );
};
