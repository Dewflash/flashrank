'use client';

import React from 'react';
import { Search, Plus, Download, RefreshCw } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

export default function HeaderBar() {
  const {
    viewMode,
    filter,
    setSearchFilter,
    keywords,
    selectedAppId,
    setAddKeywordModalOpen,
    isRefreshing,
    setRefreshing,
  } = useAppStore();

  const keywordCount = keywords.filter((k) => k.appId === selectedAppId).length;

  const handleExport = () => {
    const appKeywords = keywords.filter((k) => k.appId === selectedAppId);
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

  const handleRefresh = () => {
    setRefreshing(true);
    // Simulate refresh
    setTimeout(() => setRefreshing(false), 2000);
  };

  const titleMap = {
    keywords: 'Keywords',
    competitors: 'Competitors',
    overview: 'Overview',
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
            <button
              className="btn btn-secondary btn-icon tooltip"
              onClick={handleRefresh}
              data-tooltip="Refresh data"
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
            <button
              className="btn btn-secondary btn-icon tooltip"
              onClick={handleExport}
              data-tooltip="Export CSV"
            >
              <Download size={16} />
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setAddKeywordModalOpen(true)}
            >
              <Plus size={16} />
              Add Keyword
            </button>
          </>
        )}
      </div>
    </div>
  );
}
