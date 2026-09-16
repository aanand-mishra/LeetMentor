import React, { useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onSelectConfidence: (rating: 1 | 2 | 3 | 4 | 5) => Promise<void>;
  onSkip: () => void;
}

const CONFIDENCE_OPTIONS: Array<{
  rating: 1 | 2 | 3 | 4 | 5;
  title: string;
  description: string;
}> = [
  { rating: 1, title: 'Lost', description: 'I could not redo this' },
  { rating: 2, title: 'Shaky', description: "I'd need the hints again" },
  { rating: 3, title: 'Okay', description: "I'd struggle but get there" },
  { rating: 4, title: 'Solid', description: 'I could redo this comfortably' },
  { rating: 5, title: 'Fluent', description: 'I could teach this' },
];

export const ConfidenceRatingModal: React.FC<Props> = ({
  isOpen,
  onSelectConfidence,
  onSkip,
}) => {
  const [selectedRating, setSelectedRating] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (!selectedRating) return;
    setSaving(true);
    await onSelectConfidence(selectedRating);
    setSaving(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confidence-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 text-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <h2 id="confidence-modal-title" className="text-lg font-bold">
              Solved! Rate Your Confidence
            </h2>
          </div>
          <button
            onClick={onSkip}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            aria-label="Skip rating"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 mb-4 leading-relaxed">
          How confident do you feel solving this or a similar problem without hints? This drives your
          review queue.
        </p>

        <div className="space-y-2">
          {CONFIDENCE_OPTIONS.map((opt) => (
            <button
              key={opt.rating}
              type="button"
              onClick={() => setSelectedRating(opt.rating)}
              className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-center justify-between text-xs ${
                selectedRating === opt.rating
                  ? 'bg-indigo-50 border-indigo-400 dark:bg-indigo-950/60 dark:border-indigo-600 ring-2 ring-indigo-500'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 font-bold flex items-center justify-center text-slate-800 dark:text-slate-200">
                  {opt.rating}
                </span>
                <div>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {opt.title}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 ml-1.5">
                    — {opt.description}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-4 mt-4 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onSkip}
            className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          >
            Skip
          </button>
          <button
            type="button"
            disabled={!selectedRating || saving}
            onClick={handleConfirm}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Set Rating'}
          </button>
        </div>
      </div>
    </div>
  );
};
