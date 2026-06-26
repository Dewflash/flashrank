// Core TypeScript types for Astro ASO Clone

export interface AppMetadata {
  id: string;
  name: string;
  developer: string;
  icon: string;
  price: string;
  rating: number;
  ratingCount: number;
  category: string;
  platform: 'ios' | 'macos' | 'ipados' | 'tvos' | 'watchos';
  bundleId: string;
  url: string;
}

export interface TrackedApp extends AppMetadata {
  isCompetitor: boolean;
  addedAt: string;
  region: string;
}

export interface KeywordTag {
  id: string;
  name: string;
  color: string;
}

export interface KeywordNote {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export interface RankHistoryEntry {
  date: string;
  rank: number | null;
}

export interface TrackedKeyword {
  id: string;
  keyword: string;
  appId: string;
  region: string;
  popularity: number;       // 1-100 from Apple Search Ads
  difficulty: 'low' | 'medium' | 'high';
  difficultyScore: number;  // 0-100
  currentRank: number | null;
  previousRank: number | null;
  rankChange: number | null; // positive = improved, negative = dropped
  tags: KeywordTag[];
  note: KeywordNote | null;
  rankHistory: RankHistoryEntry[];
  lastUpdated: string;
  addedAt: string;
}

export interface CompetitorKeywordData {
  appId: string;
  appName: string;
  appIcon: string;
  rank: number | null;
}

export interface KeywordWithCompetitors extends TrackedKeyword {
  competitors: CompetitorKeywordData[];
}

export interface TopAppForKeyword {
  rank: number;
  appId: string;
  appName: string;
  appIcon: string;
  developer: string;
  rating: number;
  ratingCount: number;
}

export interface KeywordSuggestion {
  keyword: string;
  popularity: number;
  difficulty: 'low' | 'medium' | 'high';
}

export type SortField = 'keyword' | 'popularity' | 'difficulty' | 'rank' | 'change';
export type SortDirection = 'asc' | 'desc';

export interface TableSort {
  field: SortField;
  direction: SortDirection;
}

export interface FilterState {
  search: string;
  tags: string[];
  difficulty: ('low' | 'medium' | 'high')[];
  rankRange: [number | null, number | null];
}

export type ViewMode = 'keywords' | 'competitors' | 'overview';

export interface AppState {
  // Apps
  apps: TrackedApp[];
  selectedAppId: string | null;
  
  // Keywords
  keywords: TrackedKeyword[];
  selectedKeywordId: string | null;
  
  // View state
  viewMode: ViewMode;
  sort: TableSort;
  filter: FilterState;
  
  // UI state
  isSidebarCollapsed: boolean;
  isAddKeywordModalOpen: boolean;
  isAddAppModalOpen: boolean;
  isDetailPanelOpen: boolean;
  isRefreshing: boolean;
  lastSyncTime: string | null;
  
  // Tags
  tags: KeywordTag[];
}
