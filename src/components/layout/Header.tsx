import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Plus, Settings, Sun, Moon, Laptop, Keyboard, ArrowLeft } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

interface HeaderProps {
  onOpenShortcuts?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenShortcuts }) => {
  const location = useLocation();
  const { theme, effectiveTheme, setTheme } = useTheme();

  const isSubPage = location.pathname !== '/';

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
    <header className="border-b border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md sticky top-0 z-30 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* App Title & Breadcrumbs */}
        <div className="flex items-center space-x-3">
          <Link
            to="/"
            className="flex items-center gap-2.5 group font-semibold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            <img
              src="/favicon.svg"
              alt="Leetcode DSA Tracker"
              className="w-7 h-7 rounded-lg shadow-xs object-contain ring-1 ring-slate-200 dark:ring-slate-800 group-hover:scale-105 transition-transform"
            />
            <span className="text-base tracking-tight font-semibold">Leetcode DSA Tracker</span>
          </Link>

          {isSubPage && (
            <div className="hidden md:flex items-center gap-2 text-xs font-medium text-slate-400 dark:text-slate-500 pl-3 border-l border-slate-200 dark:border-slate-800">
              <Link
                to="/"
                className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Problems</span>
              </Link>
              <span>/</span>
              <span className="text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                {location.pathname === '/settings'
                  ? 'Settings'
                  : location.pathname === '/problem/new'
                    ? 'Add Problem'
                    : location.pathname.endsWith('/edit')
                      ? 'Edit'
                      : 'Detail'}
              </span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-1.5 sm:space-x-2.5">
          {/* Shortcuts Help */}
          {onOpenShortcuts && (
            <button
              onClick={onOpenShortcuts}
              className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
              title="Keyboard shortcuts (?)"
              aria-label="Keyboard shortcuts"
            >
              <Keyboard className="w-4 h-4" />
            </button>
          )}

          {/* Theme Switcher */}
          <button
            onClick={cycleTheme}
            className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
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
            className={`p-2 rounded-lg transition-colors ${
              location.pathname === '/settings'
                ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-200 dark:ring-indigo-800/60'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/80'
            }`}
            title="Settings"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4" />
          </Link>

          {/* New Problem CTA */}
          <Link
            to="/problem/new"
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all shadow-xs ${
              location.pathname === '/problem/new'
                ? 'bg-indigo-700 text-white ring-2 ring-indigo-500'
                : 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white focus-visible:ring-2 focus-visible:ring-indigo-500'
            }`}
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
