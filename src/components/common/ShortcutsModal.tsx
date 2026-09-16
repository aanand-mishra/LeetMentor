import React from 'react';
import { X, Command } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: '/', desc: 'Focus search bar' },
    { key: 'n', desc: 'Create new problem' },
    { key: 'g h', desc: 'Go to Home / Problem list' },
    { key: 'Esc', desc: 'Close open dialog or modal' },
    { key: '?', desc: 'Show keyboard shortcuts' },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 text-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Command className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 id="shortcuts-modal-title" className="text-lg font-bold">
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {shortcuts.map((sc) => (
            <div key={sc.key} className="flex items-center justify-between py-1">
              <span className="text-sm text-slate-600 dark:text-slate-300">{sc.desc}</span>
              <kbd className="px-2.5 py-1 text-xs font-mono font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-sm">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>

        <p className="text-xs text-slate-400 dark:text-slate-500 mt-6 text-center">
          Shortcuts are disabled while typing inside input fields.
        </p>
      </div>
    </div>
  );
};
