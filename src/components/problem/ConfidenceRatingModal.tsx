import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Clock, X, ArrowRight, ArrowLeft } from 'lucide-react';

interface Props {
  isOpen: boolean;
  initialTimeSpent?: number | null;
  onSaveTimeSpent?: (minutes: number) => Promise<void>;
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

const PRESET_MINUTES = [15, 30, 45, 60];

export const ConfidenceRatingModal: React.FC<Props> = ({
  isOpen,
  initialTimeSpent,
  onSaveTimeSpent,
  onSelectConfidence,
  onSkip,
}) => {
  const [step, setStep] = useState<'time' | 'confidence'>('time');
  const [timeSpent, setTimeSpent] = useState<string>('');
  const [selectedRating, setSelectedRating] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [saving, setSaving] = useState(false);
  const prevIsOpenRef = useRef(false);

  useEffect(() => {
    // Only reset to Step 1 and initialize when the modal is freshly opened
    if (isOpen && !prevIsOpenRef.current) {
      setStep('time');
      setTimeSpent(initialTimeSpent ? String(initialTimeSpent) : '');
      setSelectedRating(null);
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, initialTimeSpent]);

  if (!isOpen) return null;

  const handleNextFromTime = async () => {
    const trimmed = timeSpent.trim();
    if (trimmed && onSaveTimeSpent) {
      const parsed = parseInt(trimmed, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        setSaving(true);
        try {
          await onSaveTimeSpent(parsed);
        } catch (err) {
          console.error('Failed to save time spent:', err);
        } finally {
          setSaving(false);
        }
      }
    }
    setStep('confidence');
  };

  const handleConfirmConfidence = async () => {
    if (!selectedRating) return;
    setSaving(true);
    try {
      await onSelectConfidence(selectedRating);
    } finally {
      setSaving(false);
    }
  };

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="solved-modal-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md w-screen h-screen overflow-y-auto"
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 text-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Step Indicator */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            {step === 'time' ? (
              <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" />
              </div>
            ) : (
              <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            )}
            <div>
              <h2 id="solved-modal-title" className="text-base font-bold">
                {step === 'time' ? 'Solved! How long did it take?' : 'Solved! Rate Your Confidence'}
              </h2>
              <span className="text-[11px] text-slate-400 font-medium">
                Step {step === 'time' ? '1 of 2: Time Spent' : '2 of 2: Confidence'}
              </span>
            </div>
          </div>
          <button
            onClick={onSkip}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === 'time' ? (
          /* STEP 1: TIME SPENT */
          <div className="mt-4 space-y-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Log how many minutes you spent working on this problem before finding the solution.
            </p>

            <div className="space-y-2">
              <label htmlFor="modal-time-spent" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Time Spent (minutes)
              </label>
              <div className="relative">
                <input
                  id="modal-time-spent"
                  type="number"
                  min="0"
                  autoFocus
                  value={timeSpent}
                  onChange={(e) => setTimeSpent(e.target.value)}
                  placeholder="e.g. 25"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-mono text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none pr-16"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
                  mins
                </span>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-1.5 pt-1">
                <span className="text-[11px] text-slate-400 mr-1">Quick:</span>
                {PRESET_MINUTES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setTimeSpent(String(m))}
                    className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950 dark:hover:text-indigo-300 transition-colors"
                  >
                    {m}m
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setStep('confidence')}
                className="px-3 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              >
                Skip Time Spent
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleNextFromTime}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50"
              >
                <span>{saving ? 'Saving...' : 'Next: Rate Confidence'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          /* STEP 2: CONFIDENCE RATING */
          <div className="mt-4 space-y-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
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

            <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setStep('time')}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onSkip}
                  className="px-3 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  Skip
                </button>
                <button
                  type="button"
                  disabled={!selectedRating || saving}
                  onClick={handleConfirmConfidence}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Set Rating'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
};
