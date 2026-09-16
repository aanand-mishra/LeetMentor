import { useSearchParams } from 'react-router-dom';
import { useMemo, useCallback } from 'react';
import type {
  ProblemFilterParams,
  Difficulty,
  Status,
  SortOption,
} from '../types';

export function useUrlFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Hydrate filters from URL search params (FR-2.6)
  const filters: ProblemFilterParams = useMemo(() => {
    const q = searchParams.get('q') || undefined;

    const diffParam = searchParams.get('difficulty');
    const difficulty = diffParam
      ? (diffParam.split(',').filter(Boolean) as Difficulty[])
      : undefined;

    const statusParam = searchParams.get('status');
    const status = statusParam
      ? (statusParam.split(',').filter(Boolean) as Status[])
      : undefined;

    const topicsParam = searchParams.get('topics');
    const topics = topicsParam ? topicsParam.split(',').filter(Boolean) : undefined;

    const patternsParam = searchParams.get('patterns');
    const patterns = patternsParam ? patternsParam.split(',').filter(Boolean) : undefined;

    const confParam = searchParams.get('confidence');
    const confidence = confParam
      ? (confParam
          .split(',')
          .map((c) => (c === 'unrated' ? 'unrated' : (parseInt(c, 10) as 1 | 2 | 3 | 4 | 5)))
          .filter(Boolean) as (1 | 2 | 3 | 4 | 5 | 'unrated')[])
      : undefined;

    const starredOnly = searchParams.get('starred') === 'true';
    const reviewQueueOnly = searchParams.get('reviewQueue') === 'true';
    const unresolvedReviewOnly = searchParams.get('unresolved') === 'true';
    const sort = (searchParams.get('sort') as SortOption) || undefined;

    return {
      query: q,
      difficulty,
      status,
      topics,
      patterns,
      confidence,
      starredOnly,
      reviewQueueOnly,
      unresolvedReviewOnly,
      sort,
    };
  }, [searchParams]);

  const page = useMemo(() => {
    const p = parseInt(searchParams.get('page') || '1', 10);
    return isNaN(p) || p < 1 ? 1 : p;
  }, [searchParams]);

  // Update filters and serialize back into URL search params
  const setFilters = useCallback(
    (newFilters: Partial<ProblemFilterParams>, newPage?: number) => {
      const merged: ProblemFilterParams = {
        ...filters,
        ...newFilters,
      };

      const params = new URLSearchParams();

      if (merged.query && merged.query.trim()) {
        params.set('q', merged.query.trim());
      }
      if (merged.difficulty && merged.difficulty.length > 0) {
        params.set('difficulty', merged.difficulty.join(','));
      }
      if (merged.status && merged.status.length > 0) {
        params.set('status', merged.status.join(','));
      }
      if (merged.topics && merged.topics.length > 0) {
        params.set('topics', merged.topics.join(','));
      }
      if (merged.patterns && merged.patterns.length > 0) {
        params.set('patterns', merged.patterns.join(','));
      }
      if (merged.confidence && merged.confidence.length > 0) {
        params.set('confidence', merged.confidence.join(','));
      }
      if (merged.starredOnly) {
        params.set('starred', 'true');
      }
      if (merged.reviewQueueOnly) {
        params.set('reviewQueue', 'true');
      }
      if (merged.unresolvedReviewOnly) {
        params.set('unresolved', 'true');
      }
      if (merged.sort && merged.sort !== 'dateAdded_desc') {
        params.set('sort', merged.sort);
      }

      const targetPage = newPage !== undefined ? newPage : 1;
      if (targetPage > 1) {
        params.set('page', String(targetPage));
      }

      setSearchParams(params, { replace: true });
    },
    [filters, setSearchParams]
  );

  const clearFilters = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);

  return {
    filters,
    page,
    setFilters,
    clearFilters,
  };
}
