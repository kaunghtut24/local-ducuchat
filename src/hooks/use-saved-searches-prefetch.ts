import { useEffect, useState, useCallback } from 'react'
import { useAuthSession } from './useAuthSession';
import { SearchFilters } from '@/types'
import { useOpportunitiesStore } from '@/stores/opportunities-store'
import { useNotify } from '@/contexts/notification-context'

interface SavedSearch {
  id: string
  name: string
  description?: string
  filters: SearchFilters
  isFavorite: boolean
  isDefault: boolean
  isShared: boolean
  lastUsedAt?: string
}

interface PrefetchData {
  savedSearches: SavedSearch[]
  defaultSearch?: SavedSearch
  cachedMatchScores: Record<string, any>
  recentOpportunityIds: string[]
}

export function useSavedSearchesPrefetch() {
  const { session, loading: sessionLoading } = useAuthSession();
  const user = session?.user;
  const notify = useNotify();
  const [prefetchData, setPrefetchData] = useState<PrefetchData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasPrefetched, setHasPrefetched] = useState(false);
  const [hasAppliedDefault, setHasAppliedDefault] = useState(false);

  // Store actions
  const setMatchScores = useOpportunitiesStore(state => state.setMatchScores);
  const setMatchScoreDetails = useOpportunitiesStore(state => state.setMatchScoreDetails);
  const setSearchFilters = useOpportunitiesStore(state => state.setSearchFilters);
  const fetchOpportunities = useOpportunitiesStore(state => state.fetchOpportunities);

  // Prefetch data on mount
  const performPrefetch = useCallback(async () => {
    if (!user || hasPrefetched || sessionLoading) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/v1/saved-searches/prefetch', {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          console.log('User not authenticated for prefetch');
          setHasPrefetched(true); // Prevent retry
          return;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setPrefetchData(result.data);
        setHasPrefetched(true);

        // Apply cached match scores immediately
        if (result.data.cachedMatchScores && Object.keys(result.data.cachedMatchScores).length > 0) {
          console.log('🚀 Applying prefetched match scores:', Object.keys(result.data.cachedMatchScores).length);
          
          // Convert to the format expected by the store
          const scores: Record<string, number> = {};
          const details: Record<string, any> = {};
          
          Object.entries(result.data.cachedMatchScores).forEach(([oppId, data]: [string, any]) => {
            scores[oppId] = data.score;
            details[oppId] = data;
          });
          
          setMatchScores(scores);
          setMatchScoreDetails(details);
        }

        // Apply default search if available and not yet applied
        if (!hasAppliedDefault && result.data.defaultSearch) {
          console.log('🌟 Auto-applying default search:', result.data.defaultSearch.name);
          await applyDefaultSearch(result.data.defaultSearch);
          setHasAppliedDefault(true);
        }
      } else {
        console.warn('Prefetch API returned success=false:', result.error);
        setHasPrefetched(true); // Prevent retry
      }
    } catch (error) {
      console.error('Error prefetching data:', error);
      // Mark as prefetched to prevent infinite retry
      setHasPrefetched(true);
      
      // Fallback to empty data structure
      setPrefetchData({
        savedSearches: [],
        cachedMatchScores: {},
        recentOpportunityIds: []
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, hasPrefetched, hasAppliedDefault, sessionLoading, setMatchScores, setMatchScoreDetails]);

  // Apply default search
  const applyDefaultSearch = useCallback(async (search: SavedSearch) => {
    try {
      // Execute the saved search to get updated filters
      const response = await fetch(`/api/v1/saved-searches/${search.id}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        // Apply filters and fetch opportunities
        setSearchFilters(result.data.filters);
        await fetchOpportunities(result.data.filters, 1, false);
        
        // Silent notification - don't interrupt the user
        console.log(`✅ Applied default search: ${search.name}`);
      }
    } catch (error) {
      console.error('Error applying default search:', error);
    }
  }, [setSearchFilters, fetchOpportunities]);

  // Prefetch on user load
  useEffect(() => {
    if (!sessionLoading && user && !hasPrefetched) {
      performPrefetch();
    } else if (!sessionLoading && !user) {
      // No user (not authenticated), just set empty data
      setHasPrefetched(true);
      setPrefetchData({
        savedSearches: [],
        cachedMatchScores: {},
        recentOpportunityIds: []
      });
    }
  }, [sessionLoading, user, hasPrefetched, performPrefetch]);

  return {
    savedSearches: prefetchData?.savedSearches || [],
    defaultSearch: prefetchData?.defaultSearch,
    cachedMatchScores: prefetchData?.cachedMatchScores || {},
    isLoading,
    hasPrefetched,
    refetch: performPrefetch
  }
}