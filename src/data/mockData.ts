// Mock data for FlashRank — realistic App Store Optimization dataset
import {
  TrackedApp,
  TrackedKeyword,
  KeywordTag,
  RankHistoryEntry,
  KeywordNote,
} from '@/types';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Generate an ISO date string N days ago from today */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
}

/** Build 30-day rank history with realistic daily fluctuations.
 *  @param baseRank  – the approximate average rank
 *  @param trend     – 'improving' | 'declining' | 'stable'
 *  @param variance  – max random daily fluctuation (default 3)
 */
function generateRankHistory(
  baseRank: number,
  trend: 'improving' | 'declining' | 'stable',
  variance = 3,
): RankHistoryEntry[] {
  const history: RankHistoryEntry[] = [];
  let rank = trend === 'improving'
    ? baseRank + 8
    : trend === 'declining'
      ? Math.max(1, baseRank - 6)
      : baseRank;

  for (let i = 29; i >= 0; i--) {
    // Apply trend drift
    if (trend === 'improving') {
      rank -= 0.25 + Math.random() * 0.15;
    } else if (trend === 'declining') {
      rank += 0.2 + Math.random() * 0.15;
    }

    // Daily noise
    const noise = Math.round((Math.random() - 0.5) * 2 * variance);
    const finalRank = Math.max(1, Math.round(rank + noise));

    history.push({ date: daysAgo(i), rank: finalRank });
  }

  return history;
}

// ─── Tags ───────────────────────────────────────────────────────────────────

export const mockTags: KeywordTag[] = [
  { id: 'tag-brand',       name: 'Brand',         color: '#6366F1' }, // indigo
  { id: 'tag-generic',     name: 'Generic',       color: '#0EA5E9' }, // sky
  { id: 'tag-longtail',    name: 'Long-tail',     color: '#10B981' }, // emerald
  { id: 'tag-competitor',  name: 'Competitor',    color: '#F59E0B' }, // amber
  { id: 'tag-priority',    name: 'High Priority', color: '#EF4444' }, // red
];

// Quick look-up helpers
const TAG = Object.fromEntries(mockTags.map(t => [t.id.replace('tag-', ''), t]));

// ─── Apps ───────────────────────────────────────────────────────────────────

export const mockApps: TrackedApp[] = [
  {
    id: 'app-focus-timer',
    name: 'Focus Timer — Deep Work',
    developer: 'Stellar Apps LLC',
    icon: '/icons/focus-timer.png',
    price: 'Free',
    rating: 4.8,
    ratingCount: 12_430,
    category: 'Productivity',
    platform: 'ios',
    bundleId: 'com.stellarapps.focustimer',
    url: 'https://apps.apple.com/app/focus-timer-deep-work/id1234567890',
    isCompetitor: false,
    addedAt: daysAgo(90),
    region: 'US',
  },
  {
    id: 'app-forest',
    name: 'Forest: Focus for Productivity',
    developer: 'Seekrtech Co., Ltd.',
    icon: '/icons/forest.png',
    price: '$3.99',
    rating: 4.7,
    ratingCount: 98_200,
    category: 'Productivity',
    platform: 'ios',
    bundleId: 'cc.forestapp.Forest',
    url: 'https://apps.apple.com/app/forest-focus-for-productivity/id866450515',
    isCompetitor: true,
    addedAt: daysAgo(60),
    region: 'US',
  },
];

// ─── Keywords ───────────────────────────────────────────────────────────────

function makeNote(text: string, daysOld: number): KeywordNote {
  const created = new Date();
  created.setDate(created.getDate() - daysOld);
  return {
    id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    text,
    createdAt: created.toISOString(),
    updatedAt: created.toISOString(),
  };
}

export const mockKeywords: TrackedKeyword[] = [
  // ── 1. Brand keyword ──────────────────────────────────────
  {
    id: 'kw-01',
    keyword: 'focus timer',
    appId: 'app-focus-timer',
    region: 'US',
    popularity: 62,
    difficulty: 'high',
    difficultyScore: 78,
    currentRank: 1,
    previousRank: 1,
    rankChange: 0,
    tags: [TAG.brand, TAG.priority],
    note: makeNote('Core brand term — must always hold #1.', 30),
    rankHistory: generateRankHistory(1, 'stable', 1),
    lastUpdated: new Date().toISOString(),
    addedAt: daysAgo(90),
  },

  // ── 2 ──────────────────────────────────────────────────────
  {
    id: 'kw-02',
    keyword: 'pomodoro timer',
    appId: 'app-focus-timer',
    region: 'US',
    popularity: 55,
    difficulty: 'high',
    difficultyScore: 72,
    currentRank: 4,
    previousRank: 6,
    rankChange: 2,
    tags: [TAG.generic, TAG.priority],
    note: makeNote('High intent keyword — added to metadata last sprint.', 14),
    rankHistory: generateRankHistory(6, 'improving', 2),
    lastUpdated: new Date().toISOString(),
    addedAt: daysAgo(60),
  },

  // ── 3 ──────────────────────────────────────────────────────
  {
    id: 'kw-03',
    keyword: 'productivity app',
    appId: 'app-focus-timer',
    region: 'US',
    popularity: 78,
    difficulty: 'high',
    difficultyScore: 91,
    currentRank: 38,
    previousRank: 35,
    rankChange: -3,
    tags: [TAG.generic],
    note: null,
    rankHistory: generateRankHistory(35, 'declining', 4),
    lastUpdated: new Date().toISOString(),
    addedAt: daysAgo(75),
  },

  // ── 4 ──────────────────────────────────────────────────────
  {
    id: 'kw-04',
    keyword: 'study timer',
    appId: 'app-focus-timer',
    region: 'US',
    popularity: 48,
    difficulty: 'medium',
    difficultyScore: 55,
    currentRank: 7,
    previousRank: 9,
    rankChange: 2,
    tags: [TAG.generic],
    note: null,
    rankHistory: generateRankHistory(9, 'improving', 3),
    lastUpdated: new Date().toISOString(),
    addedAt: daysAgo(80),
  },

  // ── 5 ──────────────────────────────────────────────────────
  {
    id: 'kw-05',
    keyword: 'time management',
    appId: 'app-focus-timer',
    region: 'US',
    popularity: 70,
    difficulty: 'high',
    difficultyScore: 85,
    currentRank: 22,
    previousRank: 24,
    rankChange: 2,
    tags: [TAG.generic, TAG.priority],
    note: makeNote('Broad category term — leverage in subtitle.', 7),
    rankHistory: generateRankHistory(24, 'improving', 3),
    lastUpdated: new Date().toISOString(),
    addedAt: daysAgo(90),
  },

  // ── 6 ──────────────────────────────────────────────────────
  {
    id: 'kw-06',
    keyword: 'deep work app',
    appId: 'app-focus-timer',
    region: 'US',
    popularity: 31,
    difficulty: 'low',
    difficultyScore: 28,
    currentRank: 2,
    previousRank: 3,
    rankChange: 1,
    tags: [TAG.longtail, TAG.brand],
    note: null,
    rankHistory: generateRankHistory(3, 'improving', 1),
    lastUpdated: new Date().toISOString(),
    addedAt: daysAgo(70),
  },

  // ── 7 ──────────────────────────────────────────────────────
  {
    id: 'kw-07',
    keyword: 'forest app alternative',
    appId: 'app-focus-timer',
    region: 'US',
    popularity: 22,
    difficulty: 'low',
    difficultyScore: 18,
    currentRank: 1,
    previousRank: 2,
    rankChange: 1,
    tags: [TAG.competitor, TAG.longtail],
    note: makeNote('Capturing competitor searches — great conversion.', 21),
    rankHistory: generateRankHistory(2, 'improving', 1),
    lastUpdated: new Date().toISOString(),
    addedAt: daysAgo(50),
  },

  // ── 8 ──────────────────────────────────────────────────────
  {
    id: 'kw-08',
    keyword: 'concentration app',
    appId: 'app-focus-timer',
    region: 'US',
    popularity: 40,
    difficulty: 'medium',
    difficultyScore: 48,
    currentRank: 11,
    previousRank: 12,
    rankChange: 1,
    tags: [TAG.generic],
    note: null,
    rankHistory: generateRankHistory(12, 'stable', 2),
    lastUpdated: new Date().toISOString(),
    addedAt: daysAgo(65),
  },

  // ── 9 ──────────────────────────────────────────────────────
  {
    id: 'kw-09',
    keyword: 'focus music timer',
    appId: 'app-focus-timer',
    region: 'US',
    popularity: 18,
    difficulty: 'low',
    difficultyScore: 22,
    currentRank: 3,
    previousRank: 5,
    rankChange: 2,
    tags: [TAG.longtail],
    note: null,
    rankHistory: generateRankHistory(5, 'improving', 2),
    lastUpdated: new Date().toISOString(),
    addedAt: daysAgo(45),
  },

  // ── 10 ─────────────────────────────────────────────────────
  {
    id: 'kw-10',
    keyword: 'work timer app',
    appId: 'app-focus-timer',
    region: 'US',
    popularity: 35,
    difficulty: 'medium',
    difficultyScore: 44,
    currentRank: 9,
    previousRank: 8,
    rankChange: -1,
    tags: [TAG.generic],
    note: null,
    rankHistory: generateRankHistory(8, 'stable', 2),
    lastUpdated: new Date().toISOString(),
    addedAt: daysAgo(55),
  },

  // ── 11 ─────────────────────────────────────────────────────
  {
    id: 'kw-11',
    keyword: 'pomodoro technique',
    appId: 'app-focus-timer',
    region: 'US',
    popularity: 52,
    difficulty: 'high',
    difficultyScore: 68,
    currentRank: 14,
    previousRank: 17,
    rankChange: 3,
    tags: [TAG.generic, TAG.priority],
    note: makeNote('Good conversion rate despite moderate rank.', 5),
    rankHistory: generateRankHistory(17, 'improving', 3),
    lastUpdated: new Date().toISOString(),
    addedAt: daysAgo(85),
  },

  // ── 12 ─────────────────────────────────────────────────────
  {
    id: 'kw-12',
    keyword: 'stay focused',
    appId: 'app-focus-timer',
    region: 'US',
    popularity: 44,
    difficulty: 'medium',
    difficultyScore: 52,
    currentRank: 19,
    previousRank: 16,
    rankChange: -3,
    tags: [TAG.generic],
    note: null,
    rankHistory: generateRankHistory(16, 'declining', 3),
    lastUpdated: new Date().toISOString(),
    addedAt: daysAgo(60),
  },

  // ── 13 ─────────────────────────────────────────────────────
  {
    id: 'kw-13',
    keyword: 'screen time limit',
    appId: 'app-focus-timer',
    region: 'US',
    popularity: 58,
    difficulty: 'high',
    difficultyScore: 76,
    currentRank: 45,
    previousRank: 42,
    rankChange: -3,
    tags: [TAG.generic],
    note: null,
    rankHistory: generateRankHistory(42, 'declining', 5),
    lastUpdated: new Date().toISOString(),
    addedAt: daysAgo(40),
  },

  // ── 14 ─────────────────────────────────────────────────────
  {
    id: 'kw-14',
    keyword: 'focus timer for students',
    appId: 'app-focus-timer',
    region: 'US',
    popularity: 26,
    difficulty: 'low',
    difficultyScore: 30,
    currentRank: 2,
    previousRank: 3,
    rankChange: 1,
    tags: [TAG.longtail, TAG.priority],
    note: makeNote('Highest conversion long-tail. Consider Apple Search Ad.', 3),
    rankHistory: generateRankHistory(3, 'improving', 1),
    lastUpdated: new Date().toISOString(),
    addedAt: daysAgo(35),
  },

  // ── 15 ─────────────────────────────────────────────────────
  {
    id: 'kw-15',
    keyword: 'do not disturb timer',
    appId: 'app-focus-timer',
    region: 'US',
    popularity: 20,
    difficulty: 'low',
    difficultyScore: 24,
    currentRank: 5,
    previousRank: 5,
    rankChange: 0,
    tags: [TAG.longtail],
    note: null,
    rankHistory: generateRankHistory(5, 'stable', 2),
    lastUpdated: new Date().toISOString(),
    addedAt: daysAgo(30),
  },

  // ── 16 ─────────────────────────────────────────────────────
  {
    id: 'kw-16',
    keyword: 'best focus app 2026',
    appId: 'app-focus-timer',
    region: 'US',
    popularity: 15,
    difficulty: 'low',
    difficultyScore: 12,
    currentRank: 3,
    previousRank: 4,
    rankChange: 1,
    tags: [TAG.longtail],
    note: null,
    rankHistory: generateRankHistory(4, 'improving', 1),
    lastUpdated: new Date().toISOString(),
    addedAt: daysAgo(20),
  },

  // ── 17 (competitor keyword) ────────────────────────────────
  {
    id: 'kw-17',
    keyword: 'forest focus timer',
    appId: 'app-focus-timer',
    region: 'US',
    popularity: 42,
    difficulty: 'high',
    difficultyScore: 82,
    currentRank: 12,
    previousRank: 15,
    rankChange: 3,
    tags: [TAG.competitor],
    note: makeNote('Competitor brand keyword — monitor closely.', 10),
    rankHistory: generateRankHistory(15, 'improving', 3),
    lastUpdated: new Date().toISOString(),
    addedAt: daysAgo(50),
  },

  // ── 18 ─────────────────────────────────────────────────────
  {
    id: 'kw-18',
    keyword: 'adhd focus app',
    appId: 'app-focus-timer',
    region: 'US',
    popularity: 34,
    difficulty: 'medium',
    difficultyScore: 46,
    currentRank: 8,
    previousRank: 10,
    rankChange: 2,
    tags: [TAG.longtail, TAG.priority],
    note: makeNote('Growing niche — plan ASA campaign for Q3.', 2),
    rankHistory: generateRankHistory(10, 'improving', 2),
    lastUpdated: new Date().toISOString(),
    addedAt: daysAgo(25),
  },
];
