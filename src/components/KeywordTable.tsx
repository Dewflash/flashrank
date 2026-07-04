'use client';

/* eslint-disable react-hooks/static-components, react-hooks/set-state-in-effect */

import React, { useEffect, useState } from 'react';
import {
  ArrowUp,
  ArrowDown,
  Minus,
  StickyNote,
  ChevronUp,
  ChevronDown,
  Lightbulb,
  Loader2,
} from 'lucide-react';
import { appScopeKey, useAppStore } from '@/store/useAppStore';
import type { RankingAppSnapshot, TrackedKeyword, SortField } from '@/types';
import ContextMenu from '@/components/ContextMenu';
import { runBackgroundSync } from '@/lib/syncEngine';

type TranslationState =
  | { status: 'idle'; text: null }
  | { status: 'loading'; text: null }
  | { status: 'ready'; text: string }
  | { status: 'error'; text: string };

function shouldTranslateKeyword(keyword: string): boolean {
  return /[^\u0000-\u007f]/.test(keyword);
}

function TranslatableKeyword({ keyword }: { keyword: string }) {
  const [translation, setTranslation] = useState<TranslationState>({
    status: 'idle',
    text: null,
  });
  const [isHovering, setIsHovering] = useState(false);
  const canTranslate = shouldTranslateKeyword(keyword);

  const loadTranslation = async () => {
    if (!canTranslate || translation.status !== 'idle') return;

    setTranslation({ status: 'loading', text: null });
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: keyword }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setTranslation({
          status: 'error',
          text: data.requiresKey ? 'DeepL key required' : data.error ?? 'Translation unavailable',
        });
        return;
      }

      setTranslation({
        status: 'ready',
        text: data.translation || 'No translation returned',
      });
    } catch {
      setTranslation({ status: 'error', text: 'Translation unavailable' });
    }
  };

  return (
    <span
      className={`keyword-text translatable-keyword ${canTranslate ? 'can-translate' : ''}`}
      onMouseEnter={() => {
        setIsHovering(true);
        void loadTranslation();
      }}
      onMouseLeave={() => setIsHovering(false)}
    >
      {keyword}
      {canTranslate && isHovering && (
        <span className="translation-tooltip">
          {translation.status === 'loading'
            ? 'Translating...'
            : translation.text ?? 'Translate with DeepL'}
        </span>
      )}
    </span>
  );
}

export default function KeywordTable() {
  const {
    keywords,
    selectedAppId,
    selectedRegion,
    apps,
    selectedKeywordId,
    setSelectedKeyword,
    setDetailPanelOpen,
    setKeywordResearchModalOpen,
    sort,
    setSort,
    filter,
    isRefreshing,
    appImportProgress,
  } = useAppStore();

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    keywordId: string;
  } | null>(null);
  const [selectedBulkKeywordIds, setSelectedBulkKeywordIds] = useState<Set<string>>(new Set());
  const [now, setNow] = useState<number | null>(null);
  const [autoHydrateKey, setAutoHydrateKey] = useState<string | null>(null);
  const currentImportProgress = appImportProgress[appScopeKey(selectedAppId, selectedRegion)];
  const isImportingApp = currentImportProgress?.status === 'loading';

  useEffect(() => {
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(interval);
  }, []);

  const handleContextMenu = (e: React.MouseEvent, keywordId: string) => {
    e.preventDefault();
    setSelectedBulkKeywordIds((current) => {
      if (current.has(keywordId)) return current;
      return new Set([keywordId]);
    });
    setContextMenu({ x: e.clientX, y: e.clientY, keywordId });
  };

  // Filter keywords
  const filtered = keywords.filter((k) => {
    if (k.appId !== selectedAppId) return false;
    if (k.region !== selectedRegion) return false;
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      if (!k.keyword.toLowerCase().includes(searchLower)) return false;
    }
    if (filter.tags.length > 0) {
      if (!k.tags.some((t) => filter.tags.includes(t.id))) return false;
    }
    if (filter.difficulty.length > 0) {
      if (!filter.difficulty.includes(k.difficulty)) return false;
    }
    return true;
  });

  const hasMissingRankingSnapshots = filtered.some((keyword) => !keyword.rankingApps?.length);

  useEffect(() => {
    if (!selectedAppId || !hasMissingRankingSnapshots || isRefreshing) return;

    const hydrationKey = `${selectedRegion}:${selectedAppId}`;
    if (autoHydrateKey === hydrationKey) return;

    setAutoHydrateKey(hydrationKey);
    void runBackgroundSync({
      force: true,
      appId: selectedAppId,
      region: selectedRegion,
    });
  }, [
    autoHydrateKey,
    hasMissingRankingSnapshots,
    isRefreshing,
    selectedAppId,
    selectedRegion,
  ]);

  // Sort keywords
  const sorted = [...filtered].sort((a, b) => {
    const dir = sort.direction === 'asc' ? 1 : -1;
    switch (sort.field) {
      case 'keyword':
        return dir * a.keyword.localeCompare(b.keyword);
      case 'popularity':
        return dir * (a.popularity - b.popularity);
      case 'difficulty':
        return dir * (a.difficultyScore - b.difficultyScore);
      case 'rank': {
        const aRank = a.currentRank ?? 999;
        const bRank = b.currentRank ?? 999;
        return dir * (aRank - bRank);
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
  const sortedIds = sorted.map((keyword) => keyword.id);
  const selectedVisibleCount = sortedIds.filter((id) => selectedBulkKeywordIds.has(id)).length;
  const allVisibleSelected = sorted.length > 0 && selectedVisibleCount === sorted.length;

  useEffect(() => {
    setSelectedBulkKeywordIds((current) => {
      if (current.size === 0) return current;
      const visibleIds = new Set(sortedIds);
      const next = new Set([...current].filter((id) => visibleIds.has(id)));
      if (next.size === current.size) return current;
      return next;
    });
  }, [sortedIds]);

  const handleSort = (field: SortField) => {
    if (sort.field === field) {
      setSort(field, sort.direction === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(field, field === 'keyword' ? 'asc' : 'desc');
    }
  };

  const handleToggleKeywordSelection = (keywordId: string) => {
    setSelectedBulkKeywordIds((current) => {
      const next = new Set(current);
      if (next.has(keywordId)) {
        next.delete(keywordId);
      } else {
        next.add(keywordId);
      }
      return next;
    });
  };

  const handleToggleVisibleSelection = () => {
    setSelectedBulkKeywordIds((current) => {
      if (allVisibleSelected) {
        const next = new Set(current);
        sortedIds.forEach((id) => next.delete(id));
        return next;
      }
      return new Set([...current, ...sortedIds]);
    });
  };

  const handleRowClick = (event: React.MouseEvent, keyword: TrackedKeyword) => {
    if (event.metaKey || event.ctrlKey) {
      handleToggleKeywordSelection(keyword.id);
      return;
    }
    setSelectedKeyword(keyword.id);
    setDetailPanelOpen(true);
  };

  const getPopularityColor = (value: number) => {
    if (value >= 70) return 'var(--color-success)';
    if (value >= 40) return 'var(--accent-primary)';
    if (value >= 20) return 'var(--color-warning)';
    return 'var(--text-tertiary)';
  };

  const formatSource = (source: TrackedKeyword['popularitySource']) => {
    switch (source) {
      case 'apple-search-ads':
        return 'ASA';
      case 'itunes-search':
        return 'iTunes';
      case 'app-store-connect':
        return 'ASC';
      case 'estimated':
      default:
        return 'Est.';
    }
  };

  const formatLastUpdate = (date: string) => {
    const diff = (now ?? new Date(date).getTime()) - new Date(date).getTime();
    const minutes = Math.max(0, Math.floor(diff / 60000));
    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    return new Date(date).toLocaleDateString();
  };

  const rankedAppsForKeyword = (
    kw: TrackedKeyword
  ): { apps: RankingAppSnapshot[]; total: number } => {
    if (kw.rankingApps?.length) {
      return {
        apps: kw.rankingApps.slice(0, 8),
        total: Math.max(kw.rankingResultCount ?? kw.rankingApps.length, kw.rankingApps.length),
      };
    }

    const rankMap: Array<{ appId: string; rank: number | null }> = [
      { appId: kw.appId, rank: kw.currentRank },
      ...Object.entries(kw.competitorRanks ?? {}).map(([appId, rank]) => ({
        appId,
        rank,
      })),
    ];

    const appsForKeyword = rankMap
      .filter((entry) => entry.rank !== null)
      .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
      .map((entry) => {
        const app = apps.find((trackedApp) => trackedApp.id === entry.appId);
        if (!app || entry.rank === null) return null;

        return {
          rank: entry.rank,
          appId: app.id,
          appName: app.name,
          appIcon: app.icon,
          developer: app.developer,
          rating: app.rating,
          ratingCount: app.ratingCount,
          bundleId: app.bundleId,
          url: app.url,
          isSelectedApp: app.id === kw.appId,
          isTrackedCompetitor: app.isCompetitor,
        };
      })
      .filter(Boolean)
      .slice(0, 8) as RankingAppSnapshot[];

    return {
      apps: appsForKeyword,
      total: appsForKeyword.length,
    };
  };

  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sort.field !== field) return null;
    return sort.direction === 'asc' ? (
      <ChevronUp size={12} />
    ) : (
      <ChevronDown size={12} />
    );
  };

  if (sorted.length === 0) {
    const title = !selectedAppId
      ? 'Add an app first'
      : isImportingApp
        ? 'Preparing keyword workspace'
        : currentImportProgress?.status === 'error'
          ? 'Keyword import needs attention'
          : 'No keywords found';
    const text = !selectedAppId
      ? 'Search the App Store to choose an app before tracking keywords.'
      : isImportingApp
        ? currentImportProgress.message ?? 'Checking public Apple suggestions and ranking results.'
        : currentImportProgress?.status === 'error'
          ? currentImportProgress.message ?? 'Starter keywords could not be loaded.'
          : filter.search
            ? 'Try adjusting your search filter'
            : 'Find suggestions or add keywords manually to start tracking.';

    return (
      <div className="empty-state" style={{ flex: 1 }}>
        <div className="empty-state-icon">
          {isImportingApp ? (
            <Loader2 className="spin" size={48} />
          ) : (
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          )}
        </div>
        <div className="empty-state-title">{title}</div>
        <div className="empty-state-text">{text}</div>
        {selectedAppId && !filter.search && !isImportingApp && (
          <button
            className="btn btn-warning"
            style={{ marginTop: 16 }}
            onClick={() => setKeywordResearchModalOpen(true)}
          >
            <Lightbulb size={16} />
            Find Suggestions
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="table-container">
      {currentImportProgress?.message && (
        <div
          className="credential-note"
          style={{
            margin: 'var(--space-sm) var(--space-md)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {isImportingApp && <Loader2 className="spin" size={14} />}
          <span>{currentImportProgress.message}</span>
        </div>
      )}
      <table className="data-table">
        <thead>
          <tr>
            <th style={{ width: '44px' }} onClick={(event) => event.stopPropagation()}>
              <input
                type="checkbox"
                className="keyword-select-checkbox"
                checked={allVisibleSelected}
                aria-label="Select visible keywords"
                onChange={handleToggleVisibleSelection}
              />
            </th>
            <th
              className={sort.field === 'keyword' ? 'sorted' : ''}
              onClick={() => handleSort('keyword')}
              style={{ minWidth: '200px' }}
            >
              <div className="th-content">
                Keyword
                <SortIndicator field="keyword" />
              </div>
            </th>
            <th style={{ width: '70px' }}>
              <div className="th-content">
                Notes
              </div>
            </th>
            <th style={{ minWidth: '130px' }}>
              <div className="th-content">
                Last update
              </div>
            </th>
            <th
              className={sort.field === 'popularity' ? 'sorted' : ''}
              onClick={() => handleSort('popularity')}
              style={{ minWidth: '160px' }}
            >
              <div className="th-content">
                Popularity
                <SortIndicator field="popularity" />
              </div>
            </th>
            <th
              className={sort.field === 'difficulty' ? 'sorted' : ''}
              onClick={() => handleSort('difficulty')}
              style={{ minWidth: '110px' }}
            >
              <div className="th-content">
                Difficulty
                <SortIndicator field="difficulty" />
              </div>
            </th>
            <th
              className={sort.field === 'rank' ? 'sorted' : ''}
              onClick={() => handleSort('rank')}
              style={{ minWidth: '100px' }}
            >
              <div className="th-content">
                Position
                <SortIndicator field="rank" />
              </div>
            </th>
            <th
              className={sort.field === 'change' ? 'sorted' : ''}
              onClick={() => handleSort('change')}
              style={{ minWidth: '90px' }}
            >
              <div className="th-content">
                Change
                <SortIndicator field="change" />
              </div>
            </th>
            <th style={{ minWidth: '170px' }}>Apps in Ranking</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((kw) => {
            const rankedApps = rankedAppsForKeyword(kw);
            const visibleRankingApps = rankedApps.apps.slice(0, 6);
            const hiddenRankingAppCount = Math.max(0, rankedApps.total - visibleRankingApps.length);

            return (
              <tr
                key={kw.id}
                className={`${selectedKeywordId === kw.id ? 'selected' : ''} ${selectedBulkKeywordIds.has(kw.id) ? 'bulk-selected' : ''}`}
                onClick={(event) => handleRowClick(event, kw)}
                onContextMenu={(e) => handleContextMenu(e, kw.id)}
              >
              <td onClick={(event) => event.stopPropagation()}>
                <input
                  type="checkbox"
                  className="keyword-select-checkbox"
                  checked={selectedBulkKeywordIds.has(kw.id)}
                  aria-label={`Select ${kw.keyword}`}
                  onChange={() => handleToggleKeywordSelection(kw.id)}
                />
              </td>
              <td>
                <div className="keyword-cell">
                  <TranslatableKeyword keyword={kw.keyword} />
                  {kw.tags.length > 0 && (
                    <div className="keyword-tags">
                      {kw.tags.map((tag) => (
                        <span
                          key={tag.id}
                          className="keyword-tag-pill"
                          style={{
                            background: `${tag.color}20`,
                            color: tag.color,
                          }}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </td>
              <td>
                <StickyNote
                  size={14}
                  className={`note-indicator ${kw.note ? 'has-note' : ''}`}
                />
              </td>
              <td>
                <span className="last-update-value">{formatLastUpdate(kw.lastUpdated)}</span>
              </td>
              <td>
                <div className="popularity-cell">
                  <div className="popularity-bar-container">
                    <div
                      className="popularity-bar"
                      style={{
                        width: `${kw.popularity}%`,
                        background: getPopularityColor(kw.popularity),
                      }}
                    />
                  </div>
                  <span className="popularity-value">{kw.popularity}</span>
                  <span
                    className={`source-pill ${kw.popularitySource === 'apple-search-ads' ? 'verified' : ''}`}
                    title={
                      kw.popularitySource === 'apple-search-ads'
                        ? 'Apple Search Ads'
                        : 'Estimated until Apple Search Ads is wired'
                    }
                  >
                    {formatSource(kw.popularitySource)}
                  </span>
                </div>
              </td>
              <td>
                <span className={`difficulty-badge ${kw.difficulty}`}>
                  {kw.difficulty}
                </span>
              </td>
              <td>
                <div className="rank-cell">
                  {kw.currentRank ? (
                    <span className={`rank-value ${kw.currentRank <= 3 ? `rank-${kw.currentRank}` : ''}`}>
                      #{kw.currentRank}
                    </span>
                  ) : (
                    <span className="rank-value unranked">—</span>
                  )}
                </div>
              </td>
              <td>
                {kw.rankChange !== null && kw.rankChange !== 0 ? (
                  <span
                    className={`rank-change ${kw.rankChange > 0 ? 'up' : 'down'}`}
                  >
                    {kw.rankChange > 0 ? (
                      <ArrowUp size={12} />
                    ) : (
                      <ArrowDown size={12} />
                    )}
                    {Math.abs(kw.rankChange)}
                  </span>
                ) : (
                  <span className="rank-change neutral">
                    <Minus size={12} />
                  </span>
                )}
              </td>
              <td>
                <div className="ranking-apps">
                  {visibleRankingApps.length > 0 ? (
                    <>
                    {visibleRankingApps.map((app) =>
                      app.appIcon ? (
                        <img
                          key={`${app.appId}-${app.rank}`}
                          src={app.appIcon}
                          alt={app.appName}
                          className={`ranking-app-icon ${app.isSelectedApp ? 'selected' : ''} ${app.isTrackedCompetitor ? 'competitor' : ''}`}
                          title={`#${app.rank} ${app.appName}`}
                        />
                      ) : (
                        <span
                          key={`${app.appId}-${app.rank}`}
                          className={`ranking-app-icon placeholder ${app.isSelectedApp ? 'selected' : ''} ${app.isTrackedCompetitor ? 'competitor' : ''}`}
                          title={`#${app.rank} ${app.appName}`}
                        >
                          {app.appName.charAt(0)}
                        </span>
                      )
                    )
                    }
                    {hiddenRankingAppCount > 0 && (
                      <span className="ranking-app-more">+{hiddenRankingAppCount}</span>
                    )}
                    </>
                  ) : (
                    <span className="rank-value unranked">—</span>
                  )}
                </div>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          keywordId={contextMenu.keywordId}
          selectedKeywordIds={[...selectedBulkKeywordIds]}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
