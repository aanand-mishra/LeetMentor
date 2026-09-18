import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Eye,
  Code2,
  RotateCcw,
  Maximize2,
  Minimize2,
  ExternalLink,
  Download,
  Sparkles,
  BookmarkPlus,
  AlertCircle,
  Copy,
  Check,
  Cpu,
  Layers,
  Play,
  Volume2,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Problem, Attempt } from '../../types';
import { db, settingsRepo, visualizationsRepo, problemsRepo } from '../../db';
import {
  requestProblemVisualization,
  SUPPORTED_FLASH_MODELS,
  resolveFlashModel,
} from '../../lib/gemini/client';
import { parseVisualizationResponse } from '../../lib/gemini/prompts';
import { GeminiError, fetchAvailableModels } from '../../lib/gemini/transport';
import { MarkdownRenderer } from '../common/MarkdownRenderer';
import { StatementMissingWarning } from './StatementMissingWarning';
import { useToast } from '../../hooks/useToast';

interface Props {
  problem: Problem;
  latestAttempt?: Attempt;
  onProblemUpdated: () => void;
}

export const VisualizeTab: React.FC<Props> = ({
  problem,
  latestAttempt,
  onProblemUpdated,
}) => {
  const toast = useToast();

  // Active view: 'preview' (sandboxed iframe) or 'code' (syntax highlighted HTML)
  const [activeView, setActiveView] = useState<'preview' | 'code'>('preview');

  // Fullscreen interactive modal
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Key to force-reload the iframe and restart the visualizer cleanly
  const [iframeKey, setIframeKey] = useState(0);

  // Flash model selection (strict Flash only, not Lite)
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.6-flash');

  // Dynamic available Flash models fetched from Google Generative Language API
  const [flashModels, setFlashModels] = useState<Array<{ id: string; label: string }>>([
    ...SUPPORTED_FLASH_MODELS,
  ]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  // Loading & generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [queueStatus, setQueueStatus] = useState<string | null>(null);

  // Error state
  const [errorState, setErrorState] = useState<{
    message: string;
    isApiKeyMissing?: boolean;
    is429?: boolean;
    is503?: boolean;
  } | null>(null);

  // Code copy feedback
  const [isCopied, setIsCopied] = useState(false);

  // Regenerate confirmation modal
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);

  // Fetch persisted visualization from IndexedDB for this problem
  const visualization = useLiveQuery(
    () => db.visualizations.where('problemId').equals(problem.id).first(),
    [problem.id]
  );

  // Auto-repair visualization if html is empty but explanation contains HTML code
  useEffect(() => {
    if (
      visualization &&
      (!visualization.html || !visualization.html.trim()) &&
      visualization.explanation &&
      (visualization.explanation.includes('<!DOCTYPE') || visualization.explanation.includes('<html'))
    ) {
      const repaired = parseVisualizationResponse(visualization.explanation);
      if (repaired.html && repaired.html.trim()) {
        visualizationsRepo
          .save({
            id: visualization.id,
            problemId: visualization.problemId,
            html: repaired.html,
            explanation: repaired.explanation,
            model: visualization.model,
          })
          .catch((err) => console.error('Visualizer auto-repair failed:', err));
      }
    }
  }, [visualization]);

  // Load configured model and live models from settings on mount
  useEffect(() => {
    settingsRepo.get().then(async (settings) => {
      const candidate = settings?.visualizeModel || settings?.model;
      setSelectedModel(resolveFlashModel(candidate));

      if (settings?.geminiApiKey?.trim()) {
        setIsLoadingModels(true);
        try {
          const fetched = await fetchAvailableModels(settings.geminiApiKey);
          const eligible = fetched
            .filter((m) => {
              const id = m.id.toLowerCase();
              return (
                id.includes('flash') &&
                !id.includes('lite') &&
                !id.includes('tts') &&
                !id.includes('image')
              );
            })
            .map((m) => ({
              id: m.id,
              label: m.displayName || m.id,
            }));

          if (eligible.length > 0) {
            const seen = new Set<string>();
            const combined: Array<{ id: string; label: string }> = [];
            for (const item of eligible) {
              if (!seen.has(item.id)) {
                seen.add(item.id);
                combined.push(item);
              }
            }
            for (const item of SUPPORTED_FLASH_MODELS) {
              if (!seen.has(item.id)) {
                seen.add(item.id);
                combined.push(item);
              }
            }
            setFlashModels(combined);
          }
        } catch (err) {
          console.warn('Could not fetch live models for visualizer:', err);
        } finally {
          setIsLoadingModels(false);
        }
      }
    });
  }, []);

  // Handle escape key to close fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const handleModelChange = async (newModel: string) => {
    const validated = resolveFlashModel(newModel);
    setSelectedModel(validated);
    try {
      await settingsRepo.update({ visualizeModel: validated });
    } catch (err) {
      console.error('Failed to save preferred visualize model:', err);
    }
  };

  const handleGenerate = async (forceRegenerate = false) => {
    setErrorState(null);
    setIsGenerating(true);
    setQueueStatus('Preparing request for Gemini Flash...');

    try {
      const result = await requestProblemVisualization(
        problem,
        latestAttempt,
        selectedModel,
        (status) => setQueueStatus(status)
      );

      // Save to Dexie DB
      await visualizationsRepo.save({
        problemId: problem.id,
        html: result.html,
        explanation: result.explanation,
        model: result.model,
      });

      setIframeKey((prev) => prev + 1);
      setActiveView('preview');
      toast.success(
        forceRegenerate
          ? 'Interactive visualizer regenerated successfully!'
          : 'Interactive visualizer generated successfully!'
      );
    } catch (err: unknown) {
      console.error('Visualization generation failed:', err);
      if (err instanceof GeminiError) {
        if (err.code === 'API_KEY_MISSING' || err.message.includes('API key')) {
          setErrorState({ message: err.message, isApiKeyMissing: true });
        } else if (err.statusCode === 429) {
          setErrorState({ message: err.message, is429: true });
        } else if (err.statusCode === 503) {
          setErrorState({ message: err.message, is503: true });
        } else {
          setErrorState({ message: err.message });
        }
      } else if (err instanceof Error) {
        setErrorState({ message: err.message });
      } else {
        setErrorState({ message: 'An unexpected error occurred while generating the visualization.' });
      }
    } finally {
      setIsGenerating(false);
      setQueueStatus(null);
      setShowRegenerateConfirm(false);
    }
  };

  const handleCopyCode = async () => {
    if (!visualization?.html) return;
    try {
      await navigator.clipboard.writeText(visualization.html);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      toast.success('Visualizer HTML copied to clipboard');
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleDownloadHtml = () => {
    if (!visualization?.html) return;
    const blob = new Blob([visualization.html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeTitle = (problem.title || 'Solution')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/__+/g, '_');
    link.href = url;
    link.download = `${safeTitle}_Visualizer.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Downloaded standalone HTML visualizer');
  };

  const handleOpenInNewTab = () => {
    if (!visualization?.html) return;
    const blob = new Blob([visualization.html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleSaveToNotes = async () => {
    if (!visualization?.explanation && !visualization?.html) return;
    try {
      const existing = problem.notes ? problem.notes.trim() : '';
      const addition = `\n\n### Interactive Visualizer Notes (${visualization.model})\n${visualization.explanation || 'Visualizer generated for this problem.'}`;
      const newNotes = existing ? `${existing}${addition}` : addition.trim();
      await problemsRepo.update(problem.id, { notes: newNotes });
      toast.success('Appended visualizer walkthrough to Problem Notes!');
      onProblemUpdated();
    } catch {
      toast.error('Failed to save to notes');
    }
  };

  const isStatementMissing = !problem.statement || !problem.statement.trim();

  return (
    <div className="space-y-6">
      {/* Statement Missing Warning */}
      {isStatementMissing && <StatementMissingWarning problemId={problem.id} />}

      {/* Global Error Banner */}
      {errorState && (
        <div
          role="alert"
          className="p-4 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 space-y-3"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-semibold">Generation Error</h4>
              <p className="text-xs leading-relaxed">{errorState.message}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            {errorState.isApiKeyMissing ? (
              <Link
                to="/settings"
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors"
              >
                Configure API Key in Settings →
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => handleGenerate(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </button>
            )}
            <button
              type="button"
              onClick={() => setErrorState(null)}
              className="px-2.5 py-1.5 text-xs text-rose-700 dark:text-rose-300 hover:underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* If Visualizer Exists: Full Interactive Suite */}
      {visualization && !isGenerating && (
        <div className="space-y-6">
          {/* Main Interactive Viewer Frame */}
          <div className="border border-slate-700/70 dark:border-slate-800 rounded-2xl bg-[#0f172a] shadow-2xl overflow-hidden">
            {/* Window Chrome Header Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-[#182234] border-b border-slate-700/80 text-xs">
              {/* Left: Window Dots & Title & Model Badge */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5" aria-hidden="true">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500/90 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500/90 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/90 inline-block" />
                </div>
                <span className="font-semibold text-slate-200 tracking-wide text-xs hidden sm:inline">
                  Interactive Visualizer
                </span>

                {/* Model Selector Dropdown */}
                <div className="flex items-center gap-1.5 pl-2 border-l border-slate-700">
                  <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                  <select
                    id="active-flash-model-select"
                    aria-label="Active Gemini Flash Model"
                    value={selectedModel}
                    onChange={(e) => handleModelChange(e.target.value)}
                    disabled={isLoadingModels}
                    className="bg-slate-900/90 text-indigo-300 border border-indigo-900/60 rounded-md px-2 py-0.5 text-[11px] font-mono focus:outline-hidden focus:ring-1 focus:ring-indigo-400 disabled:opacity-60"
                    title="Flash model strictly used (Lite models disabled)"
                  >
                    {isLoadingModels && (
                      <option disabled>Loading live models from Google...</option>
                    )}
                    {flashModels.map((m) => (
                      <option key={m.id} value={m.id} className="bg-slate-900 text-slate-200">
                        {m.label} ({m.id})
                      </option>
                    ))}
                    {!flashModels.some((m) => m.id === selectedModel) && (
                      <option value={selectedModel} className="bg-slate-900 text-slate-200">
                        {selectedModel} (Custom)
                      </option>
                    )}
                  </select>
                </div>
              </div>

              {/* Center/Right: View Switcher (Preview vs Code) & Action Buttons */}
              <div className="flex items-center gap-2">
                {/* Preview / Code Toggle */}
                <div className="flex items-center bg-slate-900/90 p-0.5 rounded-lg border border-slate-700">
                  <button
                    type="button"
                    onClick={() => setActiveView('preview')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                      activeView === 'preview'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Preview</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveView('code')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                      activeView === 'code'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    <span>Code</span>
                  </button>
                </div>

                {/* Reset / Reload Animation */}
                {activeView === 'preview' && (
                  <button
                    type="button"
                    onClick={() => setIframeKey((k) => k + 1)}
                    className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 transition-all"
                    title="Reload Visualizer Animation"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Fullscreen Toggle */}
                {activeView === 'preview' && (
                  <button
                    type="button"
                    onClick={() => setIsFullscreen(true)}
                    className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 transition-all"
                    title="Expand Fullscreen"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Open in New Tab */}
                <button
                  type="button"
                  onClick={handleOpenInNewTab}
                  className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 transition-all"
                  title="Open in New Tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>

                {/* Download Standalone HTML */}
                <button
                  type="button"
                  onClick={handleDownloadHtml}
                  className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 transition-all"
                  title="Download Standalone HTML"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>

                {/* Copy Code (when in Code view) */}
                {activeView === 'code' && (
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700"
                    title="Copy HTML code"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                )}

                {/* Regenerate Button */}
                <button
                  type="button"
                  onClick={() => setShowRegenerateConfirm(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium text-indigo-300 hover:text-white bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-800/60 transition-all ml-1"
                  title="Regenerate with Gemini Flash"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="hidden sm:inline">Regenerate</span>
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="relative w-full min-h-[660px] bg-[#0b0f19]">
              {activeView === 'preview' ? (
                visualization.html && visualization.html.trim() ? (
                  <iframe
                    key={iframeKey}
                    title={`${problem.title} Interactive Visualizer`}
                    srcDoc={visualization.html}
                    sandbox="allow-scripts allow-forms allow-modals allow-popups allow-same-origin"
                    style={{ backgroundColor: '#0b0f19', colorScheme: 'dark' }}
                    className="w-full h-[680px] border-0 bg-[#0b0f19]"
                  />
                ) : (
                  <div className="p-8 text-center text-slate-300 space-y-5 flex flex-col items-center justify-center h-[680px] bg-[#0b0f19]">
                    <div className="p-3.5 rounded-2xl bg-amber-950/60 border border-amber-800/60 text-amber-400">
                      <AlertTriangle className="w-8 h-8" />
                    </div>
                    <div className="space-y-1.5 max-w-md">
                      <h4 className="text-base font-bold text-white">Visualizer Code Incomplete</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        The visualizer application was truncated during generation or could not be cleanly rendered. Click below to regenerate with Gemini Flash.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleGenerate(true)}
                      className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
                    >
                      <Sparkles className="w-4 h-4 text-indigo-200" />
                      Regenerate Interactive Visualizer
                    </button>
                  </div>
                )
              ) : (
                <div className="h-[680px] overflow-auto p-4 text-xs font-mono">
                  <SyntaxHighlighter
                    language="html"
                    style={oneDark}
                    customStyle={{
                      margin: 0,
                      background: 'transparent',
                      padding: 0,
                      fontSize: '0.82rem',
                      lineHeight: '1.6',
                    }}
                  >
                    {visualization.html}
                  </SyntaxHighlighter>
                </div>
              )}
            </div>
          </div>

          {/* Mentor Walkthrough, Invariants & Notes */}
          {visualization.explanation && (
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Mentor's Visual Guide & Algorithm Invariants
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={handleSaveToNotes}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-200 dark:border-slate-800 transition-colors"
                >
                  <BookmarkPlus className="w-3.5 h-3.5" />
                  Save to Problem Notes
                </button>
              </div>

              <MarkdownRenderer content={visualization.explanation} />
            </div>
          )}
        </div>
      )}

      {/* Generating Loading State */}
      {isGenerating && (
        <div className="p-12 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/20 text-center space-y-5">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping" />
            <div className="relative w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-600/30">
              <Sparkles className="w-8 h-8 animate-spin" style={{ animationDuration: '4s' }} />
            </div>
          </div>

          <div className="space-y-2 max-w-md mx-auto">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Synthesizing Interactive Visualizer...
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Generating self-contained dual-mode web application (Guided Walkthrough & Interactive Practice) using{' '}
              <span className="font-semibold text-indigo-600 dark:text-indigo-400 font-mono">
                {selectedModel}
              </span>
              .
            </p>
          </div>

          {queueStatus && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-mono">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>{queueStatus}</span>
            </div>
          )}
        </div>
      )}

      {/* Empty State: No Visualizer Yet */}
      {!visualization && !isGenerating && (
        <div className="p-8 sm:p-10 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-8">
          <div className="max-w-2xl mx-auto text-center space-y-3">
            <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mb-1 border border-indigo-100 dark:border-indigo-900/40">
              <Layers className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Interactive Algorithm Visualizer & Sandbox
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Transform this problem into an interactive, clickable web application. Step through each pointer state, inspect invariants in real-time, or test yourself in Practice Mode.
            </p>
          </div>

          {/* Feature Highlights Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-1.5">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold text-xs">
                <Play className="w-4 h-4" />
                <span>Dual Interactive Modes</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Toggle between step-by-step guided animation with speed controls and the "You are the Algorithm" challenge mode.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                <Layers className="w-4 h-4" />
                <span>Dynamic Invariant Zones</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Real-time visual partition bars and pointer badges (e.g. LOW, MID, HIGH) tracking boundary invariants.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-1.5">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold text-xs">
                <Sparkles className="w-4 h-4" />
                <span>Mentor's Thought Bubble</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Understands the *why* at every step and clears up tricky interview traps with live simulated code tracing.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-1.5">
              <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-semibold text-xs">
                <Volume2 className="w-4 h-4" />
                <span>Audio Synthesis & Presets</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Synthesized micro-tones for state transitions and instant test cases including edge cases and custom inputs.
              </p>
            </div>
          </div>

          {/* Model Selector & Call to Action */}
          <div className="max-w-md mx-auto space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
              <div className="text-left">
                <label
                  htmlFor="empty-state-model-select"
                  className="text-xs font-semibold text-slate-800 dark:text-slate-200 block"
                >
                  Gemini Flash Model
                </label>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Full Flash model (Lite disabled)
                </span>
              </div>

              <select
                id="empty-state-model-select"
                aria-label="Select Gemini Flash Model"
                value={selectedModel}
                onChange={(e) => handleModelChange(e.target.value)}
                disabled={isLoadingModels}
                className="w-full sm:w-auto px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
              >
                {isLoadingModels && (
                  <option disabled>Loading live models from Google...</option>
                )}
                {flashModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
                {!flashModels.some((m) => m.id === selectedModel) && (
                  <option value={selectedModel}>
                    {selectedModel} (Custom)
                  </option>
                )}
              </select>
            </div>

            <button
              type="button"
              onClick={() => handleGenerate(false)}
              className="w-full py-3 px-6 rounded-xl font-semibold text-sm text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Generate Interactive Solution & Visualizer</span>
            </button>
          </div>
        </div>
      )}

      {/* Fullscreen Overlay Modal */}
      {isFullscreen && visualization && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col p-4 sm:p-6 animate-in fade-in duration-200"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-white">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
                <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
                <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
              </div>
              <h3 className="font-bold text-sm text-slate-200">
                {problem.title} — Interactive Visualizer
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIframeKey((k) => k + 1)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs flex items-center gap-1.5"
                title="Restart Animation"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restart</span>
              </button>

              <button
                type="button"
                onClick={() => setIsFullscreen(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs flex items-center gap-1.5"
                title="Exit Fullscreen (Esc)"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Exit Fullscreen</span>
              </button>
            </div>
          </div>

          <div className="flex-1 mt-3 rounded-xl overflow-hidden border border-slate-800 bg-[#0b0f19]">
            <iframe
              key={`fs-${iframeKey}`}
              title={`${problem.title} Fullscreen Visualizer`}
              srcDoc={visualization.html}
              sandbox="allow-scripts allow-forms allow-modals allow-popups allow-same-origin"
              style={{ backgroundColor: '#0b0f19', colorScheme: 'dark' }}
              className="w-full h-full border-0 bg-[#0b0f19]"
            />
          </div>
        </div>
      )}

      {/* Confirmation Modal for Re-generation */}
      {showRegenerateConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Regenerate Visualizer?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  This will generate a fresh interactive visualizer with{' '}
                  <span className="font-mono text-indigo-600 dark:text-indigo-400">
                    {selectedModel}
                  </span>
                  .
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Your existing interactive visualizer will be replaced. Any saved notes in Problem Notes will remain untouched.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowRegenerateConfirm(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleGenerate(true)}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Confirm & Regenerate</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
