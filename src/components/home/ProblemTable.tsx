import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import type { Problem } from '../../types';
import { DifficultyBadge, StatusBadge, UnassistedBadge } from '../common/Badges';
import { ConfidenceDots } from '../common/ConfidenceDots';

interface Props {
  problems: Problem[];
  attemptsCountMap: Record<string, number>;
  onToggleStar: (problemId: string, currentStarred: boolean, e: React.MouseEvent) => void;
  page: number;
  pageSize: number;
  onPageChange: (newPage: number) => void;
}

export const ProblemTable: React.FC<Props> = ({
  problems,
  attemptsCountMap,
  onToggleStar,
  page,
  pageSize,
  onPageChange,
}) => {
  const navigate = useNavigate();

  const totalProblems = problems.length;
  const totalPages = Math.ceil(totalProblems / pageSize) || 1;
  const startIndex = (page - 1) * pageSize;
  const paginatedProblems = problems.slice(startIndex, startIndex + pageSize);

  const formatActivityDate = (isoStr: string) => {
    try {
      return formatDistanceToNow(parseISO(isoStr), { addSuffix: true });
    } catch {
      return 'recently';
    }
  };

  return (
    <div className="space-y-4">
      {/* Desktop Table (>=1024px) */}
      <div className="hidden lg:block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <th className="w-10 px-3 py-3 text-center">★</th>
              <th className="w-16 px-3 py-3">#</th>
              <th className="px-4 py-3">Title</th>
              <th className="w-24 px-3 py-3">Difficulty</th>
              <th className="px-3 py-3">Topics</th>
              <th className="w-28 px-3 py-3">Status</th>
              <th className="w-28 px-3 py-3">Confidence</th>
              <th className="w-20 px-3 py-3 text-center">Attempts</th>
              <th className="w-32 px-3 py-3 text-right">Last Activity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {paginatedProblems.map((prob) => {
              const attemptsCount = attemptsCountMap[prob.id] ?? 0;
              const isUnassisted = prob.status === 'Solved' && prob.hintsUsed === 0;

              return (
                <tr
                  key={prob.id}
                  onClick={() => navigate(`/problem/${prob.id}`)}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group"
                >
                  {/* Star Toggle */}
                  <td
                    className="px-3 py-3 text-center"
                    onClick={(e) => onToggleStar(prob.id, prob.starred, e)}
                  >
                    <button
                      type="button"
                      aria-label={prob.starred ? 'Unstar problem' : 'Star problem'}
                      className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      <Star
                        className={`w-4 h-4 ${
                          prob.starred
                            ? 'text-amber-500 fill-amber-500'
                            : 'text-slate-300 dark:text-slate-600 hover:text-amber-400'
                        }`}
                      />
                    </button>
                  </td>

                  {/* Problem Number */}
                  <td className="px-3 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                    {prob.number ?? '—'}
                  </td>

                  {/* Title */}
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/problem/${prob.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline"
                      >
                        {prob.title}
                      </Link>
                      {isUnassisted && <UnassistedBadge />}
                    </div>
                  </td>

                  {/* Difficulty */}
                  <td className="px-3 py-3">
                    <DifficultyBadge difficulty={prob.difficulty} />
                  </td>

                  {/* Topics (max 3 shown, then +N) */}
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap items-center gap-1">
                      {(prob.topics || []).slice(0, 3).map((topic) => (
                        <span
                          key={topic}
                          className="px-2 py-0.5 text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded"
                        >
                          {topic}
                        </span>
                      ))}
                      {(prob.topics || []).length > 3 && (
                        <span
                          className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded"
                          title={(prob.topics || []).slice(3).join(', ')}
                        >
                          +{prob.topics.length - 3}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-3 py-3">
                    <StatusBadge
                      status={prob.status}
                      manuallyMarkedSolved={prob.manuallyMarkedSolved}
                    />
                  </td>

                  {/* Confidence */}
                  <td className="px-3 py-3">
                    <ConfidenceDots confidence={prob.confidence} />
                  </td>

                  {/* Attempts count */}
                  <td className="px-3 py-3 text-center font-mono text-xs text-slate-600 dark:text-slate-400">
                    {attemptsCount}
                  </td>

                  {/* Last Activity */}
                  <td className="px-3 py-3 text-right text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {formatActivityDate(prob.updatedAt || prob.dateAdded)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile / Tablet Cards (<1024px) */}
      <div className="lg:hidden space-y-3">
        {paginatedProblems.map((prob) => {
          const isUnassisted = prob.status === 'Solved' && prob.hintsUsed === 0;

          return (
            <div
              key={prob.id}
              onClick={() => navigate(`/problem/${prob.id}`)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-500">
                      {prob.number ? `#${prob.number}` : ''}
                    </span>
                    <h3 className="font-semibold text-slate-900 dark:text-white text-base">
                      {prob.title}
                    </h3>
                    {isUnassisted && <UnassistedBadge />}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => onToggleStar(prob.id, prob.starred, e)}
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                  aria-label={prob.starred ? 'Unstar problem' : 'Star problem'}
                >
                  <Star
                    className={`w-4 h-4 ${
                      prob.starred
                        ? 'text-amber-500 fill-amber-500'
                        : 'text-slate-300 dark:text-slate-600'
                    }`}
                  />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <DifficultyBadge difficulty={prob.difficulty} />
                <StatusBadge
                  status={prob.status}
                  manuallyMarkedSolved={prob.manuallyMarkedSolved}
                />
                <ConfidenceDots confidence={prob.confidence} />
              </div>

              {prob.topics && prob.topics.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {prob.topics.slice(0, 4).map((t) => (
                    <span
                      key={t}
                      className="px-2 py-0.5 text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded"
                    >
                      {t}
                    </span>
                  ))}
                  {prob.topics.length > 4 && (
                    <span className="px-1.5 py-0.5 text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded">
                      +{prob.topics.length - 4}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 px-1 text-sm text-slate-600 dark:text-slate-400">
          <div>
            Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
            <span className="font-medium">
              {Math.min(startIndex + pageSize, totalProblems)}
            </span>{' '}
            of <span className="font-medium">{totalProblems}</span> problems
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-3 py-1 text-xs font-semibold">
              Page {page} of {totalPages}
            </span>

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
