import { useAppStore } from '@/store/useAppStore';
import { searchApps } from '@/lib/api';
import { TrackedKeyword } from '@/types';

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
export async function runBackgroundSync() {
  const store = useAppStore.getState();
  const { keywords, lastSyncTime, setRefreshing, apiKeys } = store;

  if (!shouldSync(lastSyncTime)) {
    return;
  }

  if (keywords.length === 0) {
    setRefreshing(true);
    // Just update the timestamp if there's nothing to sync
    useAppStore.setState({ lastSyncTime: new Date().toISOString() });
    setRefreshing(false);
    return;
  }

  setRefreshing(true);

  try {
    const updatedKeywords = [...keywords];

    for (let i = 0; i < updatedKeywords.length; i++) {
      const kw = updatedKeywords[i];
      try {
        // Fetch top 50 apps for this keyword in its region
        const results = await searchApps(kw.keyword, kw.region || 'us');
        
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
        if (apiKeys.asaClientId && apiKeys.asaTeamId && apiKeys.asaKeyId && apiKeys.asaPrivateKey) {
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
            }
          } catch (e) {
            console.error('Failed to fetch ASA popularity', e);
          }
        }

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

        updatedKeywords[i] = {
          ...kw,
          popularity: truePopularity,
          currentRank,
          previousRank,
          rankChange,
          rankHistory: newHistory,
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
