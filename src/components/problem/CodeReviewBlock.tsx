import React from 'react';
import { MathText } from '../common/MarkdownRenderer';
import {
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  ThumbsUp,
  Clock,
  Database,
  Cpu,
} from 'lucide-react';
import type { CodeReview } from '../../types';

interface Props {
  review: CodeReview;
  onFixAndResubmit?: () => void;
}

export const CodeReviewBlock: React.FC<Props> = ({ review, onFixAndResubmit }) => {
  // Sort issues by severity: critical -> major -> minor (FR-4.4, Acceptance criteria)
  const severityWeight = { critical: 1, major: 2, minor: 3 };
  const sortedIssues = [...(review.issues || [])].sort(
    (a, b) => severityWeight[a.severity] - severityWeight[b.severity]
  );

  const isPass = review.verdict === 'pass';

  return (
    <div
      className={`rounded-xl border p-5 space-y-5 my-4 ${
        isPass
          ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/80'
          : 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/80'
      }`}
    >
      {/* Header Verdict & Summary */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span
            className={`px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded border ${
              isPass
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-amber-600 text-white border-amber-600'
            }`}
          >
            Verdict: {review.verdict}
          </span>
          <span className="text-xs text-slate-400 font-mono">Model: {review.model}</span>
        </div>

        <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
          <MathText content={review.summary} />
        </p>
      </div>

      {/* Correctness Line */}
      <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs space-y-1.5">
        <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
          {review.correctness.status === 'correct' ? (
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          )}
          <span>
            Correctness:{' '}
            <span
              className={
                review.correctness.status === 'correct'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              }
            >
              {review.correctness.status.replace(/_/g, ' ').toUpperCase()}
            </span>
          </span>
        </div>

        {review.correctness.failingCases && review.correctness.failingCases.length > 0 && (
          <div className="text-slate-600 dark:text-slate-400 pl-6 space-y-0.5">
            <span className="font-medium text-slate-500">Failing Cases:</span>
            <ul className="list-disc list-inside space-y-0.5 font-mono text-[11px]">
              {review.correctness.failingCases.map((fc, idx) => (
                <li key={idx}>{fc}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Complexity Table (Reported vs Optimal) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden text-xs">
        <div className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-500" />
            <span>Complexity Analysis</span>
          </div>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              review.complexity.isOptimal
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
            }`}
          >
            {review.complexity.isOptimal ? 'OPTIMAL' : 'SUB-OPTIMAL'}
          </span>
        </div>

        <div className="grid grid-cols-2 divide-x divide-slate-200 dark:divide-slate-800 p-3 text-center">
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1 text-slate-400 text-[11px]">
              <Clock className="w-3 h-3" /> Time Complexity
            </div>
            <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
              <MathText content={review.complexity.time} />
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              Optimal: <MathText content={review.complexity.optimalTime} />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1 text-slate-400 text-[11px]">
              <Database className="w-3 h-3" /> Space Complexity
            </div>
            <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
              <MathText content={review.complexity.space} />
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              Optimal: <MathText content={review.complexity.optimalSpace} />
            </div>
          </div>
        </div>
      </div>

      {/* Issues List sorted by severity (FR-4.4) */}
      {sortedIssues.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Issues Identified ({sortedIssues.length})
          </h4>

          <div className="space-y-2.5">
            {sortedIssues.map((issue, idx) => {
              const severityStyles = {
                critical:
                  'bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-200',
                major:
                  'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-900/60 dark:text-amber-200',
                minor:
                  'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/40 dark:border-blue-900/60 dark:text-blue-200',
              };

              return (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border text-xs space-y-1.5 ${severityStyles[issue.severity]}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm"><MathText content={issue.title} /></span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-current">
                      {issue.severity}
                    </span>
                  </div>

                  <p className="leading-relaxed opacity-95"><MathText content={issue.detail} /></p>

                  <div className="p-2 bg-white/70 dark:bg-black/30 rounded border border-current/20 font-medium">
                    <span className="font-bold">Suggestion: </span>
                    <MathText content={issue.suggestion} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Positives List */}
      {review.positives && review.positives.length > 0 && (
        <div className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
          <h4 className="font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 uppercase text-[11px] tracking-wider">
            <ThumbsUp className="w-3.5 h-3.5 text-emerald-500" /> Positives
          </h4>
          <ul className="list-disc list-inside space-y-1 pl-1 font-medium">
            {review.positives.map((pos, idx) => (
              <li key={idx}><MathText content={pos} /></li>
            ))}
          </ul>
        </div>
      )}

      {/* Next Step Call to Action */}
      <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start gap-2 text-xs">
          <ArrowRight className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-slate-900 dark:text-white">Next Step: </span>
            <span className="text-slate-600 dark:text-slate-300"><MathText content={review.nextStep} /></span>
          </div>
        </div>

        {/* Fix and Resubmit button if verdict is revise (FR-4.5) */}
        {!isPass && onFixAndResubmit && (
          <button
            type="button"
            onClick={onFixAndResubmit}
            className="shrink-0 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            Fix and resubmit
          </button>
        )}
      </div>
    </div>
  );
};
