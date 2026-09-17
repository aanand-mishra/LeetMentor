import React, { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, problemsRepo } from '../db';
import { SummaryBar } from '../components/home/SummaryBar';
import { FilterPanel } from '../components/home/FilterPanel';
import { ProblemTable } from '../components/home/ProblemTable';
import {
  ZeroProblemsEmptyState,
  NoFilterMatchesEmptyState,
} from '../components/home/EmptyStates';
import { useUrlFilters } from '../hooks/useUrlFilters';
import type { Status, Difficulty } from '../types';

export const HomePage: React.FC = () => {
  const { filters, page, setFilters, clearFilters } = useUrlFilters();

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
      filters.unresolvedReviewOnly,
      filters.sort,
    ]
  );

  const loading = filteredProblems === undefined;
  const currentProblems = filteredProblems ?? [];

  // Live query attempt counts for fast lookup on table rows
  const rawAttempts = useLiveQuery(() => db.attempts.toArray(), []);
  const attemptsCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (rawAttempts) {
      for (const att of rawAttempts) {
        map[att.problemId] = (map[att.problemId] || 0) + 1;
      }
    }
    return map;
  }, [rawAttempts]);

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
      {/* Summary Bar */}
      {hasAnyProblems && (
        <SummaryBar
          problems={allProblems}
          activeStatusFilter={filters.status}
          activeDifficultyFilter={filters.difficulty}
          onSelectStatus={(st: Status) => {
            const current = filters.status || [];
            const next = current.includes(st)
              ? current.filter((s) => s !== st)
              : [...current, st];
            setFilters({ status: next });
          }}
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
          attemptsCountMap={attemptsCountMap}
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
