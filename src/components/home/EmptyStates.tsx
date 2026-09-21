import React from 'react';
import { Link } from 'react-router-dom';
import { Plus, FilterX, Sparkles } from 'lucide-react';

export const ZeroProblemsEmptyState: React.FC = () => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-10 sm:p-14 text-center max-w-lg mx-auto shadow-xs my-8 transition-all">
      <div className="w-14 h-14 mx-auto bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-100 dark:border-indigo-900/60 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4 shadow-xs">
        <Sparkles className="w-7 h-7" />
      </div>
      <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
        Start tracking your Leetcode practice
      </h2>
      <p className="text-sm text-slate-600 dark:text-slate-400 mt-2.5 leading-relaxed">
        Track your DSA progress locally, receive progressive non-spoiling hints, and master
        algorithms through iterative AI code reviews.
      </p>

      <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link
          to="/problem/new"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-semibold rounded-xl shadow-xs transition-all text-sm"
        >
          <Plus className="w-4 h-4" />
          Add your first problem
        </Link>
      </div>
    </div>
  );
};

export const NoFilterMatchesEmptyState: React.FC<{ onClearFilters: () => void }> = ({
  onClearFilters,
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-10 sm:p-12 text-center max-w-md mx-auto shadow-xs my-8 transition-all">
      <div className="w-12 h-12 mx-auto bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400 dark:text-slate-500 mb-3.5 shadow-xs">
        <FilterX className="w-6 h-6" />
      </div>
      <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
        No problems match these filters
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
        Try adjusting your search terms or clearing some filters to view more problems.
      </p>

      <div className="mt-5">
        <button
          type="button"
          onClick={onClearFilters}
          className="px-4 py-2 bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 text-sm font-semibold rounded-xl transition-all cursor-pointer shadow-xs"
        >
          Clear filters
        </button>
      </div>
    </div>
  );
};
