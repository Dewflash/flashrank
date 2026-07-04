// Zustand store — single source of truth for FlashRank
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  AppState,
  TrackedApp,
  TrackedKeyword,
  KeywordTag,
  SortField,
  SortDirection,
  SyncProgress,
  AppImportProgress,
  ViewMode,
  FilterState,
  RankStatusFilter,
} from '@/types';
import { legacyDemoAppIds, seedTags } from '@/data/seedData';
import { describeRankStatus, isBlockedKeyword, slugifyKeyword } from '@/lib/keywordHydration';
import { getKeywordScopeAppId, isKeywordResearchScope } from '@/lib/keywordScope';

// ─── Action types ───────────────────────────────────────────────────────────

interface AppActions {
  // App management
  setSelectedApp: (appId: string) => void;
  setSelectedRegion: (region: string) => void;
  addApp: (app: TrackedApp) => void;
  removeApp: (appId: string) => void;

  // Keyword management
  addKeyword: (keyword: TrackedKeyword) => void;
  upsertKeywords: (keywords: TrackedKeyword[]) => void;
  removeKeyword: (keywordId: string) => void;
  removeKeywordsForAppRegion: (appId: string, region: string) => void;
  setSelectedKeyword: (keywordId: string | null) => void;
  updateKeywordTags: (keywordId: string, tags: KeywordTag[]) => void;
  updateKeywordNote: (keywordId: string, note: string) => void;

  // Tag management
  addTag: (tag: KeywordTag) => void;
  removeTag: (tagId: string) => void;
  updateTag: (tagId: string, tag: Partial<KeywordTag>) => void;

  // View state
  setViewMode: (mode: ViewMode) => void;
  setSort: (field: SortField, direction: SortDirection) => void;
  setSearchFilter: (search: string) => void;
  setTagFilter: (tags: string[]) => void;
  setRankStatusFilter: (status: RankStatusFilter) => void;

  // UI state
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setAddKeywordModalOpen: (open: boolean) => void;
  setKeywordResearchModalOpen: (open: boolean) => void;
  setAddAppModalOpen: (open: boolean) => void;
  setAddAppMode: (mode: AppState['addAppMode']) => void;
  setDetailPanelOpen: (open: boolean) => void;
  setRefreshing: (refreshing: boolean) => void;
  setAppImportProgress: (key: string, progress: Partial<AppImportProgress>) => void;
  setSyncProgress: (progress: Partial<SyncProgress>) => void;
  setApiKeys: (keys: Partial<AppState['apiKeys']>) => void;

  // Derived data
  getFilteredKeywords: () => TrackedKeyword[];
  getSortedKeywords: (keywords: TrackedKeyword[]) => TrackedKeyword[];
}

// ─── Store ──────────────────────────────────────────────────────────────────

function defaultFilter(overrides: Partial<FilterState> = {}): FilterState {
  return {
    search: '',
    tags: [],
    difficulty: [],
    rankRange: [null, null],
    rankStatus: 'all',
    ...overrides,
  };
}

function normalizeFilter(filter: Partial<FilterState> | undefined): FilterState {
  const normalized = defaultFilter(filter ?? {});
  return {
    ...normalized,
    search: normalized.search ?? '',
    tags: normalized.tags ?? [],
    difficulty: normalized.difficulty ?? [],
    rankRange: normalized.rankRange ?? [null, null],
    rankStatus: normalized.rankStatus ?? 'all',
  };
}

function sanitizeKeywords(keywords: TrackedKeyword[] | undefined): TrackedKeyword[] {
  if (!Array.isArray(keywords)) return [];

  const byIdentity = new Map<string, TrackedKeyword>();
  keywords.forEach((keyword) => {
    const normalized = keyword.keyword.trim().toLowerCase();
    if (!normalized || isBlockedKeyword(normalized)) return;

    const identity = `${keyword.region}:${keyword.appId}:${normalized}`;
    const existing = byIdentity.get(identity);
    const rankStatus = keyword.rankStatus
      ? {
          rankStatus: keyword.rankStatus,
          rankStatusMessage: keyword.rankStatusMessage,
        }
      : describeRankStatus({
          currentRank: keyword.currentRank,
          rankingResultCount: keyword.rankingResultCount,
          hasSelectedApp: !isKeywordResearchScope(keyword.appId),
        });
    const normalizedKeyword = {
      ...keyword,
      ...rankStatus,
    };
    if (!existing || new Date(keyword.lastUpdated).getTime() > new Date(existing.lastUpdated).getTime()) {
      byIdentity.set(identity, normalizedKeyword);
    }
  });

  return Array.from(byIdentity.values());
}

function removeBundledDemoData(state: Partial<AppState>): Partial<AppState> {
  const apps = Array.isArray(state.apps) ? state.apps : [];
  const keywords = Array.isArray(state.keywords) ? state.keywords : [];
  const nonDemoApps = apps.filter((app) => !legacyDemoAppIds.has(app.id));
  const demoOnly = apps.length > 0 && nonDemoApps.length === 0;

  if (apps.length === 0 || (!demoOnly && nonDemoApps.length === apps.length)) {
    return state;
  }

  return {
    ...state,
    apps: nonDemoApps,
    keywords: keywords.filter((keyword) => !legacyDemoAppIds.has(keyword.appId)),
    selectedAppId:
      state.selectedAppId && !legacyDemoAppIds.has(state.selectedAppId)
        ? state.selectedAppId
        : nonDemoApps[0]?.id ?? null,
  };
}

export function appScopeKey(appId: string | null | undefined, region: string | null | undefined): string {
  return `${region ?? 'us'}:${appId ?? 'none'}`;
}

export const useAppStore = create<AppState & AppActions>()(
  persist(
    (set, get) => ({
      // ── Initial state ──────────────────────────────────────────

      apps: [],
      selectedAppId: null,
      selectedRegion: 'sg',
      keywords: [],
      selectedKeywordId: null,
      viewMode: 'keywords',
      sort: { field: 'popularity', direction: 'desc' },
      filter: defaultFilter(),
      isSidebarCollapsed: false,
      isAddKeywordModalOpen: false,
      isKeywordResearchModalOpen: false,
      isAddAppModalOpen: false,
      addAppMode: 'mine',
      isDetailPanelOpen: false,
      isRefreshing: false,
      appImportProgress: {},
      syncProgress: {
        status: 'idle',
        total: 0,
        completed: 0,
        currentKeyword: null,
        message: null,
      },
      lastSyncTime: new Date().toISOString(),
      apiKeys: {
        ascIssuerId: '',
        ascKeyId: '',
        ascPrivateKey: '',
        asaClientId: '',
        asaTeamId: '',
        asaKeyId: '',
        asaPrivateKey: '',
      },
      tags: seedTags,

  // ── App management ─────────────────────────────────────────

  setSelectedApp: (appId) =>
    set({
      selectedAppId: appId,
      selectedKeywordId: null, // reset keyword selection on app switch
      isDetailPanelOpen: false,
      filter: defaultFilter({
        search: '',
        tags: [],
        difficulty: [],
        rankRange: [null, null],
      }),
    }),

  setSelectedRegion: (region) =>
    set((state) => {
      const selectedAppId = state.selectedAppId;
      const keywordScopeAppId = getKeywordScopeAppId(selectedAppId);
      if (state.selectedRegion === region) {
        return {
          selectedRegion: region,
          filter: defaultFilter({
            search: '',
            tags: [],
            difficulty: [],
            rankRange: [null, null],
          }),
        };
      }

      const existingTargetTerms = new Set(
        state.keywords
          .filter((keyword) => keyword.appId === keywordScopeAppId && keyword.region === region)
          .map((keyword) => keyword.keyword.toLowerCase())
      );
      const keywordsToCarry = state.keywords.filter(
        (keyword) =>
          keyword.appId === keywordScopeAppId &&
          keyword.region === state.selectedRegion &&
          !existingTargetTerms.has(keyword.keyword.toLowerCase())
      );
      const now = new Date().toISOString();
      const carriedKeywords = keywordsToCarry.map((keyword) => ({
        ...keyword,
        id: `kw-${region}-${keywordScopeAppId}-${slugifyKeyword(keyword.keyword)}`,
        region,
        currentRank: null,
        previousRank: null,
        rankChange: null,
        rankHistory: [],
        competitorRanks: {},
        rankingApps: [],
        rankingResultCount: 0,
        ...(selectedAppId
          ? {
              rankStatus: 'pending' as const,
              rankStatusMessage: `Pending refresh in ${region.toUpperCase()}. Run refresh to check public App Store rankings for this storefront.`,
            }
          : describeRankStatus({
              currentRank: null,
              rankingResultCount: 0,
              hasSelectedApp: false,
            })),
        lastUpdated: now,
        addedAt: now,
      }));
      const selectedKeyword = state.keywords.find((keyword) => keyword.id === state.selectedKeywordId);
      const carriedSelectedKeyword =
        selectedKeyword?.appId === keywordScopeAppId && selectedKeyword.region === state.selectedRegion
          ? carriedKeywords.find((keyword) => keyword.keyword.toLowerCase() === selectedKeyword.keyword.toLowerCase())
          : null;

      return {
        selectedRegion: region,
        keywords: [...state.keywords, ...carriedKeywords],
        selectedKeywordId: carriedSelectedKeyword?.id ?? null,
        isDetailPanelOpen: carriedSelectedKeyword ? state.isDetailPanelOpen : false,
        filter: defaultFilter({
          search: '',
          tags: [],
          difficulty: [],
          rankRange: [null, null],
        }),
      };
    }),

  addApp: (app) =>
    set((state) => {
      const existingIndex = state.apps.findIndex(
        (existingApp) => existingApp.id === app.id && existingApp.region === app.region
      );

      if (existingIndex === -1) {
        return { apps: [...state.apps, app] };
      }

      return {
        apps: state.apps.map((existingApp, index) =>
          index === existingIndex ? { ...existingApp, ...app } : existingApp
        ),
      };
    }),

  removeApp: (appId) =>
    set((state) => {
      const selectedKeywordWillBeRemoved =
        state.selectedKeywordId !== null &&
        state.keywords.some(
          (keyword) => keyword.id === state.selectedKeywordId && keyword.appId === appId
        );

      return {
        apps: state.apps.filter((a) => a.id !== appId),
        keywords: state.keywords.filter((k) => k.appId !== appId),
        selectedAppId: state.selectedAppId === appId ? null : state.selectedAppId,
        selectedKeywordId: selectedKeywordWillBeRemoved ? null : state.selectedKeywordId,
        isDetailPanelOpen: selectedKeywordWillBeRemoved ? false : state.isDetailPanelOpen,
      };
    }),

  // ── Keyword management ─────────────────────────────────────

  addKeyword: (keyword) =>
    set((state) => {
      const existingIndex = state.keywords.findIndex((kw) => kw.id === keyword.id);
      if (existingIndex === -1) return { keywords: [...state.keywords, keyword] };

      return {
        keywords: state.keywords.map((kw, index) =>
          index === existingIndex ? keyword : kw
        ),
      };
    }),

  upsertKeywords: (nextKeywords) =>
    set((state) => {
      const byId = new Map(state.keywords.map((keyword) => [keyword.id, keyword]));
      nextKeywords.forEach((keyword) => byId.set(keyword.id, keyword));
      return { keywords: Array.from(byId.values()) };
    }),

  removeKeyword: (keywordId) =>
    set((state) => ({
      keywords: state.keywords.filter((k) => k.id !== keywordId),
      selectedKeywordId:
        state.selectedKeywordId === keywordId ? null : state.selectedKeywordId,
    })),

  removeKeywordsForAppRegion: (appId, region) =>
    set((state) => ({
      keywords: state.keywords.filter((keyword) => keyword.appId !== appId || keyword.region !== region),
      selectedKeywordId:
        state.selectedKeywordId &&
        state.keywords.some(
          (keyword) =>
            keyword.id === state.selectedKeywordId &&
            keyword.appId === appId &&
            keyword.region === region
        )
          ? null
          : state.selectedKeywordId,
      isDetailPanelOpen:
        state.selectedKeywordId &&
        state.keywords.some(
          (keyword) =>
            keyword.id === state.selectedKeywordId &&
            keyword.appId === appId &&
            keyword.region === region
        )
          ? false
          : state.isDetailPanelOpen,
    })),

  setSelectedKeyword: (keywordId) =>
    set({
      selectedKeywordId: keywordId,
      isDetailPanelOpen: keywordId !== null,
    }),

  updateKeywordTags: (keywordId, tags) =>
    set((state) => ({
      keywords: state.keywords.map((k) =>
        k.id === keywordId ? { ...k, tags } : k,
      ),
    })),

  updateKeywordNote: (keywordId, note) =>
    set((state) => ({
      keywords: state.keywords.map((k) =>
        k.id === keywordId
          ? {
              ...k,
              note: k.note
                ? { ...k.note, text: note, updatedAt: new Date().toISOString() }
                : {
                    id: `note-${Date.now()}`,
                    text: note,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  },
            }
          : k,
      ),
    })),

  // ── Tag management ─────────────────────────────────────────

  addTag: (tag) => set((state) => ({ tags: [...state.tags, tag] })),

  removeTag: (tagId) =>
    set((state) => ({
      tags: state.tags.filter((t) => t.id !== tagId),
      // Also remove this tag from all keywords
      keywords: state.keywords.map((k) => ({
        ...k,
        tags: k.tags.filter((t) => t.id !== tagId),
      })),
      // Also remove from active filters
      filter: {
        ...state.filter,
        tags: state.filter.tags.filter((id) => id !== tagId),
      },
    })),

  updateTag: (tagId, updatedTag) =>
    set((state) => ({
      tags: state.tags.map((t) =>
        t.id === tagId ? { ...t, ...updatedTag } : t,
      ),
      // Also update instances of this tag in keywords
      keywords: state.keywords.map((k) => ({
        ...k,
        tags: k.tags.map((t) =>
          t.id === tagId ? { ...t, ...updatedTag } : t,
        ),
      })),
    })),

  // ── View state ─────────────────────────────────────────────

  setViewMode: (mode) => set({ viewMode: mode }),

  setSort: (field, direction) =>
    set({ sort: { field, direction } }),

  setSearchFilter: (search) =>
    set((state) => ({ filter: { ...state.filter, search } })),

  setTagFilter: (tags) =>
    set((state) => ({ filter: { ...state.filter, tags } })),

  setRankStatusFilter: (rankStatus) =>
    set((state) => ({ filter: { ...state.filter, rankStatus } })),

  // ── UI state ───────────────────────────────────────────────

  toggleSidebar: () =>
    set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),

  setSidebarCollapsed: (collapsed) =>
    set({ isSidebarCollapsed: collapsed }),

  setAddKeywordModalOpen: (open) => set({ isAddKeywordModalOpen: open }),

  setKeywordResearchModalOpen: (open) => set({ isKeywordResearchModalOpen: open }),

  setAddAppModalOpen: (open) => set({ isAddAppModalOpen: open }),

  setAddAppMode: (mode) => set({ addAppMode: mode }),

  setDetailPanelOpen: (open) => set({ isDetailPanelOpen: open }),

  setRefreshing: (refreshing) =>
    set({
      isRefreshing: refreshing,
    }),

  setAppImportProgress: (key, progress) =>
    set((state) => ({
      appImportProgress: {
        ...state.appImportProgress,
        [key]: {
          ...(state.appImportProgress[key] ?? {
            status: 'idle',
            message: null,
            keywordCount: 0,
            updatedAt: null,
          }),
          ...progress,
        },
      },
    })),

  setSyncProgress: (progress) =>
    set((state) => ({
      syncProgress: {
        ...state.syncProgress,
        ...progress,
      },
    })),

  setApiKeys: (keys) =>
    set((state) => ({
      apiKeys: { ...state.apiKeys, ...keys },
    })),

  // ── Derived data ───────────────────────────────────────────

  getFilteredKeywords: () => {
    const { keywords, selectedAppId, filter } = get();
    const keywordScopeAppId = getKeywordScopeAppId(selectedAppId);

    return keywords.filter((kw) => {
      // Must belong to the currently-selected app
      if (kw.appId !== keywordScopeAppId) return false;

      // Search text (case-insensitive, matches keyword string)
      if (kw.region !== get().selectedRegion) return false;

      // Search text (case-insensitive, matches keyword string)
      if (
        filter.search &&
        !kw.keyword.toLowerCase().includes(filter.search.toLowerCase())
      ) {
        return false;
      }

      // Tag filter — keyword must contain ALL selected tags
      if (filter.tags.length > 0) {
        const kwTagIds = kw.tags.map((t) => t.id);
        if (!filter.tags.every((tagId) => kwTagIds.includes(tagId))) {
          return false;
        }
      }

      // Difficulty filter
      if (
        filter.difficulty.length > 0 &&
        !filter.difficulty.includes(kw.difficulty)
      ) {
        return false;
      }

      if (filter.rankStatus !== 'all') {
        const status = kw.rankStatus ?? describeRankStatus({
          currentRank: kw.currentRank,
          rankingResultCount: kw.rankingResultCount,
          hasSelectedApp: !isKeywordResearchScope(kw.appId),
        }).rankStatus;
        if (status !== filter.rankStatus) return false;
      }

      // Rank range filter
      const [minRank, maxRank] = filter.rankRange;
      if (kw.currentRank !== null) {
        if (minRank !== null && kw.currentRank < minRank) return false;
        if (maxRank !== null && kw.currentRank > maxRank) return false;
      }

      return true;
    });
  },

  getSortedKeywords: (keywords) => {
    const { sort } = get();
    const dir = sort.direction === 'asc' ? 1 : -1;

    return [...keywords].sort((a, b) => {
      switch (sort.field) {
        case 'keyword':
          return dir * a.keyword.localeCompare(b.keyword);

        case 'popularity':
          return dir * (a.popularity - b.popularity);

        case 'difficulty':
          return dir * (a.difficultyScore - b.difficultyScore);

        case 'rank': {
          // null ranks sink to the bottom regardless of sort direction
          if (a.currentRank === null && b.currentRank === null) return 0;
          if (a.currentRank === null) return 1;
          if (b.currentRank === null) return -1;
          return dir * (a.currentRank - b.currentRank);
        }

        case 'change': {
          const aChange = a.rankChange ?? 0;
          const bChange = b.rankChange ?? 0;
          return dir * (aChange - bChange);
        }

        default:
          return 0;
      }
    });
  },
}),
{
  name: 'flashrank-storage', // key in localStorage
      version: 4,
      storage: createJSONStorage(() => localStorage),
      migrate: (persistedState) => {
        const state = removeBundledDemoData(persistedState as Partial<AppState>);
        return {
          ...state,
          appImportProgress: state.appImportProgress ?? {},
          addAppMode: state.addAppMode ?? 'mine',
          filter: normalizeFilter(state.filter),
          keywords: sanitizeKeywords(state.keywords),
        };
      },
      partialize: (state) => ({
        // What fields to persist
        apps: state.apps,
        keywords: state.keywords,
        tags: state.tags,
        selectedAppId: state.selectedAppId,
        selectedRegion: state.selectedRegion,
        viewMode: state.viewMode,
        sort: state.sort,
        isSidebarCollapsed: state.isSidebarCollapsed,
        appImportProgress: state.appImportProgress,
        lastSyncTime: state.lastSyncTime,
        apiKeys: state.apiKeys,
      }),
    }
  )
);
