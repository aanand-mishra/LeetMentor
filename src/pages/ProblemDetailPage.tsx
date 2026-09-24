import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { BookOpen, Code2, Sparkles, Eye, FileText, RotateCcw } from 'lucide-react';
import { db, problemsRepo } from '../db';
import { ProblemDetailHeader } from '../components/problem/ProblemDetailHeader';
import { OverviewTab } from '../components/problem/OverviewTab';
import { ConfidenceRatingModal } from '../components/problem/ConfidenceRatingModal';
import { useToast } from '../hooks/useToast';
import type { Problem } from '../types';

// Tab type
type TabKey = 'overview' | 'attempts' | 'mentor' | 'visualize' | 'notes' | 'revisions';

// Lazy or placeholder imports for later phases
import { AttemptsTab } from '../components/problem/AttemptsTab';
import { MentorTab } from '../components/problem/MentorTab';
import { VisualizeTab } from '../components/problem/VisualizeTab';
import { NotesTab } from '../components/problem/NotesTab';
import { RevisionsTab } from '../components/problem/RevisionsTab';
import { StartRevisionModal } from '../components/problem/StartRevisionModal';

export const ProblemDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();

  const getInitialTab = (): TabKey => {
    const hash = (location.hash || '').replace('#', '') as TabKey;
    return ['overview', 'attempts', 'mentor', 'visualize', 'notes', 'revisions'].includes(hash)
      ? hash
      : 'overview';
  };

  const [activeTab, setActiveTab] = useState<TabKey>(getInitialTab);
  const [confidenceModalOpen, setConfidenceModalOpen] = useState(false);
  const [isStartRevisionOpen, setIsStartRevisionOpen] = useState(false);
  const [isNotesDirty, setIsNotesDirty] = useState(false);

  // Sync active tab with URL hash (#overview, #attempts, #mentor, #visualize, #notes, #revisions) (FR-3.1)
  useEffect(() => {
    const hash = location.hash.replace('#', '') as TabKey;
    if (['overview', 'attempts', 'mentor', 'visualize', 'notes', 'revisions'].includes(hash)) {
      setActiveTab(hash);
    } else {
      setActiveTab('overview');
    }
  }, [location.hash]);

  const setTab = (tab: TabKey) => {
    // If navigating away from notes with unsaved changes, confirm first (FR-3.2)
    if (activeTab === 'notes' && tab !== 'notes' && isNotesDirty) {
      const confirmLeave = window.confirm('You have unsaved changes in notes. Leave anyway?');
      if (!confirmLeave) return;
    }
    setActiveTab(tab);
    navigate(`/problem/${id}#${tab}`, { replace: true });
  };

  // Browser beforeunload warning if notes are unsaved (FR-3.2)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isNotesDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isNotesDirty]);

  // Live queries for this problem and related tables
  const problem = useLiveQuery(() => (id ? db.problems.get(id) : undefined), [id]);
  const attempts =
    useLiveQuery(() => (id ? db.attempts.where('problemId').equals(id).toArray() : []), [id]) || [];
  const mentorMessages =
    useLiveQuery(
      () => (id ? db.mentorMessages.where('problemId').equals(id).toArray() : []),
      [id]
    ) || [];
  const noteReviews =
    useLiveQuery(() => (id ? db.noteReviews.where('problemId').equals(id).toArray() : []), [id]) ||
    [];
  const revisions =
    useLiveQuery(() => (id ? db.revisions.where('problemId').equals(id).toArray() : []), [id]) ||
    [];

  // Sorted attempts (newest first)
  const sortedAttempts = [...attempts].sort((a, b) => b.attemptNumber - a.attemptNumber);
  // Sorted mentor messages
  const sortedMentor = [...mentorMessages].sort((a, b) => a.level - b.level);
  // Sorted note reviews (newest first)
  const sortedNoteReviews = [...noteReviews].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const handleProblemUpdated = useCallback(() => {
    // Dexie useLiveQuery automatically updates state
  }, []);

  const handleSaveTimeSpent = async (minutes: number) => {
    if (!id) return;
    try {
      await problemsRepo.update(id, { timeSpentMinutes: minutes });
      handleProblemUpdated();
      toast.success(`Logged ${minutes} min time spent.`);
    } catch (err) {
      console.error('Failed to save time spent:', err);
    }
  };

  const handleSelectConfidence = async (conf: 1 | 2 | 3 | 4 | 5) => {
    if (!id) return;
    try {
      await problemsRepo.update(id, { confidence: conf });
      setConfidenceModalOpen(false);
      toast.success(`Confidence set to ${conf}/5`);
    } catch (err) {
      console.error('Failed to set confidence:', err);
    }
  };

  if (problem === undefined) {
    return (
      <div className="py-12 text-center text-sm text-slate-400 dark:text-slate-500">
        Loading problem details...
      </div>
    );
  }

  if (problem === null) {
    return (
      <div className="py-12 text-center">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Problem Not Found</h2>
        <p className="text-sm text-slate-500 mt-2">
          The problem you are looking for does not exist.
        </p>
        <Link to="/" className="inline-block mt-4 text-indigo-600 dark:text-indigo-400 font-medium">
          Back to Problem List
        </Link>
      </div>
    );
  }

  // Hint level indicator for tab badge (e.g. 2 hints unlocked)
  const hintsUsed = problem.hintsUsed || 0;
  const latestNoteReview = sortedNoteReviews[0];

  return (
    <div className="space-y-6">
      {/* Sticky Header */}
      <ProblemDetailHeader
        problem={problem as Problem}
        onProblemUpdated={handleProblemUpdated}
        onOpenConfidenceModal={() => setConfidenceModalOpen(true)}
        onReviseNow={() => setIsStartRevisionOpen(true)}
      />

      {/* Tab Strip (FR-3) */}
      <div className="border-b border-slate-200/90 dark:border-slate-800 flex items-center gap-2">
        <div className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto no-scrollbar pb-px flex-1 min-w-0">
        {/* Overview Tab */}
        <button
          type="button"
          onClick={() => setTab('overview')}
          className={`px-3.5 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-2 shrink-0 cursor-pointer rounded-t-lg ${
            activeTab === 'overview'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/20'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-slate-800/40'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Overview</span>
        </button>

        {/* Attempts Tab */}
        <button
          type="button"
          onClick={() => setTab('attempts')}
          className={`px-3.5 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-2 shrink-0 cursor-pointer rounded-t-lg ${
            activeTab === 'attempts'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/20'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-slate-800/40'
          }`}
        >
          <Code2 className="w-4 h-4" />
          <span>Attempts</span>
          <span className="px-1.5 py-0.2 text-xs font-mono font-bold rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
            {attempts.length}
          </span>
        </button>

        {/* Mentor Tab */}
        <button
          type="button"
          onClick={() => setTab('mentor')}
          className={`px-3.5 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-2 shrink-0 cursor-pointer rounded-t-lg ${
            activeTab === 'mentor'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/20'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-slate-800/40'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>Mentor</span>
          {hintsUsed > 0 ? (
            <span className="px-1.5 py-0.2 text-xs font-mono font-bold rounded-md bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800">
              L{hintsUsed}/4
            </span>
          ) : (
            <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
          )}
        </button>

        {/* Visualize Tab */}
        <button
          type="button"
          onClick={() => setTab('visualize')}
          className={`px-3.5 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-2 shrink-0 cursor-pointer rounded-t-lg ${
            activeTab === 'visualize'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/20'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-slate-800/40'
          }`}
        >
          <Eye className="w-4 h-4" />
          <span>Visualize</span>
        </button>

        {/* Notes Tab */}
        <button
          type="button"
          onClick={() => setTab('notes')}
          className={`px-3.5 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-2 shrink-0 cursor-pointer rounded-t-lg ${
            activeTab === 'notes'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/20'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-slate-800/40'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Notes</span>
          {latestNoteReview && (
            <span className="px-1.5 py-0.2 text-xs font-mono font-bold rounded-md bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              ★ {latestNoteReview.rating}
            </span>
          )}
        </button>

        {/* Revisions & Deep Analytics Tab */}
        <button
          type="button"
          onClick={() => setTab('revisions')}
          className={`px-3.5 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-2 shrink-0 cursor-pointer rounded-t-lg ${
            activeTab === 'revisions'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/20'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-slate-800/40'
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          <span>Revisions</span>
          {revisions.length > 0 ? (
            <span className="px-1.5 py-0.2 text-xs font-mono font-bold rounded-full bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              {revisions.length}
            </span>
          ) : (
            <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
          )}
        </button>
        </div>

        {/* Revise Now — right-aligned beside the tab strip */}
        <button
          type="button"
          onClick={() => setIsStartRevisionOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/70 dark:hover:bg-indigo-900/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-[0.98] shrink-0 self-center mb-1"
          title="Archive current session into history and test again with a clean slate"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Revise Now</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === 'overview' && (
          <OverviewTab
            problem={problem as Problem}
            attempts={sortedAttempts}
            mentorMessages={sortedMentor}
            noteReviews={sortedNoteReviews}
            onProblemUpdated={handleProblemUpdated}
          />
        )}

        {activeTab === 'attempts' && (
          <AttemptsTab
            problem={problem as Problem}
            attempts={sortedAttempts}
            onProblemUpdated={handleProblemUpdated}
          />
        )}

        {activeTab === 'mentor' && (
          <MentorTab
            problem={problem as Problem}
            mentorMessages={sortedMentor}
            latestAttempt={sortedAttempts[0]}
            onProblemUpdated={handleProblemUpdated}
          />
        )}

        {activeTab === 'visualize' && (
          <VisualizeTab
            problem={problem as Problem}
            latestAttempt={sortedAttempts[0]}
            onProblemUpdated={handleProblemUpdated}
          />
        )}

        {activeTab === 'notes' && (
          <NotesTab
            problem={problem as Problem}
            noteReviews={sortedNoteReviews}
            onProblemUpdated={handleProblemUpdated}
            onDirtyChange={setIsNotesDirty}
          />
        )}

        {activeTab === 'revisions' && (
          <RevisionsTab
            problem={problem as Problem}
            revisions={revisions}
            activeAttempts={sortedAttempts}
            onProblemUpdated={handleProblemUpdated}
          />
        )}
      </div>

      {/* Solved Completion Modal: Time Spent (Step 1) -> Confidence (Step 2) */}
      <ConfidenceRatingModal
        isOpen={confidenceModalOpen}
        initialTimeSpent={problem.timeSpentMinutes}
        onSaveTimeSpent={handleSaveTimeSpent}
        onSelectConfidence={handleSelectConfidence}
        onSkip={() => setConfidenceModalOpen(false)}
      />

      {/* Start Fresh Revision Modal */}
      <StartRevisionModal
        isOpen={isStartRevisionOpen}
        problem={problem as Problem}
        attempts={sortedAttempts}
        onClose={() => setIsStartRevisionOpen(false)}
        onRevisionStarted={() => {
          handleProblemUpdated();
          setTab('attempts');
        }}
      />
    </div>
  );
};

export default ProblemDetailPage;
