// Zustand store — single source of truth for the Astro ASO Clone
import { create } from 'zustand';
import {
  AppState,
  TrackedApp,
  TrackedKeyword,
  KeywordTag,
  SortField,
  SortDirection,
  ViewMode,
} from '@/types';
import { mockApps, mockKeywords, mockTags } from '@/data/mockData';

// ─── Action types ───────────────────────────────────────────────────────────

interface AppActions {
  // App management
  setSelectedApp: (appId: string) => void;
  addApp: (app: TrackedApp) => void;
  removeApp: (appId: string) => void;

  // Keyword management
  addKeyword: (keyword: TrackedKeyword) => void;
  removeKeyword: (keywordId: string) => void;
  setSelectedKeyword: (keywordId: string | null) => void;
  updateKeywordTags: (keywordId: string, tags: KeywordTag[]) => void;
  updateKeywordNote: (keywordId: string, note: string) => void;

  // View state
  setViewMode: (mode: ViewMode) => void;
  setSort: (field: SortField, direction: SortDirection) => void;
  setSearchFilter: (search: string) => void;
  setTagFilter: (tags: string[]) => void;

  // UI state
  toggleSidebar: () => void;
  setAddKeywordModalOpen: (open: boolean) => void;
  setAddAppModalOpen: (open: boolean) => void;
  setDetailPanelOpen: (open: boolean) => void;
  setRefreshing: (refreshing: boolean) => void;

  // Derived data
  getFilteredKeywords: () => TrackedKeyword[];
  getSortedKeywords: (keywords: TrackedKeyword[]) => TrackedKeyword[];
}

// ─── Store ──────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState & AppActions>((set, get) => ({
  // ── Initial state ──────────────────────────────────────────

  apps: mockApps,
  selectedAppId: mockApps[0]?.id ?? null,
  keywords: mockKeywords,
  selectedKeywordId: null,
  viewMode: 'keywords',
  sort: { field: 'popularity', direction: 'desc' },
  filter: { search: '', tags: [], difficulty: [], rankRange: [null, null] },
  isSidebarCollapsed: false,
  isAddKeywordModalOpen: false,
  isAddAppModalOpen: false,
  isDetailPanelOpen: false,
  isRefreshing: false,
  lastSyncTime: new Date().toISOString(),
  tags: mockTags,

  // ── App management ─────────────────────────────────────────

  setSelectedApp: (appId) =>
    set({
      selectedAppId: appId,
      selectedKeywordId: null, // reset keyword selection on app switch
    }),

  addApp: (app) =>
    set((state) => ({ apps: [...state.apps, app] })),

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

  setAddAppModalOpen: (open) => set({ isAddAppModalOpen: open }),

  setDetailPanelOpen: (open) => set({ isDetailPanelOpen: open }),

  setRefreshing: (refreshing) =>
    set({
      isRefreshing: refreshing,
      ...(refreshing ? {} : { lastSyncTime: new Date().toISOString() }),
    }),

  // ── Derived data ───────────────────────────────────────────

  getFilteredKeywords: () => {
    const { keywords, selectedAppId, filter } = get();

    return keywords.filter((kw) => {
      // Must belong to the currently-selected app
      if (selectedAppId && kw.appId !== selectedAppId) return false;

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
}));
