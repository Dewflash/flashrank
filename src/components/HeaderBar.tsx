'use client';

import React, { useState } from 'react';
import { Search, Plus, Download, RefreshCw, Lightbulb } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import RegionSelector from '@/components/RegionSelector';
import { runBackgroundSync } from '@/lib/syncEngine';

export default function HeaderBar() {
  const {
    viewMode,
    filter,
    setSearchFilter,
    keywords,
    selectedAppId,
    selectedRegion,
    setSelectedRegion,
    setAddKeywordModalOpen,
    setKeywordResearchModalOpen,
    isRefreshing,
    syncProgress,
  } = useAppStore();

  const [refreshError, setRefreshError] = useState<string | null>(null);
  const keywordCount = keywords.filter(
    (k) => k.appId === selectedAppId && k.region === selectedRegion
  ).length;

  const handleExport = () => {
    const appKeywords = keywords.filter((k) => k.appId === selectedAppId && k.region === selectedRegion);
    const csvHeader = 'Keyword,Popularity,Difficulty,Rank,Change,Tags\n';
    const csvRows = appKeywords
      .map(
        (k) =>
          `"${k.keyword}",${k.popularity},${k.difficulty},${k.currentRank ?? 'N/A'},${k.rankChange ?? 0},"${k.tags.map((t) => t.name).join(', ')}"`
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
            <RegionSelector value={selectedRegion} onChange={setSelectedRegion} />
            <button
              className="btn btn-secondary btn-icon tooltip"
              onClick={handleRefresh}
              data-tooltip={refreshError || syncProgress.message || 'Refresh rankings'}
              disabled={isRefreshing}
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
              data-tooltip="Export CSV"
            >
              <Download size={16} />
            </button>
            <button
              className="btn btn-warning"
              onClick={() => setKeywordResearchModalOpen(true)}
            >
              <Lightbulb size={16} />
              Find Suggestions
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setAddKeywordModalOpen(true)}
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
