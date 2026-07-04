import { useAppStore } from '@/store/useAppStore';
import { hydrateKeywordRanking } from '@/lib/keywordHydration';
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

        updatedKeywords[index] = await hydrateKeywordRanking(
          {
            ...kw,
            popularity: truePopularity,
            popularitySource,
          },
          kw.appId,
          kw.region || 'us',
          competitors,
          { appendHistory: true }
        );

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
