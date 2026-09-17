import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Key, Cpu, ShieldCheck, ArrowRight, X } from 'lucide-react';

interface WelcomeGuideBannerProps {
  onDismiss: () => void;
}

export const WelcomeGuideBanner: React.FC<WelcomeGuideBannerProps> = ({ onDismiss }) => {
  return (
    <aside
      aria-label="Platform introduction and quick setup guide"
      className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs transition-all animate-fade-in mb-2"
    >
      {/* Top Header Row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/60">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            Quick Start Guide
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500 hidden sm:inline">•</span>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium hidden sm:inline">
            Local-First & Privacy-Focused
          </span>
        </div>

        {/* Dismiss Button */}
        <button
          type="button"
          onClick={onDismiss}
          className="p-1.5 -mr-1 -mt-1 rounded-lg text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Dismiss guide for this session"
          aria-label="Dismiss guide"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Platform Intro */}
      <div className="mt-2.5">
        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
          Welcome to Leetcode DSA Tracker
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl leading-relaxed">
          Your private algorithm practice coach. Practice problems, analyze complexity, and unlock
          progressive Socratic AI hints and reviews with zero subscription fees.
        </p>
      </div>

      {/* Feature Spotlight Quick Guide */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 mt-3.5">
        {/* Gemini API Key */}
        <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
          <div className="p-1.5 rounded-md bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
            <Key className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              Free Gemini API Key
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
              Add your key in Settings to activate AI mentor hints, code reviews & note feedback.
            </p>
          </div>
        </div>

        {/* Languages & Models */}
        <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
          <div className="p-1.5 rounded-md bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              Languages & Models
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
              Configure Python, C++, Java, JS/TS, AI response language, and model tier anytime.
            </p>
          </div>
        </div>

        {/* Local Storage & Backups */}
        <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
          <div className="p-1.5 rounded-md bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              Offline Data & Backups
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
              Stored 100% locally in your browser. Export or restore full JSON backups on demand.
            </p>
          </div>
        </div>
      </div>

      {/* CTA Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Head over to Settings to configure your API key, preferences, and explore features.
        </span>

        <Link
          to="/settings"
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs sm:text-sm font-medium transition-colors shadow-xs shrink-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <span>Go to Settings</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </aside>
  );
};
