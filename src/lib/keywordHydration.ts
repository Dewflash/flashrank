import type { AppMetadata, KeywordTag, TrackedApp, TrackedKeyword } from '@/types';
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

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'keyword';
}

function uniqueTerms(values: string[]): string[] {
  const seen = new Set<string>();
  return values
    .map((value) => value.toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((value) => {
      if (value.length < 2 || seen.has(value)) return false;
      seen.add(value);
      return true;
    });
}

function seedTermsForApp(app: TrackedApp): string[] {
  const name = app.name.toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim();
  const words = name.split(/\s+/).filter((word) => word.length > 2);
  const category = app.category.toLowerCase();

  return uniqueTerms([
    name,
    ...words,
    `${name} app`,
    `${name} game`,
    `${name} tips`,
    `${name} guide`,
    `${category} apps`,
    `best ${category.toLowerCase()} apps`,
  ]).slice(0, 8);
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

    let results: AppMetadata[] = [];
    try {
      results = await searchApps(keyword, region, 40);
    } catch {
      results = [];
    }

    const appIndex = results.findIndex((result) => result.id === app.id);
    const topRatings = results.slice(0, 10).map((result) => result.ratingCount);
    const popularity = calculatePopularity(keyword);
    const difficultyScore = calculateDifficultyScore(popularity, topRatings);
    const competitorRanks = competitors.reduce<Record<string, number | null>>(
      (acc, competitor) => {
        const competitorIndex = results.findIndex((result) => result.id === competitor.id);
        acc[competitor.id] = competitorIndex === -1 ? null : competitorIndex + 1;
        return acc;
      },
      {}
    );
    const isBrandTerm = keyword.includes(app.name.toLowerCase().split(/\s+/)[0]);

    starterKeywords.push({
      id: `kw-${region}-${app.id}-${slugify(keyword)}`,
      keyword,
      appId: app.id,
      region,
      popularity,
      popularitySource: 'estimated',
      difficulty: calculateDifficulty(popularity, topRatings),
      difficultyScore,
      difficultySource: 'itunes-search',
      currentRank: appIndex === -1 ? null : appIndex + 1,
      previousRank: null,
      rankChange: null,
      rankSource: 'itunes-search',
      competitorRanks,
      tags: isBrandTerm && brandTag ? [brandTag] : genericTag ? [genericTag] : [],
      note: null,
      rankHistory: [
        {
          date: new Date().toISOString(),
          rank: appIndex === -1 ? null : appIndex + 1,
        },
      ],
      lastUpdated: new Date().toISOString(),
      addedAt: new Date().toISOString(),
    });
  }

  return starterKeywords;
}
