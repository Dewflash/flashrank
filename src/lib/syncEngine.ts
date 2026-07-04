import { useAppStore } from '@/store/useAppStore';
import { describeRankStatus, hydrateKeywordRanking } from '@/lib/keywordHydration';
import { isProviderReady } from '@/lib/credentials';
import { isKeywordResearchScope } from '@/lib/keywordScope';

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
  const { apps, keywords, lastSyncTime, setRefreshing, setSyncProgress, apiKeys } = store;

  if (!options.force && !shouldSync(lastSyncTime)) {
    return;
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    setRefreshing(false);
    setSyncProgress({
      status: 'error',
      total: 0,
      completed: 0,
      currentKeyword: null,
      message: 'No Internet Connection',
    });
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
    setSyncProgress({
      status: 'complete',
      total: 0,
      completed: 0,
      currentKeyword: null,
      message: 'No keywords queued for refresh.',
    });
    // Just update the timestamp if there's nothing to sync
    useAppStore.setState({ lastSyncTime: new Date().toISOString() });
    setRefreshing(false);
    return;
  }

  setRefreshing(true);
  setSyncProgress({
    status: 'queued',
    total: syncIndexes.length,
    completed: 0,
    currentKeyword: null,
    message: `Queued ${syncIndexes.length} keyword${syncIndexes.length === 1 ? '' : 's'} for refresh.`,
  });

  try {
    const updatedKeywords = [...keywords];
    let failedCount = 0;
    const competitors = isKeywordResearchScope(options.appId)
      ? []
      : apps.filter((app) => {
          if (!app.isCompetitor) return false;
          if (options.region && app.region !== options.region) return false;
          return true;
        });
    const hasSearchAdsCredentials = isProviderReady(apiKeys, 'appleSearchAds');

    for (const [queueIndex, { keyword: kw, index }] of syncIndexes.entries()) {
      setSyncProgress({
        status: 'running',
        total: syncIndexes.length,
        completed: queueIndex,
        currentKeyword: kw.keyword,
        message: `Refreshing ${queueIndex + 1} of ${syncIndexes.length}: ${kw.keyword}`,
      });

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
          {
            appendHistory: true,
            hasSelectedApp: !isKeywordResearchScope(kw.appId),
          }
        );

        // Sleep to avoid rate limiting from iTunes API
        await new Promise((resolve) => setTimeout(resolve, 500));
        setSyncProgress({
          status: 'running',
          total: syncIndexes.length,
          completed: queueIndex + 1,
          currentKeyword: kw.keyword,
          message: `Refreshed ${queueIndex + 1} of ${syncIndexes.length}: ${kw.keyword}`,
        });
      } catch (e) {
        failedCount += 1;
        console.error(`Failed to sync keyword: ${kw.keyword}`, e);
        updatedKeywords[index] = {
          ...kw,
          ...describeRankStatus({
            currentRank: kw.currentRank,
            rankingResultCount: kw.rankingResultCount,
            sourceStatus: 'error',
            hasSelectedApp: !isKeywordResearchScope(kw.appId),
          }),
        };
        setSyncProgress({
          status: 'running',
          total: syncIndexes.length,
          completed: queueIndex + 1,
          currentKeyword: kw.keyword,
          message: `Skipped ${kw.keyword}; ranking data was unavailable.`,
        });
      }
    }

    useAppStore.setState({
      keywords: updatedKeywords,
      lastSyncTime: new Date().toISOString(),
    });

    setSyncProgress({
      status: failedCount > 0 ? 'error' : 'complete',
      total: syncIndexes.length,
      completed: syncIndexes.length,
      currentKeyword: null,
      message:
        failedCount > 0
          ? `${failedCount} keyword${failedCount === 1 ? '' : 's'} could not be refreshed. Previous ranks were preserved.`
          : `Refreshed ${syncIndexes.length} keyword${syncIndexes.length === 1 ? '' : 's'}.`,
    });
  } catch (err) {
    console.error('Background sync failed', err);
    setSyncProgress({
      status: 'error',
      total: syncIndexes.length,
      completed: 0,
      currentKeyword: null,
      message: 'Refresh failed. Previous ranks were preserved.',
    });
  } finally {
    setRefreshing(false);
  }
}
