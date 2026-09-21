import React from 'react';
import type { Problem, Difficulty, Status } from '../../types';
import { CheckCircle2, Clock, CircleDot, Layers, TrendingUp } from 'lucide-react';

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

  const completionPct = total > 0 ? Math.round((solved / total) * 100) : 0;

  return (
    <div className="mb-6 space-y-2.5">
      {/* Overall completion mini banner */}
      <div className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-xl px-4 py-2.5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs backdrop-blur-xs">
        <div className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300">
          <TrendingUp className="w-4 h-4 text-emerald-500" />
          <span>
            Mastery Progress:{' '}
            <strong className="font-bold text-slate-900 dark:text-white">{solved}</strong> of{' '}
            <strong className="font-bold text-slate-900 dark:text-white">{total}</strong> solved (
            {completionPct}%)
          </span>
        </div>
        <div className="w-full sm:w-64 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-emerald-500 transition-all duration-500 rounded-full"
            style={{ width: `${completionPct}%` }}
            title={`${completionPct}% complete`}
          />
        </div>
      </div>

      {/* Grid of 7 interactive metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
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

        {/* Solved Card */}
        <button
          type="button"
          onClick={() => onSelectStatus('Solved')}
          className={`text-left border rounded-xl p-3 shadow-xs transition-all flex flex-col justify-between cursor-pointer ${
            activeStatusFilter.includes('Solved')
              ? 'bg-emerald-50 border-emerald-400 dark:bg-emerald-950/70 dark:border-emerald-600 ring-2 ring-emerald-500/50'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-800'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Solved</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1.5 tracking-tight">
            {solved}
          </div>
        </button>

        {/* In Progress Card */}
        <button
          type="button"
          onClick={() => onSelectStatus('In Progress')}
          className={`text-left border rounded-xl p-3 shadow-xs transition-all flex flex-col justify-between cursor-pointer ${
            activeStatusFilter.includes('In Progress')
              ? 'bg-blue-50 border-blue-400 dark:bg-blue-950/70 dark:border-blue-600 ring-2 ring-blue-500/50'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-800'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">In Progress</span>
            <Clock className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-1.5 tracking-tight">
            {inProgress}
          </div>
        </button>

        {/* Not Started Card */}
        <button
          type="button"
          onClick={() => onSelectStatus('Not Started')}
          className={`text-left border rounded-xl p-3 shadow-xs transition-all flex flex-col justify-between cursor-pointer ${
            activeStatusFilter.includes('Not Started')
              ? 'bg-slate-100 border-slate-400 dark:bg-slate-800 dark:border-slate-500 ring-2 ring-slate-400/50'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Not Started</span>
            <CircleDot className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-700 dark:text-slate-300 mt-1.5 tracking-tight">
            {notStarted}
          </div>
        </button>

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
