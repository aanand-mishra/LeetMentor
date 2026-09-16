import React, { useState, useEffect } from 'react';
import {
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  Download,
  Upload,
  Trash2,
  Cpu,
  Sliders,
  ShieldAlert,
  RotateCw,
  ExternalLink,
  Database,
} from 'lucide-react';
import { settingsRepo, clearAllLocalData } from '../db';
import { seedDatabase } from '../db/seed';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../hooks/useToast';
import type { Settings } from '../types';
import {
  triggerExportDownload,
  validateExportPayload,
  importDatabase,
  type ExportData,
} from '../utils/export';
import { testConnection, fetchAvailableModels, type ModelOption } from '../lib/gemini/transport';

export const SettingsPage: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const toast = useToast();

  const [settings, setSettings] = useState<Settings | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Models state
  const [availableModels, setAvailableModels] = useState<ModelOption[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [customModelMode, setCustomModelMode] = useState(false);

  // Import preview state
  const [importData, setImportData] = useState<ExportData | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [replaceConfirmInput, setReplaceConfirmInput] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  // Danger zone state
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  const handleSeedData = async (count: number) => {
    try {
      setIsSeeding(true);
      const res = await seedDatabase(count);
      toast.success(
        `Successfully seeded ${count} problems! Total in database: ${res.problemsCount}`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to seed database';
      toast.error(msg);
    } finally {
      setIsSeeding(false);
    }
  };

  // Load settings on mount
  useEffect(() => {
    settingsRepo.get().then((data) => {
      setSettings(data);
      setApiKeyInput(data.geminiApiKey || '');
      if (data.geminiApiKey) {
        loadModels(data.geminiApiKey);
      }
    });
  }, []);

  // Fetch models using API key (§7.2, FR-8.3)
  const loadModels = async (key: string) => {
    if (!key.trim()) return;
    setIsLoadingModels(true);
    setModelsError(null);
    try {
      const models = await fetchAvailableModels(key);
      setAvailableModels(models);
    } catch (err: unknown) {
      console.error('Failed to load models:', err);
      setModelsError(err instanceof Error ? err.message : 'Could not fetch models.');
    } finally {
      setIsLoadingModels(false);
    }
  };

  // Save API key
  const handleSaveApiKey = async () => {
    if (!settings) return;
    try {
      await settingsRepo.update({ geminiApiKey: apiKeyInput.trim() });
      setSettings((prev) => (prev ? { ...prev, geminiApiKey: apiKeyInput.trim() } : null));
      toast.success('Gemini API key saved');
      setTestResult(null);
      if (apiKeyInput.trim()) {
        loadModels(apiKeyInput.trim());
      }
    } catch (err) {
      console.error('Failed to save API key:', err);
      toast.error('Failed to save API key');
    }
  };

  // Clear API key (FR-8.1)
  const handleClearApiKey = async () => {
    if (!settings) return;
    try {
      await settingsRepo.update({ geminiApiKey: '' });
      setApiKeyInput('');
      setSettings((prev) => (prev ? { ...prev, geminiApiKey: '' } : null));
      setTestResult(null);
      setAvailableModels([]);
      toast.success('API key cleared');
    } catch (err) {
      console.error('Failed to clear key:', err);
      toast.error('Failed to clear key');
    }
  };

  // Test Connection (FR-8.1)
  const handleTestConnection = async () => {
    const keyToTest = apiKeyInput.trim();
    if (!keyToTest) {
      toast.error('Please enter an API key first');
      return;
    }

    setIsTestingKey(true);
    setTestResult(null);

    const modelToTest = settings?.model || 'gemini-2.5-flash';
    const result = await testConnection(keyToTest, modelToTest);

    setIsTestingKey(false);
    setTestResult(result);

    if (result.ok) {
      toast.success('Connection successful!');
      if (availableModels.length === 0) {
        loadModels(keyToTest);
      }
    } else {
      toast.error(result.message);
    }
  };

  // Update a single setting
  const handleUpdateSetting = async <K extends keyof Settings>(key: K, value: Settings[K]) => {
    if (!settings) return;
    try {
      await settingsRepo.update({ [key]: value });
      setSettings((prev) => (prev ? { ...prev, [key]: value } : null));
      toast.success('Setting updated');
    } catch (err) {
      console.error(`Failed to update ${key}:`, err);
      toast.error('Failed to update setting');
    }
  };

  // Handle file selected for import (FR-8.6)
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const validation = validateExportPayload(text);

      if (!validation.valid || !validation.data) {
        toast.error(validation.error || 'Invalid export file');
        return;
      }

      setImportData(validation.data);
      setImportMode('merge');
      setReplaceConfirmInput('');
      setShowImportModal(true);
    } catch (err) {
      console.error('Failed to read import file:', err);
      toast.error('Could not read selected file');
    } finally {
      // Reset input value so same file can be selected again if needed
      e.target.value = '';
    }
  };

  // Execute Import
  const handleExecuteImport = async () => {
    if (!importData) return;

    if (importMode === 'replace' && replaceConfirmInput.trim() !== 'REPLACE') {
      toast.error('Please type REPLACE to confirm database wipe.');
      return;
    }

    try {
      setIsImporting(true);
      const result = await importDatabase(importData, importMode);

      toast.success(
        `Import complete! (${result.importedProblems} problems, ${result.importedAttempts} attempts, ${result.importedMentor} hints)`
      );
      setShowImportModal(false);
      setImportData(null);
    } catch (err) {
      console.error('Import failed:', err);
      toast.error('Failed to import database.');
    } finally {
      setIsImporting(false);
    }
  };

  // Delete all data (FR-8.7)
  const handleDeleteAllData = async () => {
    if (deleteConfirmInput.trim() !== 'DELETE') {
      toast.error('Please type DELETE to confirm data destruction.');
      return;
    }

    try {
      setIsDeletingAll(true);
      await clearAllLocalData();
      toast.success('All data permanently deleted.');
      setShowDeleteAllModal(false);
      window.location.href = '/';
    } catch (err) {
      console.error('Failed to delete all data:', err);
      toast.error('Failed to delete data.');
      setIsDeletingAll(false);
    }
  };

  if (!settings) {
    return (
      <div className="py-12 text-center text-sm text-slate-500">
        Loading settings...
      </div>
    );
  }

  const commonLanguages = [
    'python',
    'javascript',
    'typescript',
    'cpp',
    'java',
    'go',
    'rust',
    'csharp',
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16 animate-fade-in">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Settings
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Configure runtime API credentials, model selection, defaults, and data backups.
        </p>
      </div>

      {/* 1. Gemini API Key Section (FR-8.1, FR-8.2) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Google Gemini API Key
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Used directly from your browser to power progressive hints, code review, and note critique.
            </p>
          </div>
        </div>

        {/* REQUIRED Security Notice Callout (FR-8.2 verbatim) */}
        <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-300/80 dark:border-amber-800/60 rounded-xl p-4 text-xs text-amber-900 dark:text-amber-200 leading-relaxed space-y-2">
          <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400">
            <ShieldAlert className="w-4 h-4" />
            <span>Security & Privacy Notice</span>
          </div>
          <p>
            Your API key is stored unencrypted in this browser's IndexedDB and is sent directly from your browser to Google. Anyone with access to this browser profile, and any script running on this page, can read it. Use a key restricted to the Generative Language API, and revoke it if you share this device.
          </p>
          <p>
            Free-tier Gemini requests may be used by Google to improve their models. Do not paste confidential or employer-owned code.
          </p>
        </div>

        {/* Key Input & Actions */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="Paste your Gemini API key (AIzaSy...)"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                aria-label={showKey ? 'Hide key' : 'Show key'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveApiKey}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
              >
                Save key
              </button>
              <button
                type="button"
                disabled={isTestingKey || !apiKeyInput.trim()}
                onClick={handleTestConnection}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isTestingKey ? 'animate-spin' : ''}`} />
                <span>{isTestingKey ? 'Testing…' : 'Test connection'}</span>
              </button>
              {settings.geminiApiKey && (
                <button
                  type="button"
                  onClick={handleClearApiKey}
                  className="px-3 py-2 text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg text-xs font-semibold transition-colors"
                >
                  Clear key
                </button>
              )}
            </div>
          </div>

          {/* Test connection report feedback */}
          {testResult && (
            <div
              className={`p-3 rounded-lg text-xs flex items-start gap-2 ${
                testResult.ok
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span className="font-medium">{testResult.message}</span>
            </div>
          )}

          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <span>Need a key? Get one for free at</span>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-0.5 font-medium"
            >
              <span>Google AI Studio</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>

      {/* 2. Model Selection (FR-8.3) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Active Gemini Model
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Dynamic model list fetched live from Google API. Flash-class models are recommended for free-tier quotas.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setCustomModelMode(!customModelMode)}
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
          >
            {customModelMode ? 'Select from list' : 'Type custom model ID'}
          </button>
        </div>

        {customModelMode || modelsError ? (
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Custom Model ID
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={settings.model}
                onChange={(e) => handleUpdateSetting('model', e.target.value.trim())}
                placeholder="e.g. gemini-2.5-flash"
                className="flex-1 px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            {modelsError && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Live list unavailable ({modelsError}). Using manual ID input.
              </p>
            )}
            <p className="text-[11px] text-slate-500">
              Reference:{' '}
              <a
                href="https://ai.google.dev/gemini-api/docs/models/gemini"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-0.5"
              >
                <span>Google Gemini Models Documentation</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <select
                value={settings.model}
                disabled={isLoadingModels || availableModels.length === 0}
                onChange={(e) => handleUpdateSetting('model', e.target.value)}
                className="flex-1 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
              >
                {availableModels.length === 0 ? (
                  <option value={settings.model}>
                    {isLoadingModels ? 'Loading models from Google…' : `${settings.model} (Default)`}
                  </option>
                ) : (
                  availableModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.displayName} ({m.id})
                    </option>
                  ))
                )}
              </select>

              {settings.geminiApiKey && (
                <button
                  type="button"
                  disabled={isLoadingModels}
                  onClick={() => loadModels(settings.geminiApiKey)}
                  title="Refresh model list"
                  className="p-2.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <RotateCw className={`w-4 h-4 ${isLoadingModels ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Flash models provide low latency and generous free-tier limits without incurring billing.
            </p>
          </div>
        )}
      </div>

      {/* 3. General Preferences & Quota Counter (FR-8.4, FR-8.5) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Preferences & Daily Quota
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Code language, UI theme, generation temperature, and local request counter.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Default Language */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Default Solution Language
            </label>
            <select
              value={settings.defaultLanguage}
              onChange={(e) => handleUpdateSetting('defaultLanguage', e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {commonLanguages.map((l) => (
                <option key={l} value={l}>
                  {l.charAt(0).toUpperCase() + l.slice(1)}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400">
              Pre-selected when creating problems or submitting attempts.
            </p>
          </div>

          {/* Theme */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Application Theme
            </label>
            <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
              {(['light', 'dark', 'system'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setTheme(t);
                    handleUpdateSetting('theme', t);
                  }}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md capitalize transition-colors ${
                    theme === t
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400">
              Dark mode is a first-class design target.
            </p>
          </div>

          {/* Temperature Slider */}
          <div className="space-y-1.5 md:col-span-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Model Temperature ({settings.temperature.toFixed(2)})
              </label>
              <span className="text-[11px] text-slate-400 font-mono">
                {settings.temperature <= 0.2
                  ? 'More deterministic / rigorous'
                  : settings.temperature >= 0.7
                  ? 'More exploratory / creative'
                  : 'Balanced (recommended)'}
              </span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              value={settings.temperature}
              onChange={(e) => handleUpdateSetting('temperature', parseFloat(e.target.value))}
              className="w-full accent-indigo-600"
            />
            <p className="text-[11px] text-slate-400">
              Lower temperature (0.2–0.4) is ideal for strict syntax critique and algorithmic accuracy.
            </p>
          </div>

          {/* Local Usage Counter (FR-8.5) */}
          <div className="space-y-1.5 md:col-span-2 bg-slate-50 dark:bg-slate-950/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Local AI Requests Today:
                </span>
                <span className="px-2 py-0.5 text-xs font-mono font-bold rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                  {settings.dailyRequestCount || 0}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Local estimate only. Google enforces the real quota.
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleUpdateSetting('dailyRequestCount', 0)}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline"
            >
              Reset counter
            </button>
          </div>
        </div>
      </div>

      {/* 4. Export & Import Backup (FR-8.6) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Data Backup & Portability
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Export your problems, attempts, mentor messages, and note reviews. The Gemini API key is strictly excluded.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          {/* Export Button */}
          <button
            type="button"
            onClick={triggerExportDownload}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON backup</span>
          </button>

          {/* Import Button */}
          <label className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer flex items-center gap-1.5 transition-colors">
            <Upload className="w-3.5 h-3.5" />
            <span>Import backup JSON…</span>
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleFileSelected}
              className="hidden"
            />
          </label>
        </div>

        <p className="text-[11px] text-slate-400">
          Tip: Download a backup regularly. Since all data lives in your browser's IndexedDB, clearing site data will erase your history if not backed up.
        </p>
      </div>

      {/* 5. Demo & Seed Data */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Demo & Sample Data
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Populate the local database with realistic LeetCode problems (with attempts, reviews, notes, and mentor hints) or high-volume performance test sets.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            disabled={isSeeding}
            onClick={() => handleSeedData(20)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <Database className="w-3.5 h-3.5" />
            <span>{isSeeding ? 'Seeding…' : 'Seed 20 sample problems'}</span>
          </button>

          <button
            type="button"
            disabled={isSeeding}
            onClick={() => handleSeedData(2000)}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <Database className="w-3.5 h-3.5" />
            <span>{isSeeding ? 'Seeding…' : 'Seed 2,000 benchmark problems'}</span>
          </button>
        </div>

        <p className="text-[11px] text-slate-400">
          Note: Seeding adds to your existing dataset. To start completely fresh before seeding, use &ldquo;Delete all data&rdquo; in the Danger Zone below.
        </p>
      </div>

      {/* 6. Danger Zone (FR-8.7) */}
      <div className="bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5 text-rose-700 dark:text-rose-400">
          <Trash2 className="w-5 h-5" />
          <h2 className="text-base font-bold">Danger Zone</h2>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Permanently delete all problems, attempts, hints, reviews, and settings stored in this browser. This cannot be undone.
        </p>

        <div>
          <button
            type="button"
            onClick={() => {
              setDeleteConfirmInput('');
              setShowDeleteAllModal(true);
            }}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs"
          >
            Delete all data
          </button>
        </div>
      </div>

      {/* Import Preview Modal (FR-8.6) */}
      {showImportModal && importData && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-lg w-full p-6 text-slate-900 dark:text-slate-100 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Upload className="w-4 h-4 text-indigo-600" />
                <span>Import Dataset Preview</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            {/* Counts breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50 dark:bg-slate-950 p-3.5 rounded-lg text-center border border-slate-200 dark:border-slate-800">
              <div>
                <span className="block text-base font-bold text-slate-900 dark:text-white font-mono">
                  {importData.problems?.length || 0}
                </span>
                <span className="text-[11px] text-slate-500">Problems</span>
              </div>
              <div>
                <span className="block text-base font-bold text-slate-900 dark:text-white font-mono">
                  {importData.attempts?.length || 0}
                </span>
                <span className="text-[11px] text-slate-500">Attempts</span>
              </div>
              <div>
                <span className="block text-base font-bold text-slate-900 dark:text-white font-mono">
                  {importData.mentorMessages?.length || 0}
                </span>
                <span className="text-[11px] text-slate-500">Hints</span>
              </div>
              <div>
                <span className="block text-base font-bold text-slate-900 dark:text-white font-mono">
                  {importData.noteReviews?.length || 0}
                </span>
                <span className="text-[11px] text-slate-500">Reviews</span>
              </div>
            </div>

            {/* Import Mode Chooser */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                Choose Import Mode
              </label>
              <div className="space-y-2">
                <label className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    value="merge"
                    checked={importMode === 'merge'}
                    onChange={() => setImportMode('merge')}
                    className="mt-0.5 accent-indigo-600"
                  />
                  <div>
                    <span className="block text-xs font-bold text-slate-900 dark:text-white">
                      Merge (Recommended)
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Keep existing records. Skip any records whose ID already exists in your database.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-3 rounded-lg border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50/40 dark:hover:bg-rose-950/20 cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    value="replace"
                    checked={importMode === 'replace'}
                    onChange={() => setImportMode('replace')}
                    className="mt-0.5 accent-rose-600"
                  />
                  <div>
                    <span className="block text-xs font-bold text-rose-700 dark:text-rose-400">
                      Replace (Wipe Existing Data)
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Clears current problems, attempts, hints, and reviews first, then loads this file. (Your active API key is kept safe).
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Replace confirmation input */}
            {importMode === 'replace' && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg space-y-2">
                <p className="text-xs font-semibold text-rose-800 dark:text-rose-300">
                  Type <span className="font-mono underline">REPLACE</span> to confirm database wipe:
                </p>
                <input
                  type="text"
                  value={replaceConfirmInput}
                  onChange={(e) => setReplaceConfirmInput(e.target.value)}
                  placeholder="REPLACE"
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-700 rounded text-rose-900 dark:text-rose-100 font-mono outline-none"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isImporting || (importMode === 'replace' && replaceConfirmInput !== 'REPLACE')}
                onClick={handleExecuteImport}
                className={`px-4 py-2 text-xs font-semibold rounded-lg text-white shadow-xs disabled:opacity-50 ${
                  importMode === 'replace'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {isImporting
                  ? 'Importing…'
                  : importMode === 'replace'
                  ? 'Confirm & Replace All'
                  : 'Merge into Database'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Danger Zone Delete All Data Modal (FR-8.7) */}
      {showDeleteAllModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 text-slate-900 dark:text-slate-100 space-y-4">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-base font-bold">Permanently Delete All Data?</h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              This will wipe all tracked problems, code attempts, progressive mentor hints, and review history from this device.
            </p>

            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg space-y-2">
              <label className="block text-xs font-semibold text-rose-800 dark:text-rose-300">
                Type <span className="font-mono underline font-bold">DELETE</span> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmInput}
                onChange={(e) => setDeleteConfirmInput(e.target.value)}
                placeholder="DELETE"
                className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-700 rounded text-rose-900 dark:text-rose-100 font-mono outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowDeleteAllModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingAll || deleteConfirmInput !== 'DELETE'}
                onClick={handleDeleteAllData}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-xs disabled:opacity-50"
              >
                {isDeletingAll ? 'Deleting…' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
