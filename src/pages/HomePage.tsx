import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, problemsRepo, settingsRepo } from '../db';
import { SummaryBar } from '../components/home/SummaryBar';
import { FilterPanel } from '../components/home/FilterPanel';
import { ProblemTable } from '../components/home/ProblemTable';
import { WelcomeGuideBanner } from '../components/home/WelcomeGuideBanner';
import { ZeroProblemsEmptyState, NoFilterMatchesEmptyState } from '../components/home/EmptyStates';
import { useUrlFilters } from '../hooks/useUrlFilters';
import type { Difficulty } from '../types';
import { getProblemReviewStatus, isProblemOverdue } from '../utils/reviewScheduler';

export const HomePage: React.FC = () => {
  const { filters, page, setFilters, clearFilters } = useUrlFilters();

  // Query settings to determine if welcome/setup guide banner should be displayed
  const settings = useLiveQuery(() => db.settings.get('current'), []);
  const [isBannerDismissed, setIsBannerDismissed] = useState<boolean>(() => {
    try {
      return (
        sessionStorage.getItem('dsa_welcome_banner_dismissed') === 'true' ||
        localStorage.getItem('dsa_welcome_banner_dismissed') === 'true'
      );
    } catch {
      return false;
    }
  });

  const handleDismissBanner = () => {
    try {
      sessionStorage.setItem('dsa_welcome_banner_dismissed', 'true');
      localStorage.setItem('dsa_welcome_banner_dismissed', 'true');
    } catch {
      // Ignore
    }
    settingsRepo.update({ hasConfiguredApiKey: true }).catch(() => {});
    setIsBannerDismissed(true);
  };

  // Show banner only once until the API key is saved (or dismissed).
  // If later the user clears their key, hasConfiguredApiKey remains true, so it will not come back.
  const showWelcomeBanner =
    !isBannerDismissed &&
    settings !== undefined &&
    !settings.hasConfiguredApiKey &&
    (!settings.geminiApiKey || settings.geminiApiKey.trim() === '');

  // Live query all problems for summary stats & topic/pattern index
  const rawProblems = useLiveQuery(() => db.problems.toArray(), []);
  const allProblems = useMemo(() => rawProblems ?? [], [rawProblems]);

  // Live query filtered problems based on current filter values
  const filteredProblems = useLiveQuery(
    () => problemsRepo.list(filters),
    [
      filters.query,
      filters.difficulty?.join(','),
      filters.status?.join(','),
      filters.topics?.join(','),
      filters.patterns?.join(','),
      filters.confidence?.join(','),
      filters.starredOnly,
      filters.reviewQueueOnly,
      filters.overdueOnly,
      filters.sort,
    ]
  );

  const loading = filteredProblems === undefined;
  const currentProblems = filteredProblems ?? [];

  // Distinct topics and patterns across the dataset
  const allAvailableTopics = useMemo(() => {
    const set = new Set<string>();
    for (const p of allProblems) {
      p.topics?.forEach((t) => set.add(t));
    }
    return Array.from(set).sort();
  }, [allProblems]);

  const allAvailablePatterns = useMemo(() => {
    const set = new Set<string>();
    for (const p of allProblems) {
      p.patterns?.forEach((pt) => set.add(pt));
    }
    return Array.from(set).sort();
  }, [allProblems]);

  // Count problems due for spaced repetition revision
  const dueReviewCount = useMemo(() => {
    return allProblems.filter((p) => {
      if (p.status !== 'Solved') return false;
      const status = getProblemReviewStatus(p);
      return status.isDue;
    }).length;
  }, [allProblems]);

  // Count problems overdue for spaced repetition revision
  const overdueCount = useMemo(() => {
    return allProblems.filter((p) => isProblemOverdue(p)).length;
  }, [allProblems]);

  // Handle Star toggle directly on table
  const handleToggleStar = async (
    problemId: string,
    currentStarred: boolean,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    try {
      await problemsRepo.update(problemId, { starred: !currentStarred });
    } catch (err) {
      console.error('Failed to toggle star:', err);
    }
  };

  const hasAnyProblems = allProblems.length > 0;
  const hasFilterMatches = currentProblems.length > 0;

  return (
    <div className="space-y-4">
      {/* Welcome & Quick Start Guide Banner */}
      {showWelcomeBanner && <WelcomeGuideBanner onDismiss={handleDismissBanner} />}

      {/* Summary Bar */}
      {hasAnyProblems && (
        <SummaryBar
          problems={allProblems}
          activeDifficultyFilter={filters.difficulty}
          onSelectDifficulty={(diff: Difficulty) => {
            const current = filters.difficulty || [];
            const next = current.includes(diff)
              ? current.filter((d) => d !== diff)
              : [...current, diff];
            setFilters({ difficulty: next });
          }}
        />
      )}

      {/* Filter and Search Panel */}
      {hasAnyProblems && (
        <FilterPanel
          filters={filters}
          onFilterChange={(newFilters) => setFilters(newFilters)}
          onClearAll={clearFilters}
          allAvailableTopics={allAvailableTopics}
          allAvailablePatterns={allAvailablePatterns}
          dueReviewCount={dueReviewCount}
          overdueCount={overdueCount}
        />
      )}

      {/* Results / Empty States */}
      {!hasAnyProblems && !loading ? (
        <ZeroProblemsEmptyState />
      ) : !hasFilterMatches && !loading ? (
        <NoFilterMatchesEmptyState onClearFilters={clearFilters} />
      ) : (
        <ProblemTable
          problems={currentProblems}
          onToggleStar={handleToggleStar}
          page={page}
          pageSize={25}
          onPageChange={(newPage) => setFilters({}, newPage)}
        />
      )}
    </div>
  );
};

export default HomePage;
