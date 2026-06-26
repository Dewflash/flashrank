import type { AppMetadata, KeywordSuggestion } from '@/types';

// ---------------------------------------------------------------------------
// iTunes API response types (raw shape returned by Apple)
// ---------------------------------------------------------------------------

interface ITunesSearchResult {
  trackId: number;
  trackName: string;
  artistName: string;
  artworkUrl100: string;
  formattedPrice: string;
  averageUserRating: number;
  userRatingCount: number;
  primaryGenreName: string;
  bundleId: string;
  trackViewUrl: string;
}

interface ITunesSearchResponse {
  resultCount: number;
  results: ITunesSearchResult[];
}

interface SuggestionsResponse {
  suggestions: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map a raw iTunes result object to our internal `AppMetadata` shape.
 */
function mapToAppMetadata(item: ITunesSearchResult): AppMetadata {
  return {
    id: String(item.trackId),
    name: item.trackName,
    developer: item.artistName,
    icon: item.artworkUrl100,
    price: item.formattedPrice ?? 'Free',
    rating: item.averageUserRating ?? 0,
    ratingCount: item.userRatingCount ?? 0,
    category: item.primaryGenreName,
    platform: 'ios',
    bundleId: item.bundleId,
    url: item.trackViewUrl,
  };
}

// ---------------------------------------------------------------------------
// Public API functions
// ---------------------------------------------------------------------------

/**
 * Search for apps on the App Store via the local proxy API.
 *
 * @param term    - Search query string.
 * @param country - Two-letter country code (defaults to 'us').
 * @returns An array of `AppMetadata` objects.
 */
export async function searchApps(
  term: string,
  country: string = 'us'
): Promise<AppMetadata[]> {
  const params = new URLSearchParams({ term, country });
  const response = await fetch(`/api/search?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Search request failed with status ${response.status}`);
  }

  const data: ITunesSearchResponse = await response.json();
  return data.results.map(mapToAppMetadata);
}

/**
 * Look up a specific app by its App Store ID via the local proxy API.
 *
 * @param id      - The App Store ID (numeric string).
 * @param country - Two-letter country code (defaults to 'us').
 * @returns The `AppMetadata` for the app, or `null` if not found.
 */
export async function lookupApp(
  id: string,
  country: string = 'us'
): Promise<AppMetadata | null> {
  const params = new URLSearchParams({ id, country });
  const response = await fetch(`/api/lookup?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Lookup request failed with status ${response.status}`);
  }

  const data: ITunesSearchResponse = await response.json();

  if (data.resultCount === 0 || data.results.length === 0) {
    return null;
  }

  return mapToAppMetadata(data.results[0]);
}

/**
 * Fetch keyword suggestions for a given partial search term.
 *
 * @param term - The partial keyword to get suggestions for.
 * @returns An array of suggested keyword strings.
 */
export async function getKeywordSuggestions(
  term: string
): Promise<string[]> {
  const params = new URLSearchParams({ term });
  const response = await fetch(`/api/suggestions?${params.toString()}`);

  if (!response.ok) {
    throw new Error(
      `Suggestions request failed with status ${response.status}`
    );
  }

  const data: SuggestionsResponse = await response.json();
  return data.suggestions;
}

// ---------------------------------------------------------------------------
// Scoring / analytics utilities
// ---------------------------------------------------------------------------

/**
 * High-traffic keyword stems that tend to correlate with higher search volume.
 * Used to boost the simulated popularity score.
 */
const HIGH_TRAFFIC_PATTERNS = [
  'game',
  'photo',
  'video',
  'music',
  'social',
  'free',
  'chat',
  'ai',
  'fitness',
  'health',
  'finance',
  'weather',
  'food',
  'shop',
  'stream',
  'edit',
  'track',
  'learn',
  'map',
  'news',
];

/**
 * Calculate a simulated popularity score (1–100) for a keyword.
 *
 * The score is deterministic for the same input and uses a combination of
 * keyword length, character composition, and matches against common
 * high-traffic patterns. This is a heuristic stand-in for real Search Ads
 * popularity data.
 *
 * @param keyword - The keyword to score.
 * @returns A number between 1 and 100 (inclusive).
 */
export function calculatePopularity(keyword: string): number {
  const normalized = keyword.toLowerCase().trim();

  if (normalized.length === 0) return 1;

  // Base score from a simple string hash (deterministic pseudo-random)
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash * 31 + normalized.charCodeAt(i)) | 0;
  }
  let score = Math.abs(hash % 60) + 20; // 20–79 base range

  // Bonus: shorter keywords tend to be more popular (broader terms)
  if (normalized.length <= 4) {
    score += 15;
  } else if (normalized.length <= 8) {
    score += 8;
  } else if (normalized.length > 15) {
    score -= 10;
  }

  // Bonus: matches common high-traffic patterns
  const matchCount = HIGH_TRAFFIC_PATTERNS.filter((p) =>
    normalized.includes(p)
  ).length;
  score += matchCount * 7;

  // Penalty for very long tail queries (3+ words)
  const wordCount = normalized.split(/\s+/).length;
  if (wordCount >= 3) {
    score -= (wordCount - 2) * 8;
  }

  // Clamp to 1–100
  return Math.max(1, Math.min(100, score));
}

/**
 * Calculate a keyword difficulty rating based on popularity and competitive
 * landscape (represented by the top-ranked apps' rating counts).
 *
 * @param popularity      - The popularity score (1–100).
 * @param topAppsRatings  - An array of rating counts for the top-ranked apps
 *                          appearing for this keyword.
 * @returns `'low'` | `'medium'` | `'high'`.
 */
export function calculateDifficulty(
  popularity: number,
  topAppsRatings: number[]
): KeywordSuggestion['difficulty'] {
  // Average rating count of the top apps (default to 0 if no data)
  const avgRatings =
    topAppsRatings.length > 0
      ? topAppsRatings.reduce((sum, r) => sum + r, 0) / topAppsRatings.length
      : 0;

  // Composite score: weigh popularity (40%) and competition (60%)
  const competitionScore = Math.min(100, (avgRatings / 10_000) * 100);
  const composite = popularity * 0.4 + competitionScore * 0.6;

  if (composite >= 55) return 'high';
  if (composite >= 30) return 'medium';
  return 'low';
}
