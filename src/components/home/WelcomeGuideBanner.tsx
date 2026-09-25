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
      className="relative overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 p-4 sm:p-5 shadow-sm transition-all mb-4 backdrop-blur-sm"
    >
      {/* Subtle background ambient accent */}
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Top Header Row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            Quick Start Guide
          </span>
          <span className="text-xs text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium hidden sm:inline">
            Local-First &amp; Privacy-Focused
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
      <div className="mt-3">
        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
          Welcome to LeetMentor
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl leading-relaxed">
          Your private algorithm practice coach. Practice problems, analyze complexity, and unlock
          progressive Socratic AI hints and reviews with zero subscription fees.
        </p>
      </div>

      {/* Feature Spotlight Quick Guide */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
        {/* Gemini API Key */}
        <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800/80 hover:border-indigo-200 dark:hover:border-indigo-900/60 transition-colors">
          <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 shrink-0 shadow-xs">
            <Key className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
              Free Gemini API Key
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
              Add your key in Settings to activate AI mentor hints, code reviews &amp; note
              feedback.
            </p>
          </div>
        </div>

        {/* Languages & Models */}
        <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800/80 hover:border-indigo-200 dark:hover:border-indigo-900/60 transition-colors">
          <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 shrink-0 shadow-xs">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
              Languages &amp; Models
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
              Configure Python, C++, Java, JS/TS, AI response language, and model tier anytime.
            </p>
          </div>
        </div>

        {/* Local Storage & Backups */}
        <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800/80 hover:border-indigo-200 dark:hover:border-indigo-900/60 transition-colors">
          <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 shrink-0 shadow-xs">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
              Offline Data &amp; Backups
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
              Stored 100% locally in your browser. Export or restore full JSON backups on demand.
            </p>
          </div>
        </div>
      </div>

      {/* CTA Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800/80">
        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          Head over to Settings to configure your API key, preferences, and explore features.
        </span>

        <Link
          to="/settings"
          className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs sm:text-sm font-semibold transition-all shadow-xs shrink-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-[0.98]"
        >
          <span>Go to Settings</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </aside>
  );
};
