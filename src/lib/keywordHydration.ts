import type {
  AppMetadata,
  KeywordTag,
  RankingAppSnapshot,
  TrackedApp,
  TrackedKeyword,
} from '@/types';
import {
  calculateDifficulty,
  calculateDifficultyScore,
  calculatePopularity,
  getKeywordSuggestions,
  searchApps,
} from '@/lib/api';

interface BuildStarterKeywordOptions {
  app: TrackedApp;
  region: string;
  existingKeywords: TrackedKeyword[];
  tags: KeywordTag[];
  competitors?: TrackedApp[];
  limit?: number;
}

export interface RankingSignals {
  rankingApps: RankingAppSnapshot[];
  currentRank: number | null;
  competitorRanks: Record<string, number | null>;
  topRatings: number[];
  sourceStatus: 'ok' | 'error';
}

const BLOCKED_TERMS = new Set(['suggestions', 'software', 'itunes', 'app store', 'search']);

export function isBlockedKeyword(value: string): boolean {
  return BLOCKED_TERMS.has(normalizeTerm(value));
}

export function slugifyKeyword(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'keyword';
}

function normalizeTerm(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function uniqueTerms(values: string[]): string[] {
  const seen = new Set<string>();

  return values
    .map(normalizeTerm)
    .filter((value) => {
      if (value.length < 2 || value.length > 80) return false;
      if (BLOCKED_TERMS.has(value)) return false;
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
}

function seedTermsForApp(app: TrackedApp): string[] {
  const name = normalizeTerm(app.name);
  const words = name.split(/\s+/).filter((word) => word.length > 2);
  const category = normalizeTerm(app.category);

  return uniqueTerms([
    name,
    ...words,
    `${name} app`,
    `${name} game`,
    `${name} tips`,
    `${name} guide`,
    `${category} apps`,
    `best ${category} apps`,
  ]).slice(0, 8);
}

export function buildRankingSignals(
  results: AppMetadata[],
  selectedAppId: string,
  competitors: TrackedApp[] = []
): RankingSignals {
  const competitorIds = new Set(competitors.map((competitor) => competitor.id));
  const rankingApps = results.slice(0, 20).map<RankingAppSnapshot>((app, index) => ({
    rank: index + 1,
    appId: app.id,
    appName: app.name,
    appIcon: app.icon,
    developer: app.developer,
    rating: app.rating,
    ratingCount: app.ratingCount,
    bundleId: app.bundleId,
    url: app.url,
    isSelectedApp: app.id === selectedAppId,
    isTrackedCompetitor: competitorIds.has(app.id),
  }));
  const selectedIndex = results.findIndex((app) => app.id === selectedAppId);
  const competitorRanks = competitors.reduce<Record<string, number | null>>(
    (acc, competitor) => {
      const competitorIndex = results.findIndex((app) => app.id === competitor.id);
      acc[competitor.id] = competitorIndex === -1 ? null : competitorIndex + 1;
      return acc;
    },
    {}
  );

  return {
    rankingApps,
    currentRank: selectedIndex === -1 ? null : selectedIndex + 1,
    competitorRanks,
    topRatings: results.slice(0, 10).map((app) => app.ratingCount),
    sourceStatus: 'ok',
  };
}

export async function fetchRankingSignals(
  keyword: string,
  selectedAppId: string,
  region: string,
  competitors: TrackedApp[] = [],
  limit = 100
): Promise<RankingSignals> {
  let results: AppMetadata[] = [];
  try {
    results = await searchApps(keyword, region, limit);
  } catch {
    return {
      rankingApps: [],
      currentRank: null,
      competitorRanks: competitors.reduce<Record<string, number | null>>((acc, competitor) => {
        acc[competitor.id] = null;
        return acc;
      }, {}),
      topRatings: [],
      sourceStatus: 'error',
    };
  }

  return buildRankingSignals(results, selectedAppId, competitors);
}

export function updateTrackedFlags(
  rankingApps: RankingAppSnapshot[] | undefined,
  selectedAppId: string,
  competitors: TrackedApp[]
): RankingAppSnapshot[] {
  const competitorIds = new Set(competitors.map((competitor) => competitor.id));

  return (rankingApps ?? []).map((app) => ({
    ...app,
    isSelectedApp: app.appId === selectedAppId,
    isTrackedCompetitor: competitorIds.has(app.appId),
  }));
}

export async function hydrateKeywordRanking(
  keyword: TrackedKeyword,
  selectedAppId: string,
  region: string,
  competitors: TrackedApp[],
  options: { appendHistory?: boolean } = {}
): Promise<TrackedKeyword> {
  const signals = await fetchRankingSignals(keyword.keyword, selectedAppId, region, competitors, 100);
  if (signals.sourceStatus === 'error') {
    throw new Error(`Ranking search failed for "${keyword.keyword}"`);
  }

  const popularity = keyword.popularity;
  const difficultyScore = calculateDifficultyScore(popularity, signals.topRatings);
  const previousRank = keyword.currentRank;
  const rankChange =
    previousRank !== null && signals.currentRank !== null
      ? previousRank - signals.currentRank
      : null;
  const historyEntry = {
    date: new Date().toISOString(),
    rank: signals.currentRank,
  };
  const rankHistory = options.appendHistory
    ? [...keyword.rankHistory, historyEntry].slice(-30)
    : keyword.rankHistory.length > 0
      ? keyword.rankHistory
      : [historyEntry];

  return {
    ...keyword,
    region,
    currentRank: signals.currentRank,
    previousRank,
    rankChange,
    difficulty: calculateDifficulty(popularity, signals.topRatings),
    difficultyScore,
    difficultySource: 'itunes-search',
    competitorRanks: signals.competitorRanks,
    rankingApps: signals.rankingApps,
    rankHistory,
    rankSource: 'itunes-search',
    lastUpdated: new Date().toISOString(),
  };
}

export async function buildStarterKeywordsForApp({
  app,
  region,
  existingKeywords,
  tags,
  competitors = [],
  limit = 10,
}: BuildStarterKeywordOptions): Promise<TrackedKeyword[]> {
  const existing = new Set(
    existingKeywords
      .filter((keyword) => keyword.appId === app.id && keyword.region === region)
      .map((keyword) => keyword.keyword.toLowerCase())
  );
  const genericTag = tags.find((tag) => tag.name.toLowerCase() === 'generic');
  const brandTag = tags.find((tag) => tag.name.toLowerCase() === 'brand');
  const seeds = seedTermsForApp(app);
  const hinted = await Promise.all(
    seeds.slice(0, 5).map(async (seed) => {
      try {
        return await getKeywordSuggestions(seed);
      } catch {
        return [];
      }
    })
  );
  const candidates = uniqueTerms([...seeds, ...hinted.flat()])
    .filter((keyword) => !existing.has(keyword))
    .slice(0, Math.max(limit * 2, limit));
  const starterKeywords: TrackedKeyword[] = [];

  for (const keyword of candidates) {
    if (starterKeywords.length >= limit) break;

    const signals = await fetchRankingSignals(keyword, app.id, region, competitors, 100);
    const popularity = calculatePopularity(keyword);
    const difficultyScore = calculateDifficultyScore(popularity, signals.topRatings);
    const firstNameToken = normalizeTerm(app.name).split(/\s+/)[0];
    const isBrandTerm = firstNameToken.length > 0 && keyword.includes(firstNameToken);

    starterKeywords.push({
      id: `kw-${region}-${app.id}-${slugifyKeyword(keyword)}`,
      keyword,
      appId: app.id,
      region,
      popularity,
      popularitySource: 'estimated',
      difficulty: calculateDifficulty(popularity, signals.topRatings),
      difficultyScore,
      difficultySource: 'itunes-search',
      currentRank: signals.currentRank,
      previousRank: null,
      rankChange: null,
      rankSource: 'itunes-search',
      competitorRanks: signals.competitorRanks,
      rankingApps: signals.rankingApps,
      tags: isBrandTerm && brandTag ? [brandTag] : genericTag ? [genericTag] : [],
      note: null,
      rankHistory: [
        {
          date: new Date().toISOString(),
          rank: signals.currentRank,
        },
      ],
      lastUpdated: new Date().toISOString(),
      addedAt: new Date().toISOString(),
    });
  }

  return starterKeywords;
}
