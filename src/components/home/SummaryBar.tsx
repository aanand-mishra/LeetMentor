import React from 'react';
import type { Problem, Difficulty } from '../../types';
import { Layers } from 'lucide-react';

interface Props {
  problems: Problem[];
  activeDifficultyFilter?: Difficulty[];
  onSelectDifficulty: (difficulty: Difficulty) => void;
}

export const SummaryBar: React.FC<Props> = ({
  problems,
  activeDifficultyFilter = [],
  onSelectDifficulty,
}) => {
  const total = problems.length;

  const easyTotal = problems.filter((p) => p.difficulty === 'Easy').length;
  const mediumTotal = problems.filter((p) => p.difficulty === 'Medium').length;
  const hardTotal = problems.filter((p) => p.difficulty === 'Hard').length;

  const easySolved = problems.filter(
    (p) => p.status === 'Solved' && p.difficulty === 'Easy'
  ).length;
  const mediumSolved = problems.filter(
    (p) => p.status === 'Solved' && p.difficulty === 'Medium'
  ).length;
  const hardSolved = problems.filter(
    (p) => p.status === 'Solved' && p.difficulty === 'Hard'
  ).length;

  return (
    <div className="mb-6">
      {/* Grid of 4 metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Total Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total</span>
            <Layers className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1.5 tracking-tight">
            {total}
          </div>
        </div>

        {/* Easy Solved */}
        <button
          type="button"
          onClick={() => onSelectDifficulty('Easy')}
          className={`text-left border rounded-xl p-3 shadow-xs transition-all flex flex-col justify-between cursor-pointer ${
            activeDifficultyFilter.includes('Easy')
              ? 'bg-emerald-50 border-emerald-400 dark:bg-emerald-950/70 dark:border-emerald-600 ring-2 ring-emerald-500/50'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Easy Solved
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <div className="flex items-baseline justify-between mt-1.5">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {easySolved}
            </span>
            {easyTotal > 0 && (
              <span className="text-[11px] font-mono text-slate-400">/{easyTotal}</span>
            )}
          </div>
        </button>

        {/* Medium Solved */}
        <button
          type="button"
          onClick={() => onSelectDifficulty('Medium')}
          className={`text-left border rounded-xl p-3 shadow-xs transition-all flex flex-col justify-between cursor-pointer ${
            activeDifficultyFilter.includes('Medium')
              ? 'bg-amber-50 border-amber-400 dark:bg-amber-950/70 dark:border-amber-600 ring-2 ring-amber-500/50'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              Medium Solved
            </span>
            <span className="w-2 h-2 rounded-full bg-amber-500" />
          </div>
          <div className="flex items-baseline justify-between mt-1.5">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {mediumSolved}
            </span>
            {mediumTotal > 0 && (
              <span className="text-[11px] font-mono text-slate-400">/{mediumTotal}</span>
            )}
          </div>
        </button>

        {/* Hard Solved */}
        <button
          type="button"
          onClick={() => onSelectDifficulty('Hard')}
          className={`text-left border rounded-xl p-3 shadow-xs transition-all flex flex-col justify-between cursor-pointer ${
            activeDifficultyFilter.includes('Hard')
              ? 'bg-rose-50 border-rose-400 dark:bg-rose-950/70 dark:border-rose-600 ring-2 ring-rose-500/50'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-rose-300 dark:hover:border-rose-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
              Hard Solved
            </span>
            <span className="w-2 h-2 rounded-full bg-rose-500" />
          </div>
          <div className="flex items-baseline justify-between mt-1.5">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {hardSolved}
            </span>
            {hardTotal > 0 && (
              <span className="text-[11px] font-mono text-slate-400">/{hardTotal}</span>
            )}
          </div>
        </button>
      </div>
    </div>
  );
};
