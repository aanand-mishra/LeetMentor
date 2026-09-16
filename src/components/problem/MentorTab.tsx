import React, { useState, useRef, useEffect } from 'react';
import { MarkdownRenderer } from '../common/MarkdownRenderer';
import {
  Lock,
  Unlock,
  RotateCw,
  AlertCircle,
  HelpCircle,
  Compass,
  FileCode,
  CheckCircle,
  Copy,
  Check,
  BookmarkPlus,
  Sparkles,
} from 'lucide-react';
import type { Problem, MentorMessage, Attempt } from '../../types';
import { StatementMissingWarning } from './StatementMissingWarning';
import { mentorRepo, settingsRepo, problemsRepo } from '../../db';
import { requestMentorHint } from '../../lib/gemini/client';
import { useToast } from '../../hooks/useToast';
import { formatMentorMarkdown } from '../../lib/formatMentorMarkdown';

interface Props {
  problem: Problem;
  mentorMessages: MentorMessage[];
  latestAttempt?: Attempt;
  onProblemUpdated: () => void;
  onUnlockRequested?: (level: 1 | 2 | 3 | 4) => Promise<string>;
}

interface HintConfig {
  level: 1 | 2 | 3 | 4;
  title: string;
  badgeLabel: string;
  icon: React.ElementType;
  description: string;
  previewNote: string;
}

const HINT_CONFIGS: HintConfig[] = [
  {
    level: 1,
    title: 'Nudge',
    badgeLabel: 'Level 1',
    icon: HelpCircle,
    description: 'Restatement of the core challenge; 1–2 guiding questions. No technique named.',
    previewNote: 'Helps clarify constraints and identify wasted work without revealing any algorithms.',
  },
  {
    level: 2,
    title: 'Pattern',
    badgeLabel: 'Level 2',
    icon: Compass,
    description: 'Names the technique/data structure and explains why the constraints point to it.',
    previewNote: 'Connects the problem type and constraints to the standard algorithmic paradigm.',
  },
  {
    level: 3,
    title: 'Pseudocode',
    badgeLabel: 'Level 3',
    icon: FileCode,
    description: 'Language-agnostic numbered steps plus complexity. Not compilable.',
    previewNote: 'Structural blueprint of the algorithm steps and expected time/space complexity.',
  },
  {
    level: 4,
    title: 'Solution',
    badgeLabel: 'Level 4',
    icon: CheckCircle,
    description: 'Full commented code, complexity analysis, edge cases, common mistakes, related problems.',
    previewNote: 'Complete reference implementation, edge cases, and pattern generalization.',
  },
];

export const MentorTab: React.FC<Props> = ({
  problem,
  mentorMessages,
  latestAttempt,
  onProblemUpdated,
  onUnlockRequested,
}) => {
  const toast = useToast();
  const [loadingLevel, setLoadingLevel] = useState<number | null>(null);
  const [showLevel4Modal, setShowLevel4Modal] = useState(false);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  // Focus cancel button by default when Level 4 confirmation opens (FR-5.2)
  useEffect(() => {
    if (showLevel4Modal) {
      setTimeout(() => {
        cancelBtnRef.current?.focus();
      }, 50);
    }
  }, [showLevel4Modal]);

  const [configuredModel, setConfiguredModel] = useState<string>('gemini-flash-lite-latest');

  useEffect(() => {
    settingsRepo.get().then((s) => {
      if (s?.model) setConfiguredModel(s.model);
    });
  }, []);

  const isStatementMissing = !problem.statement || !problem.statement.trim();
  const [copiedLevel, setCopiedLevel] = useState<number | null>(null);
  const [lastError, setLastError] = useState<{ level: number; message: string; is503: boolean } | null>(null);

  const handleCopyContent = async (content: string, level: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedLevel(level);
      setTimeout(() => setCopiedLevel(null), 2000);
      toast.success('Copied hint to clipboard');
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleSaveToNotes = async (content: string, hintTitle: string) => {
    try {
      const existing = problem.notes ? problem.notes.trim() : '';
      const addition = `\n\n### AI Mentor: ${hintTitle}\n${content}`;
      const newNotes = existing ? `${existing}${addition}` : addition.trim();
      await problemsRepo.update(problem.id, { notes: newNotes });
      toast.success(`Appended ${hintTitle} to problem Notes!`);
      onProblemUpdated();
    } catch {
      toast.error('Failed to save to notes');
    }
  };

  const handleSwitchToFlashAndRetry = async (level: 1 | 2 | 3 | 4) => {
    try {
      await settingsRepo.update({ model: 'gemini-2.5-flash' });
      setConfiguredModel('gemini-2.5-flash');
      setLastError(null);
      toast.success('Switched model to gemini-2.5-flash. Retrying...');
      await executeUnlock(level);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Retry failed');
    }
  };

  // Map messages by level
  const messageMap = new Map<number, MentorMessage>();
  mentorMessages.forEach((msg) => {
    messageMap.set(msg.level, msg);
  });

  // Check if a level is unlocked
  const isLevelUnlocked = (level: 1 | 2 | 3 | 4) => messageMap.has(level);

  // Gating rule: Level N locked until Level N-1 unlocked (FR-5.2)
  const canUnlockLevel = (level: 1 | 2 | 3 | 4) => {
    if (level === 1) return true;
    return isLevelUnlocked((level - 1) as 1 | 2 | 3 | 4);
  };

  // Generate mock hint content if no external caller passed (incorporates latest attempt per §7.6)
  const getMockContent = (level: 1 | 2 | 3 | 4): string => {
    const lang = problem.language || 'Python';
    const attemptFeedback = latestAttempt
      ? `\n\n*Note on your Attempt #${latestAttempt.attemptNumber}: Focus on simplifying intermediate state tracking.*`
      : '';
    switch (level) {
      case 1:
        return `### Core Challenge
You need to efficiently find the target condition in **${problem.title}** without redundant re-traversals.

### Guiding Questions
1. If you examine the inputs and constraints, what repeated computation does a naive approach perform?
2. Can you remember elements you have already seen so you never need to scan backwards?${attemptFeedback}`;

      case 2:
        return `### Identified Pattern & Technique
For **${problem.title}**, the optimal approach uses **${problem.patterns?.[0] || 'Hash Map / Two Pointers'}** with **${problem.topics?.[0] || 'Array'}**.

### Why the Constraints Point Here
The input size demands $O(N)$ or $O(N \\log N)$ time. By trading $O(N)$ auxiliary space to index visited elements, each lookup drops from linear search to average $O(1)$ constant time.`;

      case 3:
        return `### Algorithmic Blueprint (Pseudocode)
1. Initialize a hash table \`seen\` to store values and their indices.
2. Iterate through each element \`val\` at index \`i\`:
   a. Compute the complement or delta required to satisfy the condition.
   b. If \`complement\` is present in \`seen\`:
      - Return the pair of indices \`[seen[complement], i]\`.
   c. Otherwise:
      - Add \`seen[val] = i\`.
3. If loop finishes without returning, return an empty result or -1.

**Expected Complexity:**
- **Time:** $O(N)$ — single pass over the elements.
- **Space:** $O(N)$ — to store up to $N$ entries in the hash table.`;

      case 4:
        return `### Complete Reference Solution (${lang})

\`\`\`${lang.toLowerCase()}
def solve(nums, target):
    # Map each value to its index for O(1) average lookup
    seen = {}
    
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
        
    return []
\`\`\`

### Leetcodety Analysis
- **Leetcodeplexity:** $O(N)$ because hash map lookups take $O(1)$ amortized time.
- **Space Complexity:** $O(N)$ auxiliary space to store elements in the hash table.

### Edge Cases
- **Duplicate Elements:** The lookup checks the complement before inserting the current duplicate.
- **Empty / Single Item:** Gracefully terminates without match.
- **Negative Numbers & Zero:** Hash map lookups work uniformly across all integer domains.

### Common Mistakes
- Storing the current item before checking for its complement (which can match an element with itself).
- Using nested loops resulting in an accidental $O(N^2)$ time limit exceeded.

### Related Problems
- **LeetCode 1: Two Sum** (Direct hash map pattern)
- **LeetCode 15: 3Sum** (Extends two-sum with sorting & two pointers)`;
    }
  };

  // Perform unlock
  const handleUnlock = async (level: 1 | 2 | 3 | 4) => {
    if (!canUnlockLevel(level)) return;

    if (level === 4 && !isLevelUnlocked(4)) {
      setShowLevel4Modal(true);
      return;
    }

    await executeUnlock(level);
  };

  const executeUnlock = async (level: 1 | 2 | 3 | 4) => {
    setShowLevel4Modal(false);
    setLastError(null);
    try {
      setLoadingLevel(level);
      let content: string;
      const settings = await settingsRepo.get();
      let usedModel = settings.model || 'gemini-flash-lite-latest';

      if (onUnlockRequested) {
        content = await onUnlockRequested(level);
      } else {
        if (settings.geminiApiKey && settings.geminiApiKey.trim()) {
          const result = await requestMentorHint(problem, level, latestAttempt);
          content = result.content;
          usedModel = result.model;
        } else {
          // Realistic simulated generation time when no API key is configured
          await new Promise((res) => setTimeout(res, 300));
          content = getMockContent(level);
        }
      }

      await mentorRepo.saveMessage({
        problemId: problem.id,
        level,
        content,
        model: usedModel,
      });

      toast.success(`Unlocked Hint Level ${level}: ${HINT_CONFIGS[level - 1].title}`);
      onProblemUpdated();
    } catch (err) {
      console.error('Failed to unlock hint:', err);
      const msg = err instanceof Error ? err.message : 'Failed to retrieve hint from mentor.';
      const is503 = msg.includes('503') || msg.includes('No capacity') || msg.includes('UNAVAILABLE');
      setLastError({ level, message: msg, is503 });
      toast.error(msg);
    } finally {
      setLoadingLevel(null);
    }
  };

  // Regenerate action per unlocked level (FR-5.3)
  const handleRegenerate = async (level: 1 | 2 | 3 | 4) => {
    setLastError(null);
    try {
      setLoadingLevel(level);
      let content: string;
      const settings = await settingsRepo.get();
      let usedModel = settings.model || 'gemini-flash-lite-latest';

      if (onUnlockRequested) {
        content = await onUnlockRequested(level);
      } else {
        if (settings.geminiApiKey && settings.geminiApiKey.trim()) {
          const result = await requestMentorHint(problem, level, latestAttempt);
          content = result.content;
          usedModel = result.model;
        } else {
          await new Promise((res) => setTimeout(res, 300));
          content = getMockContent(level);
        }
      }

      await mentorRepo.saveMessage({
        problemId: problem.id,
        level,
        content,
        model: usedModel,
      });

      toast.success(`Regenerated Hint Level ${level}`);
      onProblemUpdated();
    } catch (err) {
      console.error('Failed to regenerate hint:', err);
      const msg = err instanceof Error ? err.message : 'Failed to regenerate hint.';
      const is503 = msg.includes('503') || msg.includes('No capacity') || msg.includes('UNAVAILABLE');
      setLastError({ level, message: msg, is503 });
      toast.error(msg);
    } finally {
      setLoadingLevel(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Inline warning per §5.3 */}
      {isStatementMissing && <StatementMissingWarning problemId={problem.id} />}

      {/* Header bar / Usage indicator */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              AI Mentor — 4 Gated Progressive Hints
            </h2>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full text-xs font-mono font-medium text-slate-600 dark:text-slate-300">
              <span>Hints unlocked:</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400">
                {problem.hintsUsed || 0}
              </span>
              <span>/ 4</span>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Hints are strictly gated to preserve your problem-solving muscle. Unlock sequentially from Nudge to Solution.
          </p>
        </div>

        {/* 4-dot hint level display (FR-5.4) */}
        <div className="flex items-center gap-2 self-start sm:self-auto bg-slate-50 dark:bg-slate-800/60 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mr-1">Progress:</span>
          {([1, 2, 3, 4] as const).map((lvl) => {
            const unlocked = isLevelUnlocked(lvl);
            return (
              <div
                key={lvl}
                className={`w-3 h-3 rounded-full transition-colors ${unlocked
                  ? 'bg-indigo-600 dark:bg-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-900'
                  : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                title={`Level ${lvl}: ${HINT_CONFIGS[lvl - 1].title} (${unlocked ? 'Unlocked' : 'Locked'})`}
              />
            );
          })}
        </div>
      </div>

      {/* 4 Gated Hint Cards */}
      <div className="space-y-4">
        {HINT_CONFIGS.map((cfg) => {
          const unlocked = isLevelUnlocked(cfg.level);
          const canUnlock = canUnlockLevel(cfg.level);
          const message = messageMap.get(cfg.level);
          const isLoading = loadingLevel === cfg.level;
          const Icon = cfg.icon;

          return (
            <div
              key={cfg.level}
              data-testid={`mentor-card-level-${cfg.level}`}
              className={`rounded-xl border transition-all duration-200 ${unlocked
                ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm'
                : canUnlock
                  ? 'bg-slate-50/70 dark:bg-slate-900/50 border-dashed border-slate-300 dark:border-slate-700'
                  : 'bg-slate-100/50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800/60 opacity-60'
                }`}
            >
              {/* Card Header */}
              <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3.5">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${unlocked
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60'
                      : canUnlock
                        ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        : 'bg-slate-200/60 dark:bg-slate-800/40 text-slate-400 dark:text-slate-600'
                      }`}
                  >
                    {unlocked ? <Icon className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 text-[11px] font-mono font-bold uppercase tracking-wider rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {cfg.badgeLabel}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        {cfg.title}
                      </h3>
                      {unlocked && (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Unlocked
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {cfg.description}
                    </p>
                  </div>
                </div>

                {/* Card Action Button */}
                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  {unlocked ? (
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleRegenerate(cfg.level)}
                      title="Regenerate this hint"
                      className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                      <span>{isLoading ? 'Updating...' : 'Regenerate'}</span>
                    </button>
                  ) : (
                    <div className="relative group">
                      <button
                        type="button"
                        disabled={!canUnlock || isLoading}
                        onClick={() => handleUnlock(cfg.level)}
                        title={
                          !canUnlock
                            ? `Unlock Level ${cfg.level - 1} (${HINT_CONFIGS[cfg.level - 2].title}) first`
                            : undefined
                        }
                        className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all ${canUnlock
                          ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow active:scale-[0.99]'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                          }`}
                      >
                        {isLoading ? (
                          <>
                            <RotateCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Unlocking...</span>
                          </>
                        ) : (
                          <>
                            <Unlock className="w-3.5 h-3.5" />
                            <span>Unlock {cfg.title}</span>
                          </>
                        )}
                      </button>
                      {!canUnlock && (
                        <div className="absolute right-0 top-full mt-1.5 hidden group-hover:block z-10 w-48 p-2 bg-slate-800 text-white text-[11px] rounded shadow-lg">
                          Unlock Level {cfg.level - 1} ({HINT_CONFIGS[cfg.level - 2].title}) first.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Inline Error Warning for this level */}
              {lastError && lastError.level === cfg.level && (
                <div className="mx-4 mb-4 p-4 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-rose-800 dark:text-rose-300">
                        Generation Notice
                      </span>
                      <p className="text-rose-700 dark:text-rose-400 mt-0.5">
                        {lastError.message}
                      </p>
                    </div>
                  </div>
                  {lastError.is503 && (
                    <button
                      type="button"
                      onClick={() => handleSwitchToFlashAndRetry(cfg.level)}
                      className="shrink-0 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs shadow-xs transition-all active:scale-95 flex items-center gap-1"
                    >
                      <RotateCw className="w-3 h-3" />
                      <span>Switch to Flash & Retry</span>
                    </button>
                  )}
                </div>
              )}

              {/* Unlocked Content Area */}
              {unlocked && message && (
                <div className="border-t border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-950/40 rounded-b-xl overflow-hidden">
                  {/* Top quick-action toolbar */}
                  <div className="px-5 py-2.5 bg-slate-50/90 dark:bg-slate-900/80 border-b border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-medium">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                      <span>{cfg.badgeLabel} Guide</span>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <span className="text-[11px] font-mono">
                        ~{Math.max(1, Math.ceil(message.content.split(/\s+/).length / 150))} min read
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyContent(message.content, cfg.level)}
                        className="px-2.5 py-1 rounded-md text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-2xs flex items-center gap-1.5 transition-all"
                        title="Copy full content"
                      >
                        {copiedLevel === cfg.level ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-400" />
                            <span>Copy Hint</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSaveToNotes(message.content, cfg.title)}
                        className="px-2.5 py-1 rounded-md text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60 hover:bg-indigo-100/70 dark:hover:bg-indigo-900/50 shadow-2xs flex items-center gap-1.5 transition-all"
                        title="Append this solution/hint to your Notes tab"
                      >
                        <BookmarkPlus className="w-3.5 h-3.5" />
                        <span>Add to Notes</span>
                      </button>
                    </div>
                  </div>

                  {/* Formatted Markdown Content */}
                  <div className="p-5 sm:p-6">
                    <MarkdownRenderer
                      content={formatMentorMarkdown(message.content, problem.language || 'python')}
                    />
                  </div>

                  {/* Metadata footer */}
                  <div className="px-5 py-2.5 bg-slate-50/50 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                    <span>
                      Model: {message.model && message.model !== 'gemini-1.5-flash' ? message.model : configuredModel}
                    </span>
                    <span>Unlocked: {new Date(message.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              )}

              {/* Locked Preview Placeholder */}
              {!unlocked && (
                <div className="border-t border-dashed border-slate-200 dark:border-slate-800/80 px-5 py-3 text-xs text-slate-400 dark:text-slate-500 flex items-center justify-between">
                  <span>{cfg.previewNote}</span>
                  <span className="font-mono text-[11px]">
                    {canUnlock ? 'Ready to unlock' : `Locked (requires L${cfg.level - 1})`}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Confirmation Dialog for Level 4 Solution (FR-5.2) */}
      {showLevel4Modal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="l4-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
        >
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3
                  id="l4-modal-title"
                  className="text-base font-bold text-slate-900 dark:text-white"
                >
                  Reveal Full Solution?
                </h3>
                {/* Exact copy per FR-5.2 */}
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
                  This reveals the full solution. You've unlocked 3 hints so far. Continue?
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
              {/* Default-focused cancel button per FR-5.2 */}
              <button
                ref={cancelBtnRef}
                type="button"
                autoFocus
                onClick={() => setShowLevel4Modal(false)}
                className="w-full sm:w-auto px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                Not yet, let me try again
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLevel4Modal(false);
                  executeUnlock(4);
                }}
                className="w-full sm:w-auto px-4 py-2 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
              >
                Unlock Solution
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
