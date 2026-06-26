'use client';

import React, { useState } from 'react';
import {
  ArrowUp,
  ArrowDown,
  Minus,
  StickyNote,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { TrackedKeyword, SortField } from '@/types';
import ContextMenu from '@/components/ContextMenu';

export default function KeywordTable() {
  const {
    keywords,
    selectedAppId,
    selectedKeywordId,
    setSelectedKeyword,
    setDetailPanelOpen,
    sort,
    setSort,
    filter,
  } = useAppStore();

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    keywordId: string;
  } | null>(null);

  const handleContextMenu = (e: React.MouseEvent, keywordId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, keywordId });
  };

  // Filter keywords
  const filtered = keywords.filter((k) => {
    if (k.appId !== selectedAppId) return false;
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

  const handleSort = (field: SortField) => {
    if (sort.field === field) {
      setSort(field, sort.direction === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(field, field === 'keyword' ? 'asc' : 'desc');
    }
  };

  const handleRowClick = (keyword: TrackedKeyword) => {
    setSelectedKeyword(keyword.id);
    setDetailPanelOpen(true);
  };

  const getPopularityColor = (value: number) => {
    if (value >= 70) return 'var(--color-success)';
    if (value >= 40) return 'var(--accent-primary)';
    if (value >= 20) return 'var(--color-warning)';
    return 'var(--text-tertiary)';
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
    return (
      <div className="empty-state" style={{ flex: 1 }}>
        <div className="empty-state-icon">
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
        </div>
        <div className="empty-state-title">No keywords found</div>
        <div className="empty-state-text">
          {filter.search
            ? 'Try adjusting your search filter'
            : 'Click "Add Keyword" to start tracking keywords'}
        </div>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table className="data-table">
        <thead>
          <tr>
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
                Rank
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
            <th style={{ width: '40px' }}>Note</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((kw) => (
            <tr
              key={kw.id}
              className={selectedKeywordId === kw.id ? 'selected' : ''}
              onClick={() => handleRowClick(kw)}
              onContextMenu={(e) => handleContextMenu(e, kw.id)}
            >
              <td>
                <div className="keyword-cell">
                  <span className="keyword-text">{kw.keyword}</span>
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
                    <span className="rank-value">#{kw.currentRank}</span>
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
                <StickyNote
                  size={14}
                  className={`note-indicator ${kw.note ? 'has-note' : ''}`}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          keywordId={contextMenu.keywordId}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
