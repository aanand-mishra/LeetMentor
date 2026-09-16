import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Plus, Settings, Sun, Moon, Laptop, Keyboard } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

interface HeaderProps {
  onOpenShortcuts?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenShortcuts }) => {
  const location = useLocation();
  const { theme, effectiveTheme, setTheme } = useTheme();

  const cycleTheme = () => {
    if (theme === 'system') {
      setTheme('light');
    } else if (theme === 'light') {
      setTheme('dark');
    } else {
      setTheme('system');
    }
  };

  return (
    <header className="border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur sticky top-0 z-30 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* App Title */}
        <div className="flex items-center space-x-3">
          <Link
            to="/"
            className="flex items-center gap-2 group font-semibold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            <div className="w-7 h-7 rounded-md bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center text-white font-mono font-bold text-xs shadow-sm">
              LC
            </div>
            <span className="text-base tracking-tight font-medium">LeetCode DSA Tracker</span>
          </Link>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Shortcuts Help */}
          {onOpenShortcuts && (
            <button
              onClick={onOpenShortcuts}
              className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Keyboard shortcuts (?)"
              aria-label="Keyboard shortcuts"
            >
              <Keyboard className="w-4 h-4" />
            </button>
          )}

          {/* Theme Switcher */}
          <button
            onClick={cycleTheme}
            className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={`Theme: ${theme} (click to cycle)`}
            aria-label={`Current theme is ${theme}. Click to switch theme.`}
          >
            {theme === 'system' ? (
              <Laptop className="w-4 h-4" />
            ) : effectiveTheme === 'dark' ? (
              <Moon className="w-4 h-4" />
            ) : (
              <Sun className="w-4 h-4" />
            )}
          </button>

          {/* Settings link */}
          <Link
            to="/settings"
            className={`p-2 rounded-md transition-colors ${
              location.pathname === '/settings'
                ? 'bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Settings"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4" />
          </Link>

          {/* New Problem CTA */}
          <Link
            to="/problem/new"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium transition-colors shadow-sm focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Problem</span>
            <span className="sm:hidden">New</span>
          </Link>
        </div>
      </div>
    </header>
  );
};
