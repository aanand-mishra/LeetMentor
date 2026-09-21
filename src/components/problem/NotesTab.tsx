import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MarkdownRenderer, MathText } from '../common/MarkdownRenderer';
import {
  Star,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  FileText,
  Eye,
  Edit3,
  Lightbulb,
  RotateCw,
  Mic,
} from 'lucide-react';
import type { Problem, NoteReview } from '../../types';
import { problemsRepo, noteReviewsRepo, settingsRepo } from '../../db';
import { requestNotesReview } from '../../lib/gemini/client';
import { useToast } from '../../hooks/useToast';
import { useVoiceDictation } from '../../hooks/useVoiceDictation';
import { VoiceDictateButton } from './VoiceDictateButton';

interface Props {
  problem: Problem;
  noteReviews: NoteReview[];
  onProblemUpdated: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
  onReviewRequested?: (notes: string) => Promise<Omit<NoteReview, 'id' | 'createdAt'>>;
}

const SCAFFOLD_PLACEHOLDER = `What was the key insight?
What pattern does this belong to, and what else does that pattern solve?
Why is this complexity optimal?
What did I get wrong first, and why?`;

export const NotesTab: React.FC<Props> = ({
  problem,
  noteReviews,
  onProblemUpdated,
  onDirtyChange,
  onReviewRequested,
}) => {
  const toast = useToast();
  const [notes, setNotes] = useState(problem.notes || '');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [viewMode, setViewMode] = useState<'write' | 'preview'>('write');
  const [isReviewing, setIsReviewing] = useState(false);
  const [copiedTakeawayId, setCopiedTakeawayId] = useState<string | null>(null);
  const [expandedReviews, setExpandedReviews] = useState<Record<string, boolean>>({});

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const latestNotesRef = useRef(notes);
  latestNotesRef.current = notes;

  // Sync external problem notes changes if not actively editing
  useEffect(() => {
    if (saveStatus === 'saved' && problem.notes !== notes) {
      setNotes(problem.notes || '');
    }
  }, [problem.notes, saveStatus, notes]);

  // Autosave notes to IndexedDB (1 second after typing stops per FR-6.1)
  const saveToDb = useCallback(
    async (textToSave: string) => {
      try {
        setSaveStatus('saving');
        await problemsRepo.update(problem.id, {
          notes: textToSave,
        });
        setSaveStatus('saved');
        onDirtyChange?.(false);
        onProblemUpdated();
      } catch (err) {
        console.error('Failed to autosave notes:', err);
        setSaveStatus('unsaved');
      }
    },
    [problem.id, onDirtyChange, onProblemUpdated]
  );

  /**
   * Shared write path for typed AND dictated text: identical autosave,
   * dirty-tracking, and char-count behavior regardless of input modality.
   */
  const applyNotesText = useCallback(
    (nextText: string) => {
      setNotes(nextText);
      setSaveStatus('unsaved');
      onDirtyChange?.(true);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        saveToDb(nextText);
      }, 1000);
    },
    [saveToDb, onDirtyChange]
  );

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    applyNotesText(e.target.value);
  };

  /**
   * Splices a transcribed take at the caret (or appends at the end when the
   * editor isn't focused), normalizing boundary whitespace so words never
   * fuse. Flows through `applyNotesText`, so autosave/dirty/char-count
   * behave exactly as if typed.
   */
  const insertTextAtCursor = useCallback(
    (insert: string) => {
      const cleaned = insert.replace(/\s+/g, ' ').trim();
      if (!cleaned) return;
      const base = latestNotesRef.current;
      const el = textareaRef.current;

      let next: string;
      let caret: number;
      if (el && document.activeElement === el && typeof el.selectionStart === 'number') {
        const start = el.selectionStart ?? base.length;
        const end = el.selectionEnd ?? base.length;
        const before = base.slice(0, start);
        const after = base.slice(end);
        const needsSpaceBefore = before.length > 0 && !/\s$/.test(before);
        const needsSpaceAfter = after.length > 0 && !/^\s/.test(after);
        const chunk = `${needsSpaceBefore ? ' ' : ''}${cleaned}${needsSpaceAfter ? ' ' : ''}`;
        next = `${before}${chunk}${after}`;
        caret = before.length + chunk.length;
      } else {
        const needsSpace = base.length > 0 && !/\s$/.test(base);
        next = `${base}${needsSpace ? ' ' : ''}${cleaned}`;
        caret = next.length;
      }

      applyNotesText(next);
      requestAnimationFrame(() => {
        const node = textareaRef.current;
        if (node) {
          node.focus();
          try {
            node.setSelectionRange(caret, caret);
          } catch {
            // Ignore caret failures on exotic inputs.
          }
        }
      });
    },
    [applyNotesText]
  );

  const voice = useVoiceDictation({
    onTranscript: insertTextAtCursor,
    onError: (message) => toast.error(message),
  });

  // Clean up timer on unmount and save pending changes
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        // Synchronously save pending changes before unmounting
        problemsRepo.update(problem.id, { notes: latestNotesRef.current }).catch(console.error);
        onDirtyChange?.(false);
      }
    };
  }, [problem.id, onDirtyChange]);

  const charCount = notes.trim().length;
  const isReviewDisabled = charCount < 50 || isReviewing;

  // Default mock review generator for Phase 8
  const getMockReview = (
    notesText: string,
    modelUsed = 'gemini-flash-lite-latest'
  ): Omit<NoteReview, 'id' | 'createdAt'> => {
    return {
      problemId: problem.id,
      notesSnapshot: notesText,
      verdict: notesText.length > 100 ? 'solid' : 'needs_work',
      rating: (notesText.length > 100 ? 4 : 2) as 1 | 2 | 3 | 4 | 5,
      corrections: [
        {
          claim: 'The auxiliary space is O(1) because we only store element pointers.',
          issue:
            'Storing visited values in a hash map scales linearly with input size in the worst case.',
          correction: 'The auxiliary space is O(N) for the map, not O(1).',
        },
      ],
      gaps: [
        'Consider explaining how boundary conditions (empty array, zero target) are satisfied.',
        'Name other classic interview problems where this complement lookup pattern applies.',
      ],
      strengths: [
        'Accurately captures the primary algorithmic trade-off between time and space.',
        'Identifies the risk of duplicate element self-matching before inserting.',
      ],
      keyTakeaway:
        'Store elements in a hash map to trade O(N) auxiliary space for O(1) expected-time complement lookups, avoiding quadratic pair searches.',
      recallQuestions: [
        'What specific constraint would force this algorithm from O(1) average lookup to O(N) worst-case?',
        'How would you solve this with O(1) auxiliary space if the input were guaranteed to be sorted?',
        'Why is checking the complement before inserting into the map essential for correctness?',
      ],
      model: modelUsed,
    };
  };

  // Request Notes Review (FR-6.3)
  const handleReviewNotes = async () => {
    if (isReviewDisabled) return;

    // Ensure current text is saved before requesting review
    if (saveStatus !== 'saved') {
      await saveToDb(notes);
    }

    try {
      setIsReviewing(true);
      let reviewData: Omit<NoteReview, 'id' | 'createdAt'>;

      if (onReviewRequested) {
        reviewData = await onReviewRequested(notes);
      } else {
        const settings = await settingsRepo.get();
        if (settings.geminiApiKey && settings.geminiApiKey.trim()) {
          reviewData = await requestNotesReview(problem, notes, 1);
        } else {
          await new Promise((res) => setTimeout(res, 400));
          reviewData = getMockReview(notes, settings.model || 'gemini-flash-lite-latest');
        }
      }

      await noteReviewsRepo.create(reviewData);

      toast.success(
        reviewData.verdict === 'solid'
          ? `Notes reviewed: Solid (${reviewData.rating}/5) ★`
          : `Notes reviewed: Needs Work (${reviewData.rating}/5)`
      );

      onProblemUpdated();
    } catch (err) {
      console.error('Failed to review notes:', err);
      toast.error(
        err instanceof Error ? err.message : 'Failed to submit notes for review. Please try again.'
      );
    } finally {
      setIsReviewing(false);
    }
  };

  const handleCopyTakeaway = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTakeawayId(id);
      toast.success('Key takeaway copied to clipboard');
      setTimeout(() => setCopiedTakeawayId(null), 2000);
    } catch (err) {
      console.error('Failed to copy takeaway:', err);
      toast.error('Failed to copy to clipboard');
    }
  };

  const toggleReviewExpand = (reviewId: string) => {
    setExpandedReviews((prev) => ({
      ...prev,
      [reviewId]: !prev[reviewId],
    }));
  };

  // Render 1-5 star indicator
  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-1" title={`${rating} of 5 stars`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-3.5 h-3.5 ${
              star <= rating
                ? 'text-amber-400 fill-amber-400'
                : 'text-slate-300 dark:text-slate-700'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Editor & Actions Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden transition-all">
        {/* Top Control Bar */}
        <div className="px-5 py-3.5 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-900/60">
          <div className="flex items-center gap-3">
            {/* Mode Switcher */}
            <div className="inline-flex rounded-xl bg-slate-200/80 dark:bg-slate-800 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('write')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'write'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Write</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('preview')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'preview'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview</span>
              </button>
            </div>

            {/* Autosave Status Indicator (FR-6.1) */}
            <div className="text-xs font-semibold flex items-center gap-1.5">
              {saveStatus === 'saving' && (
                <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <RotateCw className="w-3 h-3 animate-spin" />
                  Saving…
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Saved
                </span>
              )}
              {saveStatus === 'unsaved' && (
                <span className="text-slate-400 dark:text-slate-500">Unsaved changes</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Character counter / requirement */}
            <div
              className={`text-xs font-mono font-medium ${
                charCount >= 50
                  ? 'text-slate-500 dark:text-slate-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              {charCount}/50 chars min
            </div>

            {/* Voice dictation (hidden where mic capture is unavailable) */}
            <VoiceDictateButton
              status={voice.status}
              recordingSeconds={voice.recordingSeconds}
              isSupported={voice.isSupported}
              disabled={isReviewing}
              onToggle={voice.toggle}
            />

            {/* Review My Notes Button (FR-6.3) */}
            <div className="relative group">
              <button
                type="button"
                disabled={isReviewDisabled}
                onClick={handleReviewNotes}
                className={`px-4 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all ${
                  isReviewDisabled
                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs active:scale-98'
                }`}
              >
                {isReviewing ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Reviewing…</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-3.5 h-3.5" />
                    <span>Review my notes</span>
                  </>
                )}
              </button>

              {charCount < 50 && (
                <div className="absolute right-0 top-full mt-1.5 hidden group-hover:block z-10 w-56 p-2 bg-slate-800 text-white text-[11px] rounded shadow-lg text-center">
                  Notes must be at least 50 characters to review (currently {charCount}/50).
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Editor Body */}
        <div className="p-5">
          {/* Voice status strip while recording / transcribing */}
          {voice.status !== 'idle' && (
            <div
              aria-live="polite"
              className="mb-3 flex items-start gap-2 px-3.5 py-2.5 text-xs rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-900 dark:text-rose-200"
            >
              <span className="relative flex w-2 h-2 mt-1 shrink-0" aria-hidden="true">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
              </span>
              <Mic className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
              <span className="leading-relaxed">
                {voice.status === 'recording' ? (
                  <span>
                    Recording… click <span className="font-semibold">Stop</span> when done. Gemini
                    Flash transcribes it right after.
                  </span>
                ) : (
                  <span>Transcribing with Gemini… your words appear below in a moment.</span>
                )}
              </span>
            </div>
          )}

          {viewMode === 'write' ? (
            <textarea
              ref={textareaRef}
              value={notes}
              onChange={handleNotesChange}
              placeholder={SCAFFOLD_PLACEHOLDER}
              rows={12}
              className="w-full p-4 font-sans text-sm text-slate-900 dark:text-slate-100 bg-slate-50/60 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-y placeholder:text-slate-400 dark:placeholder:text-slate-600 leading-relaxed"
            />
          ) : (
            <div className="min-h-[280px] p-4 bg-slate-50/60 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-lg max-w-none text-slate-800 dark:text-slate-200">
              {notes.trim() ? (
                <MarkdownRenderer content={notes} />
              ) : (
                <div className="text-slate-400 dark:text-slate-600 italic text-sm py-8 text-center">
                  No notes written yet. Switch to "Write" to add notes.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Note Reviews History (FR-6.5) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Review History</span>
            <span className="px-2 py-0.5 text-xs font-mono font-semibold rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {noteReviews.length}
            </span>
          </h3>
          <span className="text-xs text-slate-400">Newest first</span>
        </div>

        {noteReviews.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 rounded-xl p-8 text-center text-slate-500 dark:text-slate-400">
            <HelpCircle className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
            <p className="text-sm font-medium">No note reviews yet</p>
            <p className="text-xs text-slate-400 mt-1">
              Write at least 50 characters of takeaways and click "Review my notes" to test whether
              your understanding will survive 3 weeks of forgetting.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {noteReviews.map((rev, index) => {
              const isLatest = index === 0;
              const isExpanded = expandedReviews[rev.id] ?? isLatest;
              const isSolid = rev.verdict === 'solid';

              return (
                <div
                  key={rev.id}
                  data-testid={`note-review-card-${rev.id}`}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden"
                >
                  {/* Summary / Header Row (Collapsible per FR-6.5) */}
                  <div
                    onClick={() => toggleReviewExpand(rev.id)}
                    className="px-5 py-3.5 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-100 dark:border-slate-800"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Verdict Badge */}
                      <span
                        className={`px-2.5 py-0.5 text-xs font-mono font-bold uppercase tracking-wider rounded border ${
                          isSolid
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                            : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                        }`}
                      >
                        {isSolid ? 'Solid' : 'Needs Work'}
                      </span>

                      {/* Stars */}
                      {renderStars(rev.rating)}

                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        {new Date(rev.createdAt).toLocaleString()}
                      </span>

                      {isLatest && (
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                          Latest
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                        {isExpanded ? 'Collapse' : 'Expand details'}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Review Body (FR-6.4) */}
                  {isExpanded && (
                    <div className="p-5 space-y-5 bg-slate-50/30 dark:bg-slate-900/30">
                      {/* Snapshot of notes as reviewed */}
                      <div className="bg-slate-100 dark:bg-slate-800/60 rounded-lg p-3 text-xs text-slate-600 dark:text-slate-300 font-mono border border-slate-200/60 dark:border-slate-700/60">
                        <span className="font-semibold block text-[11px] text-slate-500 uppercase tracking-wider mb-1">
                          Notes snapshot as reviewed:
                        </span>
                        <div className="line-clamp-3 whitespace-pre-wrap">{rev.notesSnapshot}</div>
                      </div>

                      {/* Rewritten Key Takeaway with Copy button */}
                      {rev.keyTakeaway && (
                        <div className="bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 rounded-xl p-4">
                          <div className="flex items-center justify-between gap-3 mb-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                              <Lightbulb className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                              Generalizable Key Takeaway
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyTakeaway(rev.id, rev.keyTakeaway);
                              }}
                              className="px-2.5 py-1 text-xs font-medium rounded-lg bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-slate-700 text-indigo-700 dark:text-indigo-300 transition-colors flex items-center gap-1 shadow-2xs"
                            >
                              {copiedTakeawayId === rev.id ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Copy takeaway</span>
                                </>
                              )}
                            </button>
                          </div>
                          <p className="text-sm text-indigo-950 dark:text-indigo-100 leading-relaxed font-medium">
                            "<MathText content={rev.keyTakeaway} />"
                          </p>
                        </div>
                      )}

                      {/* Corrections (claim, issue, fix) */}
                      {rev.corrections && rev.corrections.length > 0 && (
                        <div className="space-y-2.5">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                            <AlertCircle className="w-4 h-4" />
                            Corrections ({rev.corrections.length})
                          </h4>
                          <div className="space-y-2">
                            {rev.corrections.map((corr, cIdx) => (
                              <div
                                key={cIdx}
                                className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 rounded-lg p-3.5 text-xs space-y-1.5"
                              >
                                <div className="text-slate-800 dark:text-slate-200">
                                  <span className="font-semibold text-amber-800 dark:text-amber-400 mr-1.5">
                                    Flawed claim:
                                  </span>
                                  "<MathText content={corr.claim} />"
                                </div>
                                <div className="text-slate-700 dark:text-slate-300">
                                  <span className="font-semibold text-slate-500 mr-1.5">
                                    What's wrong:
                                  </span>
                                  <MathText content={corr.issue} />
                                </div>
                                <div className="text-emerald-800 dark:text-emerald-300 font-medium">
                                  <span className="font-semibold mr-1.5">Correction:</span>
                                  <MathText content={corr.correction} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Strengths & Gaps Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Strengths */}
                        <div className="bg-emerald-50/30 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 rounded-xl p-4 space-y-2">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Strengths
                          </h4>
                          <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                            {rev.strengths?.map((str, sIdx) => (
                              <li key={sIdx} className="flex items-start gap-1.5">
                                <span className="text-emerald-500 font-bold">•</span>
                                <span>
                                  <MathText content={str} />
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Gaps */}
                        <div className="bg-slate-100/60 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
                            Gaps to Address
                          </h4>
                          <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                            {rev.gaps?.map((gap, gIdx) => (
                              <li key={gIdx} className="flex items-start gap-1.5">
                                <span className="text-amber-500 font-bold">•</span>
                                <span>
                                  <MathText content={gap} />
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* 3 Recall Questions (Self-test cards per FR-6.4) */}
                      {rev.recallQuestions && rev.recallQuestions.length > 0 && (
                        <div className="space-y-2.5 pt-2 border-t border-slate-200/70 dark:border-slate-800">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                              <HelpCircle className="w-3.5 h-3.5 text-indigo-500" />
                              Recall Self-Quiz (3 Conceptual Questions)
                            </h4>
                            <span className="text-[11px] text-slate-400">
                              Answer mentally — no answers stored
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {rev.recallQuestions.map((q, qIdx) => (
                              <div
                                key={qIdx}
                                className="bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 flex flex-col justify-between shadow-2xs"
                              >
                                <span className="font-mono text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400 mb-1">
                                  Question #{qIdx + 1}
                                </span>
                                <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                                  <MathText content={q} />
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
