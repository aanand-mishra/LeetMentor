import React, { useState, useEffect, useMemo } from 'react';
import {
  Copy,
  Check,
  Sparkles,
  ExternalLink,
  Code2,
  Globe,
  FileCode,
  HelpCircle,
  Laptop,
} from 'lucide-react';
import type { Problem, Attempt } from '../../types';
import { settingsRepo } from '../../db';
import { useToast } from '../../hooks/useToast';
import { StatementMissingWarning } from './StatementMissingWarning';
import {
  buildVisualizationPrompt,
  COMMON_PROGRAMMING_LANGUAGES,
  COMMON_HUMAN_LANGUAGES,
} from '../../utils/visualizePrompt';

interface Props {
  problem: Problem;
  latestAttempt?: Attempt;
  onProblemUpdated?: () => void;
}

function normalizeLanguage(lang?: string): string {
  if (!lang) return 'Python';
  const clean = lang.trim();
  const match = COMMON_PROGRAMMING_LANGUAGES.find(
    (l) => l.toLowerCase() === clean.toLowerCase()
  );
  if (match) return match;
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

export const VisualizeTab: React.FC<Props> = ({
  problem,
  latestAttempt,
}) => {
  const toast = useToast();

  const [programmingLanguage, setProgrammingLanguage] = useState<string>(() =>
    normalizeLanguage(latestAttempt?.language || problem.language)
  );
  const [customProgLang, setCustomProgLang] = useState<string>('');

  const [humanLanguage, setHumanLanguage] = useState<string>('English');
  const [customHumanLang, setCustomHumanLang] = useState<string>('');

  const [includeCode, setIncludeCode] = useState<boolean>(() =>
    Boolean(latestAttempt?.code && latestAttempt.code.trim())
  );
  const [copied, setCopied] = useState<boolean>(false);

  // Sync initial language preferences from global settings if available
  useEffect(() => {
    let mounted = true;
    settingsRepo.get().then((settings) => {
      if (!mounted || !settings) return;

      if (!latestAttempt?.language && !problem.language && settings.defaultLanguage) {
        setProgrammingLanguage(normalizeLanguage(settings.defaultLanguage));
      }

      if (settings.responseLanguage && settings.responseLanguage.trim()) {
        const respLang = settings.responseLanguage.trim();
        const matched = COMMON_HUMAN_LANGUAGES.find(
          (h) => h.toLowerCase() === respLang.toLowerCase()
        );
        if (matched) {
          setHumanLanguage(matched);
        } else {
          setHumanLanguage('Other');
          setCustomHumanLang(respLang);
        }
      }
    });
    return () => {
      mounted = false;
    };
  }, [problem.language, latestAttempt?.language]);

  const effectiveProgLang =
    programmingLanguage === 'Other'
      ? customProgLang.trim() || 'Python'
      : programmingLanguage;

  const effectiveHumanLang =
    humanLanguage === 'Other'
      ? customHumanLang.trim() || 'English'
      : humanLanguage;

  const promptText = useMemo(() => {
    return buildVisualizationPrompt({
      problem,
      latestAttempt,
      programmingLanguage: effectiveProgLang,
      humanLanguage: effectiveHumanLang,
      includeCode,
    });
  }, [problem, latestAttempt, effectiveProgLang, effectiveHumanLang, includeCode]);

  const wordCount = useMemo(() => {
    return promptText.trim().split(/\s+/).length;
  }, [promptText]);

  const handleCopyPrompt = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(promptText);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = promptText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }

      setCopied(true);
      toast.success('Visualization prompt copied to clipboard!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const hasStudentCode = Boolean(latestAttempt?.code && latestAttempt.code.trim());

  return (
    <div className="space-y-6">
      {/* Warning if problem statement is missing */}
      {!problem.statement?.trim() && (
        <StatementMissingWarning problemId={problem.id} />
      )}

      {/* Header Banner */}
      <div className="p-4 sm:p-5 rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-gradient-to-r from-indigo-50/60 via-purple-50/40 to-slate-50 dark:from-indigo-950/30 dark:via-purple-950/20 dark:to-slate-900/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-600 text-white shadow-xs">
              <Sparkles className="w-4 h-4" />
            </span>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Interactive Visualization Prompt Generator
            </h2>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
            Generate a precision-engineered prompt customized to your preferred programming language and human language. Paste it into any frontier LLM (Claude, ChatGPT, Gemini, DeepSeek) to obtain an interactive, single-file HTML visualization app.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopyPrompt}
            data-testid="copy-prompt-btn"
            className={`px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all shadow-xs ${
              copied
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-indigo-500/20 hover:shadow-md'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                <span>Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copy Prompt</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Language & Customization Selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
        {/* Programming Language */}
        <div className="space-y-1.5">
          <label
            htmlFor="vis-prog-lang"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            <Code2 className="w-3.5 h-3.5 text-indigo-500" />
            <span>Programming Language</span>
          </label>
          <select
            id="vis-prog-lang"
            data-testid="vis-prog-lang-select"
            value={programmingLanguage}
            onChange={(e) => setProgrammingLanguage(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
          >
            {COMMON_PROGRAMMING_LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
            <option value="Other">Other (custom)...</option>
          </select>
          {programmingLanguage === 'Other' && (
            <input
              type="text"
              placeholder="e.g. C#, Scala, Haskell"
              value={customProgLang}
              onChange={(e) => setCustomProgLang(e.target.value)}
              className="mt-1.5 w-full px-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          )}
        </div>

        {/* Human Language */}
        <div className="space-y-1.5">
          <label
            htmlFor="vis-human-lang"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            <Globe className="w-3.5 h-3.5 text-indigo-500" />
            <span>Human Language (Explanations)</span>
          </label>
          <select
            id="vis-human-lang"
            data-testid="vis-human-lang-select"
            value={humanLanguage}
            onChange={(e) => setHumanLanguage(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
          >
            {COMMON_HUMAN_LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
            <option value="Other">Other (custom)...</option>
          </select>
          {humanLanguage === 'Other' && (
            <input
              type="text"
              placeholder="e.g. Italian, Hinglish, Russian"
              value={customHumanLang}
              onChange={(e) => setCustomHumanLang(e.target.value)}
              className="mt-1.5 w-full px-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          )}
        </div>

        {/* Code Attempt Inclusion Option */}
        <div className="space-y-1.5 flex flex-col justify-end">
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-slate-700 dark:text-slate-300 py-2">
            <input
              type="checkbox"
              id="include-code-checkbox"
              checked={includeCode}
              disabled={!hasStudentCode}
              onChange={(e) => setIncludeCode(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 h-4 w-4 disabled:opacity-40"
            />
            <span className={!hasStudentCode ? 'text-slate-400 dark:text-slate-500' : ''}>
              Include recent code attempt
            </span>
          </label>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {hasStudentCode
              ? 'Helps the LLM tailor the visualization to your specific approach.'
              : 'No previous code attempt found for this problem.'}
          </span>
        </div>
      </div>

      {/* Prompt Preview Container */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
          <div className="flex items-center gap-2 font-medium">
            <FileCode className="w-4 h-4 text-slate-400" />
            <span>Generated Prompt Preview</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 font-mono">
              ~{wordCount} words
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopyPrompt}
            className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy to clipboard'}</span>
          </button>
        </div>

        <div className="relative rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-900 text-slate-200 overflow-hidden shadow-xs">
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-950/60 text-xs text-slate-400">
            <div className="flex items-center gap-2 font-mono">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
              <span className="ml-2 text-slate-400">prompt.txt ({effectiveProgLang} • {effectiveHumanLang})</span>
            </div>
            <button
              type="button"
              onClick={handleCopyPrompt}
              className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
              title="Copy prompt"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <pre
            data-testid="prompt-preview"
            className="p-4 sm:p-5 text-xs font-mono leading-relaxed max-h-96 overflow-y-auto whitespace-pre-wrap select-all font-normal text-slate-300 scrollbar-thin scrollbar-thumb-slate-700"
          >
            {promptText}
          </pre>
        </div>
      </div>

      {/* LLM Launchers / Direct Shortcuts */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <ExternalLink className="w-3.5 h-3.5 text-indigo-500" />
            <span>Open in AI Assistant</span>
          </h3>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            Copy the prompt first, then paste into any LLM:
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <a
            href="https://chatgpt.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
          >
            <span>ChatGPT</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>

          <a
            href="https://claude.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-amber-500 dark:hover:border-amber-500 hover:bg-amber-50/40 dark:hover:bg-amber-950/20 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
          >
            <span>Claude</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>

          <a
            href="https://gemini.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
          >
            <span>Gemini</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>

          <a
            href="https://chat.deepseek.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
          >
            <span>DeepSeek</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>
        </div>
      </div>

      {/* Guide: How to use */}
      <div className="p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 space-y-2.5 text-xs text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
          <HelpCircle className="w-4 h-4 text-indigo-500" />
          <span>How to use this prompt for best results:</span>
        </div>
        <ol className="list-decimal list-inside space-y-1.5 leading-relaxed pl-1">
          <li>
            Select your desired <strong>Programming Language</strong> for the code trace and <strong>Human Language</strong> for the mentor explanations.
          </li>
          <li>
            Click <strong className="text-indigo-600 dark:text-indigo-400">Copy Prompt</strong> to copy the ready-to-run prompt.
          </li>
          <li>
            Paste the prompt into Claude, ChatGPT, Gemini, or DeepSeek.
          </li>
          <li>
            <span className="inline-flex items-center gap-1">
              <Laptop className="w-3.5 h-3.5 text-slate-400 inline" />
              Save the generated HTML block into a local file (e.g. <code className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[11px] font-mono font-semibold">visualizer.html</code>) and double-click to open it in your browser!
            </span>
          </li>
        </ol>
      </div>
    </div>
  );
};
