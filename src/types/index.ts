// Core TypeScript types for FlashRank

export interface AppMetadata {
  id: string;
  name: string;
  developer: string;
  icon: string;
  price: string;
  rating: number;
  ratingCount: number;
  category: string;
  description?: string;
  genres?: string[];
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

export interface RankingAppSnapshot {
  rank: number;
  appId: string;
  appName: string;
  appIcon: string;
  developer: string;
  rating: number;
  ratingCount: number;
  bundleId: string;
  url: string;
  isSelectedApp: boolean;
  isTrackedCompetitor: boolean;
}

export type ASODataSource =
  | 'estimated'
  | 'itunes-search'
  | 'apple-search-ads'
  | 'app-store-connect';

export type RankStatus = 'ranked' | 'unranked' | 'pending' | 'error' | 'no-app';
export type RankStatusFilter = 'all' | RankStatus;

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
  competitorRanks?: Record<string, number | null>;
  rankingApps?: RankingAppSnapshot[];
  rankingResultCount?: number;
  popularitySource?: ASODataSource;
  difficultySource?: ASODataSource;
  rankSource?: ASODataSource;
  rankStatus?: RankStatus;
  rankStatusMessage?: string;
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
  rankStatus: RankStatusFilter;
}

export type ViewMode = 'keywords' | 'competitors' | 'overview' | 'ratings';

export interface AppImportProgress {
  status: 'idle' | 'loading' | 'complete' | 'error';
  message: string | null;
  keywordCount: number;
  updatedAt: string | null;
}

export interface SyncProgress {
  status: 'idle' | 'queued' | 'running' | 'complete' | 'error';
  total: number;
  completed: number;
  currentKeyword: string | null;
  message: string | null;
}

export interface AppState {
  // Apps
  apps: TrackedApp[];
  selectedAppId: string | null;
  selectedRegion: string;
  
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
  isKeywordResearchModalOpen: boolean;
  isAddAppModalOpen: boolean;
  addAppMode: 'mine' | 'competitor';
  isDetailPanelOpen: boolean;
  isRefreshing: boolean;
  appImportProgress: Record<string, AppImportProgress>;
  syncProgress: SyncProgress;
  lastSyncTime: string | null;
  
  // Tags
  tags: KeywordTag[];

  // Settings
  apiKeys: {
    ascIssuerId: string;
    ascKeyId: string;
    ascPrivateKey: string;
    asaClientId: string;
    asaTeamId: string;
    asaKeyId: string;
    asaPrivateKey: string;
  };
}
