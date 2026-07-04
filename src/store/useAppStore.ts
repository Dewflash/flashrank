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
  ViewMode,
} from '@/types';
import { seedApps, seedKeywords, seedTags } from '@/data/seedData';

// ─── Action types ───────────────────────────────────────────────────────────

interface AppActions {
  // App management
  setSelectedApp: (appId: string) => void;
  setSelectedRegion: (region: string) => void;
  addApp: (app: TrackedApp) => void;
  removeApp: (appId: string) => void;

  // Keyword management
  addKeyword: (keyword: TrackedKeyword) => void;
  removeKeyword: (keywordId: string) => void;
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

  // UI state
  toggleSidebar: () => void;
  setAddKeywordModalOpen: (open: boolean) => void;
  setKeywordResearchModalOpen: (open: boolean) => void;
  setAddAppModalOpen: (open: boolean) => void;
  setDetailPanelOpen: (open: boolean) => void;
  setRefreshing: (refreshing: boolean) => void;
  setApiKeys: (keys: Partial<AppState['apiKeys']>) => void;

  // Derived data
  getFilteredKeywords: () => TrackedKeyword[];
  getSortedKeywords: (keywords: TrackedKeyword[]) => TrackedKeyword[];
}

// ─── Store ──────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState & AppActions>()(
  persist(
    (set, get) => ({
      // ── Initial state ──────────────────────────────────────────

      apps: seedApps,
      selectedAppId: '506627515',
      selectedRegion: 'sg',
      keywords: seedKeywords,
      selectedKeywordId: null,
      viewMode: 'keywords',
      sort: { field: 'popularity', direction: 'desc' },
      filter: { search: '', tags: [], difficulty: [], rankRange: [null, null] },
      isSidebarCollapsed: false,
      isAddKeywordModalOpen: false,
      isKeywordResearchModalOpen: false,
      isAddAppModalOpen: false,
      isDetailPanelOpen: false,
      isRefreshing: false,
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
    set((state) => ({
      selectedAppId: appId,
      selectedKeywordId: null, // reset keyword selection on app switch
      isDetailPanelOpen: false,
      filter: {
        ...state.filter,
        search: '',
        tags: [],
        difficulty: [],
        rankRange: [null, null],
      },
    })),

  setSelectedRegion: (region) =>
    set((state) => ({
      selectedRegion: region,
      selectedKeywordId: null,
      isDetailPanelOpen: false,
      filter: {
        ...state.filter,
        search: '',
        tags: [],
        difficulty: [],
        rankRange: [null, null],
      },
    })),

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
    set((state) => ({
      apps: state.apps.filter((a) => a.id !== appId),
      keywords: state.keywords.filter((k) => k.appId !== appId),
      selectedAppId:
        state.selectedAppId === appId
          ? state.apps.find((a) => a.id !== appId)?.id ?? null
          : state.selectedAppId,
    })),

  // ── Keyword management ─────────────────────────────────────

  addKeyword: (keyword) =>
    set((state) => ({ keywords: [...state.keywords, keyword] })),

  removeKeyword: (keywordId) =>
    set((state) => ({
      keywords: state.keywords.filter((k) => k.id !== keywordId),
      selectedKeywordId:
        state.selectedKeywordId === keywordId ? null : state.selectedKeywordId,
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

  // ── UI state ───────────────────────────────────────────────

  toggleSidebar: () =>
    set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),

  setAddKeywordModalOpen: (open) => set({ isAddKeywordModalOpen: open }),

  setKeywordResearchModalOpen: (open) => set({ isKeywordResearchModalOpen: open }),

  setAddAppModalOpen: (open) => set({ isAddAppModalOpen: open }),

  setDetailPanelOpen: (open) => set({ isDetailPanelOpen: open }),

  setRefreshing: (refreshing) =>
    set({
      isRefreshing: refreshing,
      ...(refreshing ? {} : { lastSyncTime: new Date().toISOString() }),
    }),

  setApiKeys: (keys) =>
    set((state) => ({
      apiKeys: { ...state.apiKeys, ...keys },
    })),

  // ── Derived data ───────────────────────────────────────────

  getFilteredKeywords: () => {
    const { keywords, selectedAppId, filter } = get();

    return keywords.filter((kw) => {
      // Must belong to the currently-selected app
      if (selectedAppId && kw.appId !== selectedAppId) return false;

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
      storage: createJSONStorage(() => localStorage),
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
        lastSyncTime: state.lastSyncTime,
        apiKeys: state.apiKeys,
      }),
    }
  )
);
