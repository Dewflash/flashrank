'use client';

import React, { useState } from 'react';
import { Search, Plus, Download, RefreshCw, Lightbulb, Trash2 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import RegionSelector from '@/components/RegionSelector';
import { runBackgroundSync } from '@/lib/syncEngine';
import type { RankStatusFilter } from '@/types';

export default function HeaderBar() {
  const {
    viewMode,
    filter,
    setSearchFilter,
    setRankStatusFilter,
    keywords,
    selectedAppId,
    selectedRegion,
    setSelectedRegion,
    setAddKeywordModalOpen,
    setKeywordResearchModalOpen,
    removeKeywordsForAppRegion,
    isRefreshing,
    syncProgress,
  } = useAppStore();

  const [refreshError, setRefreshError] = useState<string | null>(null);
  const keywordCount = keywords.filter(
    (k) => k.appId === selectedAppId && k.region === selectedRegion
  ).length;

  const handleExport = () => {
    const appKeywords = keywords.filter((k) => k.appId === selectedAppId && k.region === selectedRegion);
    const csvHeader = 'Keyword,Popularity,Difficulty,Rank,Rank Status,Rank Status Message,Change,Tags\n';
    const csvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
    const csvRows = appKeywords
      .map(
        (k) =>
          [
            csvCell(k.keyword),
            k.popularity,
            k.difficulty,
            k.currentRank ?? 'N/A',
            k.rankStatus ?? 'unknown',
            csvCell(k.rankStatusMessage ?? ''),
            k.rankChange ?? 0,
            csvCell(k.tags.map((t) => t.name).join(', ')),
          ].join(',')
      )
      .join('\n');
    const csv = csvHeader + csvRows;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `keywords-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRefresh = async () => {
    setRefreshError(null);
    try {
      await runBackgroundSync({
        force: true,
        appId: selectedAppId,
        region: selectedRegion,
      });
    } catch {
      setRefreshError('Refresh failed');
      window.setTimeout(() => setRefreshError(null), 3000);
    }
  };

  const handleClearKeywords = () => {
    if (!selectedAppId || keywordCount === 0) return;
    const confirmed = window.confirm(
      `Clear ${keywordCount} keyword${keywordCount === 1 ? '' : 's'} for this app in ${selectedRegion.toUpperCase()}?`
    );
    if (!confirmed) return;
    removeKeywordsForAppRegion(selectedAppId, selectedRegion);
  };

  const titleMap = {
    keywords: 'Keywords',
    competitors: 'Competitors',
    overview: 'Overview',
    ratings: 'Ratings & Reviews',
  };

  return (
    <div className="header-bar">
      <div className="header-left">
        <h1 className="header-title">{titleMap[viewMode]}</h1>
        {viewMode === 'keywords' && (
          <span className="header-keyword-count">
            {keywordCount} keyword{keywordCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      <div className="header-right">
        {viewMode === 'keywords' && (
          <>
            <div className="search-container">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                className="search-input"
                placeholder="Filter keywords..."
                value={filter.search}
                onChange={(e) => setSearchFilter(e.target.value)}
              />
            </div>
            <select
              className="rank-filter-select"
              value={filter.rankStatus}
              onChange={(event) => setRankStatusFilter(event.target.value as RankStatusFilter)}
              aria-label="Filter by ranking status"
              title="Filter by ranking status"
            >
              <option value="all">All ranks</option>
              <option value="ranked">Ranked</option>
              <option value="unranked">Unranked</option>
              <option value="pending">Pending</option>
              <option value="error">Errors</option>
            </select>
            <RegionSelector value={selectedRegion} onChange={setSelectedRegion} />
            <button
              className="btn btn-secondary btn-icon tooltip"
              onClick={handleRefresh}
              data-tooltip={
                !selectedAppId
                  ? 'Add an app first'
                  : refreshError || syncProgress.message || 'Refresh rankings'
              }
              disabled={isRefreshing || !selectedAppId}
            >
              <RefreshCw
                size={16}
                className={isRefreshing ? 'spin' : ''}
                style={{
                  animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
                }}
              />
            </button>
            {isRefreshing && syncProgress.total > 0 && (
              <div className="sync-progress-pill" title={syncProgress.message ?? undefined}>
                <span>
                  {syncProgress.completed}/{syncProgress.total}
                </span>
                <div className="sync-progress-track">
                  <div
                    className="sync-progress-fill"
                    style={{
                      width: `${Math.round((syncProgress.completed / syncProgress.total) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}
            {!isRefreshing && syncProgress.status === 'error' && syncProgress.message && (
              <div className="sync-error-pill" title={syncProgress.message}>
                {syncProgress.message}
              </div>
            )}
            <button
              className="btn btn-secondary btn-icon tooltip"
              onClick={handleExport}
              data-tooltip={selectedAppId ? 'Export CSV' : 'Add an app first'}
              disabled={!selectedAppId}
            >
              <Download size={16} />
            </button>
            <button
              className="btn btn-secondary btn-icon tooltip"
              onClick={handleClearKeywords}
              data-tooltip={
                keywordCount > 0
                  ? 'Clear keywords for this app and region'
                  : selectedAppId
                    ? 'No keywords to clear'
                    : 'Add an app first'
              }
              disabled={!selectedAppId || keywordCount === 0}
            >
              <Trash2 size={16} />
            </button>
            <button
              className="btn btn-warning"
              onClick={() => setKeywordResearchModalOpen(true)}
              disabled={!selectedAppId}
            >
              <Lightbulb size={16} />
              Find Suggestions
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setAddKeywordModalOpen(true)}
              disabled={!selectedAppId}
            >
              <Plus size={16} />
              Add Keywords
            </button>
          </>
        )}
      </div>
    </div>
  );
}
