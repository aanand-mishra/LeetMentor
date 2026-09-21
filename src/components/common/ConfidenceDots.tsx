import React from 'react';

interface Props {
  confidence: 1 | 2 | 3 | 4 | 5 | null;
  interactive?: boolean;
  onChange?: (val: 1 | 2 | 3 | 4 | 5) => void;
  size?: 'sm' | 'md';
  showValue?: boolean;
}

const CONFIDENCE_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'Lost — I could not redo this',
  2: "Shaky — I'd need the hints again",
  3: "Okay — I'd struggle but get there",
  4: 'Solid — I could redo this comfortably',
  5: 'Fluent — I could teach this',
};

export const ConfidenceDots: React.FC<Props> = ({
  confidence,
  interactive = false,
  onChange,
  size = 'sm',
}) => {
  const dotSize = size === 'md' ? 'w-3 h-3' : 'w-2 h-2';

  // For unrated problem in read-only / display mode: just render "Unrated" (no dots)
  if (confidence === null && !interactive) {
    return <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">Unrated</span>;
  }

  // Interactive mode (Problem detail header / modal)
  if (interactive && onChange) {
    return (
      <div
        className="inline-flex items-center gap-1 shrink-0"
        title={confidence ? `${confidence}/5: ${CONFIDENCE_LABELS[confidence]}` : 'Unrated'}
      >
        {[1, 2, 3, 4, 5].map((level) => {
          const isFilled = confidence !== null && level <= confidence;
          return (
            <button
              key={level}
              type="button"
              onClick={() => onChange(level as 1 | 2 | 3 | 4 | 5)}
              className="p-1 hover:scale-125 transition-transform focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500 rounded"
              title={`${level}: ${CONFIDENCE_LABELS[level as 1 | 2 | 3 | 4 | 5]}`}
              aria-label={`Set confidence to ${level}: ${CONFIDENCE_LABELS[level as 1 | 2 | 3 | 4 | 5]}`}
            >
              <span
                className={`${dotSize} rounded-full block transition-colors ${
                  isFilled
                    ? 'bg-amber-500 dark:bg-amber-400'
                    : 'bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600'
                }`}
              />
            </button>
          );
        })}
      </div>
    );
  }

  // Rated confidence in read-only mode (table/card display):
  // Renders the 5 dots (filled and unfilled), and NOT the number text
  return (
    <div
      className="inline-flex items-center gap-1 shrink-0"
      title={
        confidence ? `Confidence: ${confidence}/5 — ${CONFIDENCE_LABELS[confidence]}` : 'Unrated'
      }
      aria-label={confidence ? `Confidence: ${confidence} of 5` : 'Unrated'}
    >
      {[1, 2, 3, 4, 5].map((level) => {
        const isFilled = confidence !== null && level <= confidence;
        return (
          <span
            key={level}
            data-testid={`confidence-dot-${level}`}
            className={`${dotSize} rounded-full inline-block transition-colors ${
              isFilled ? 'bg-amber-500 dark:bg-amber-400' : 'bg-slate-200 dark:bg-slate-700'
            }`}
          />
        );
      })}
    </div>
  );
};
