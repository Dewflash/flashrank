import { useAppStore } from '@/store/useAppStore';
import {
  calculateDifficulty,
  calculateDifficultyScore,
  searchApps,
} from '@/lib/api';
import { isProviderReady } from '@/lib/credentials';

/**
 * Checks if 24 hours have passed since the last sync.
 */
function shouldSync(lastSyncTime: string | null): boolean {
  if (!lastSyncTime) return true;
  const lastSync = new Date(lastSyncTime).getTime();
  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  return now - lastSync > ONE_DAY_MS;
}

/**
 * Iterates through all tracked keywords, fetches their current iTunes rank,
 * and updates the keyword's rank history.
 */
interface SyncOptions {
  force?: boolean;
  appId?: string | null;
  region?: string;
}

export async function runBackgroundSync(options: SyncOptions = {}) {
  const store = useAppStore.getState();
  const { apps, keywords, lastSyncTime, setRefreshing, apiKeys } = store;

  if (!options.force && !shouldSync(lastSyncTime)) {
    return;
  }

  const syncIndexes = keywords
    .map((keyword, index) => ({ keyword, index }))
    .filter(({ keyword }) => {
      if (options.appId && keyword.appId !== options.appId) return false;
      if (options.region && keyword.region !== options.region) return false;
      return true;
    });

  if (syncIndexes.length === 0) {
    setRefreshing(true);
    // Just update the timestamp if there's nothing to sync
    useAppStore.setState({ lastSyncTime: new Date().toISOString() });
    setRefreshing(false);
    return;
  }

  setRefreshing(true);

  try {
    const updatedKeywords = [...keywords];
    const competitors = apps.filter((app) => {
      if (!app.isCompetitor) return false;
      if (options.region && app.region !== options.region) return false;
      return true;
    });
    const hasSearchAdsCredentials = isProviderReady(apiKeys, 'appleSearchAds');

    for (const { keyword: kw, index } of syncIndexes) {
      try {
        // Fetch deeper results so ranks beyond page one are not mislabeled.
        const results = await searchApps(kw.keyword, kw.region || 'us', 100);
        
        // Find our tracked app in the results
        const appIndex = results.findIndex((app) => app.id === kw.appId);
        const currentRank = appIndex !== -1 ? appIndex + 1 : null;
        const previousRank = kw.currentRank;
        
        let rankChange = null;
        if (currentRank !== null && previousRank !== null) {
          rankChange = previousRank - currentRank; // positive means moved up
        }

        // Fetch true popularity if Search Ads keys are available
        let truePopularity = kw.popularity;
        let popularitySource = kw.popularitySource ?? 'estimated';
        if (hasSearchAdsCredentials) {
          try {
            const asaRes = await fetch('/api/searchAds', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                clientId: apiKeys.asaClientId,
                teamId: apiKeys.asaTeamId,
                keyId: apiKeys.asaKeyId,
                privateKey: apiKeys.asaPrivateKey,
                keyword: kw.keyword,
              }),
            });
            if (asaRes.ok) {
              const asaData = await asaRes.json();
              truePopularity = asaData.data.popularity;
              popularitySource = asaData.data.source ?? 'apple-search-ads';
            }
          } catch (e) {
            console.error('Failed to fetch ASA popularity', e);
          }
        }

        const topAppsRatings = results.slice(0, 10).map((app) => app.ratingCount);
        const difficultyScore = calculateDifficultyScore(truePopularity, topAppsRatings);
        const difficulty = calculateDifficulty(truePopularity, topAppsRatings);
        const competitorRanks = competitors.reduce<Record<string, number | null>>(
          (acc, competitor) => {
            const competitorIndex = results.findIndex((app) => app.id === competitor.id);
            acc[competitor.id] = competitorIndex === -1 ? null : competitorIndex + 1;
            return acc;
          },
          {}
        );

        // Add to history
        const newHistoryEntry = {
          date: new Date().toISOString(),
          rank: currentRank,
        };

        const newHistory = [...kw.rankHistory, newHistoryEntry];
        
        // Keep only last 30 days
        if (newHistory.length > 30) {
          newHistory.shift();
        }

        updatedKeywords[index] = {
          ...kw,
          popularity: truePopularity,
          popularitySource,
          difficulty,
          difficultyScore,
          difficultySource: 'itunes-search',
          currentRank,
          previousRank,
          rankChange,
          rankHistory: newHistory,
          competitorRanks,
          rankSource: 'itunes-search',
          lastUpdated: new Date().toISOString(),
        };

        // Sleep to avoid rate limiting from iTunes API
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (e) {
        console.error(`Failed to sync keyword: ${kw.keyword}`, e);
      }
    }

    useAppStore.setState({
      keywords: updatedKeywords,
      lastSyncTime: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Background sync failed', err);
  } finally {
    setRefreshing(false);
  }
}
