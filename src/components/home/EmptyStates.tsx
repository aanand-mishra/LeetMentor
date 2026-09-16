import React from 'react';
import { Link } from 'react-router-dom';
import { Plus, FilterX, BookOpen } from 'lucide-react';

interface NoProblemsProps {
  onSeedData: () => Promise<void>;
  isSeeding?: boolean;
}

export const ZeroProblemsEmptyState: React.FC<NoProblemsProps> = ({ onSeedData, isSeeding = false }) => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center max-w-lg mx-auto shadow-sm my-8">
      <h2 className="text-xl font-bold text-slate-900 dark:text-white">
        Start tracking your Leetcode practice
      </h2>
      <p className="text-sm text-slate-600 dark:text-slate-400 mt-2.5 leading-relaxed">
        Track your DSA progress locally, receive progressive non-spoiling hints, and master algorithms through iterative AI code reviews.
      </p>

      <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link
          to="/problem/new"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          Add your first problem
        </Link>

        <button
          type="button"
          onClick={onSeedData}
          disabled={isSeeding}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium rounded-lg text-sm transition-colors border border-slate-300 dark:border-slate-700 disabled:opacity-50"
        >
          <BookOpen className="w-4 h-4 text-indigo-500" />
          {isSeeding ? 'Loading sample data...' : 'Load sample problems'}
        </button>
      </div>
    </div>
  );
};

export const NoFilterMatchesEmptyState: React.FC<{ onClearFilters: () => void }> = ({
  onClearFilters,
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center max-w-md mx-auto shadow-sm my-8">
      <div className="w-12 h-12 mx-auto bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400 mb-3">
        <FilterX className="w-6 h-6" />
      </div>
      <h2 className="text-lg font-bold text-slate-900 dark:text-white">
        No problems match these filters
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
        Try adjusting your search terms or clearing some filters to view more problems.
      </p>

      <div className="mt-5">
        <button
          type="button"
          onClick={onClearFilters}
          className="px-4 py-2 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 text-sm font-medium rounded-lg transition-colors"
        >
          Clear filters
        </button>
      </div>
    </div>
  );
};
