'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Lightbulb, Loader2, Plus, Search, X } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import type { AppMetadata, TrackedKeyword } from '@/types';
import {
  calculateDifficulty,
  calculateDifficultyScore,
  calculatePopularity,
  getKeywordSuggestions,
  searchApps,
} from '@/lib/api';

interface SuggestionRow {
  keyword: string;
  popularity: number;
  difficulty: TrackedKeyword['difficulty'];
  difficultyScore: number;
  position: number | null;
  topApps: AppMetadata[];
}

const MAX_ROWS = 18;

function uniqueKeywords(values: string[]): string[] {
  const seen = new Set<string>();
  return values
    .map((value) => value.trim().toLowerCase())
    .filter((value) => {
      if (value.length < 2 || seen.has(value)) return false;
      seen.add(value);
      return true;
    });
}

function seedTerms(appName: string, category: string): string[] {
  const normalizedName = appName.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ');
  const words = normalizedName.split(/\s+/).filter((word) => word.length > 2);

  return uniqueKeywords([
    normalizedName,
    ...words,
    `${normalizedName} app`,
    `${normalizedName} tracker`,
    `${normalizedName} alternative`,
    category.toLowerCase(),
  ]).slice(0, 5);
}

export default function KeywordResearchModal() {
  const {
    isKeywordResearchModalOpen,
    setKeywordResearchModalOpen,
    selectedAppId,
    selectedRegion,
    apps,
    keywords,
    tags,
    addKeyword,
  } = useAppStore();

  const selectedApp = apps.find((app) => app.id === selectedAppId);
  const existingKeywords = useMemo(
    () =>
      new Set(
        keywords
          .filter((kw) => kw.appId === selectedAppId && kw.region === selectedRegion)
          .map((kw) => kw.keyword.toLowerCase())
      ),
    [keywords, selectedAppId, selectedRegion]
  );

  const genericTag = tags.find((tag) => tag.name.toLowerCase() === 'generic');
  const [rows, setRows] = useState<SuggestionRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setKeywordResearchModalOpen(false);
    setQuery('');
    setError(null);
  };

  const buildRows = useCallback(
    async (terms: string[]) => {
      if (!selectedApp) return;
      setIsLoading(true);
      setError(null);

      try {
        const hinted = await Promise.all(
          terms.map(async (term) => {
            try {
              return await getKeywordSuggestions(term);
            } catch {
              return [];
            }
          })
        );

        const candidates = uniqueKeywords([
          ...terms,
          ...hinted.flat(),
          `${selectedApp.name} game`,
          `${selectedApp.name} free`,
          `best ${selectedApp.category.toLowerCase()} apps`,
        ])
          .filter((keyword) => !existingKeywords.has(keyword))
          .slice(0, MAX_ROWS);

        const nextRows: SuggestionRow[] = [];
        for (const keyword of candidates) {
          const popularity = calculatePopularity(keyword);
          let results: AppMetadata[] = [];
          try {
            results = await searchApps(keyword, selectedRegion, 25);
          } catch {
            results = [];
          }

          const topRatings = results.slice(0, 10).map((app) => app.ratingCount);
          const difficultyScore = calculateDifficultyScore(popularity, topRatings);
          const positionIndex = results.findIndex((app) => app.id === selectedApp.id);

          nextRows.push({
            keyword,
            popularity,
            difficulty: calculateDifficulty(popularity, topRatings),
            difficultyScore,
            position: positionIndex === -1 ? null : positionIndex + 1,
            topApps: results.slice(0, 8),
          });
        }

        setRows(nextRows);
        setSelected(new Set(nextRows.slice(0, Math.min(5, nextRows.length)).map((row) => row.keyword)));
      } catch {
        setRows([]);
        setError('Could not load keyword suggestions right now.');
      } finally {
        setIsLoading(false);
      }
    },
    [existingKeywords, selectedApp, selectedRegion]
  );

  useEffect(() => {
    if (!isKeywordResearchModalOpen || !selectedApp) return;
    const timer = window.setTimeout(() => {
      void buildRows(seedTerms(selectedApp.name, selectedApp.category));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [buildRows, isKeywordResearchModalOpen, selectedApp]);

  const filteredRows = rows.filter((row) =>
    query.trim() ? row.keyword.includes(query.trim().toLowerCase()) : true
  );

  const toggle = (keyword: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(keyword)) {
        next.delete(keyword);
      } else {
        next.add(keyword);
      }
      return next;
    });
  };

  const addSelected = () => {
    if (!selectedAppId) return;

    rows
      .filter((row) => selected.has(row.keyword))
      .forEach((row) => {
        const newKeyword: TrackedKeyword = {
          id: `kw-${Date.now()}-${row.keyword.replace(/[^a-z0-9]+/g, '-')}`,
          keyword: row.keyword,
          appId: selectedAppId,
          region: selectedRegion,
          popularity: row.popularity,
          popularitySource: 'estimated',
          difficulty: row.difficulty,
          difficultyScore: row.difficultyScore,
          difficultySource: 'itunes-search',
          currentRank: row.position,
          previousRank: null,
          rankChange: null,
          rankSource: 'itunes-search',
          competitorRanks: {},
          tags: genericTag ? [genericTag] : [],
          note: null,
          rankHistory: [
            {
              date: new Date().toISOString(),
              rank: row.position,
            },
          ],
          lastUpdated: new Date().toISOString(),
          addedAt: new Date().toISOString(),
        };
        addKeyword(newKeyword);
      });

    close();
  };

  if (!isKeywordResearchModalOpen) return null;

  return (
    <div className="modal-overlay" onClick={close}>
      <div className="modal keyword-research-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Lightbulb size={18} />
              Keyword Suggestions
            </h2>
            <div className="modal-subtitle">
              {selectedApp?.name ?? 'Selected app'} in {selectedRegion.toUpperCase()}
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={close}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body keyword-research-body">
          <div className="keyword-research-toolbar">
            <div className="search-container keyword-research-search">
              <Search size={16} className="search-icon" />
              <input
                className="search-input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search suggestions..."
              />
            </div>
            <span className="suggestions-count">
              {isLoading ? 'Searching...' : `Found ${rows.length} suggestions`}
            </span>
          </div>

          {error && <div className="credential-note">{error}</div>}

          {isLoading ? (
            <div className="empty-state" style={{ minHeight: 280 }}>
              <Loader2 className="spin" size={28} />
              <div className="empty-state-title">Finding keyword ideas</div>
              <div className="empty-state-text">Checking Apple suggestions and ranking results.</div>
            </div>
          ) : (
            <div className="keyword-research-table-wrap">
              <table className="data-table keyword-research-table">
                <thead>
                  <tr>
                    <th style={{ width: 44 }}>Add</th>
                    <th>Keyword</th>
                    <th>Popularity</th>
                    <th>Difficulty</th>
                    <th>Position</th>
                    <th>Apps in Ranking</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.keyword} onClick={() => toggle(row.keyword)}>
                      <td>
                        <span className={`select-dot ${selected.has(row.keyword) ? 'selected' : ''}`}>
                          {selected.has(row.keyword) && <Check size={12} />}
                        </span>
                      </td>
                      <td>
                        <span className="keyword-text">{row.keyword}</span>
                      </td>
                      <td>
                        <div className="popularity-cell">
                          <div className="popularity-bar-container">
                            <div
                              className="popularity-bar"
                              style={{ width: `${row.popularity}%` }}
                            />
                          </div>
                          <span className="popularity-value">{row.popularity}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`difficulty-badge ${row.difficulty}`}>
                          {row.difficultyScore}
                        </span>
                      </td>
                      <td>
                        {row.position ? (
                          <span className={`rank-value ${row.position <= 3 ? `rank-${row.position}` : ''}`}>
                            #{row.position}
                          </span>
                        ) : (
                          <span className="rank-value unranked">—</span>
                        )}
                      </td>
                      <td>
                        <div className="ranking-apps">
                          {row.topApps.slice(0, 6).map((app) => (
                            app.icon ? (
                              <img
                                key={app.id}
                                src={app.icon}
                                alt={app.name}
                                className="ranking-app-icon"
                              />
                            ) : (
                              <span key={app.id} className="ranking-app-icon placeholder">
                                {app.name.charAt(0)}
                              </span>
                            )
                          ))}
                          {row.topApps.length > 6 && (
                            <span className="ranking-app-more">+{row.topApps.length - 6}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredRows.length === 0 && (
                <div className="empty-state">
                  <div className="empty-state-title">No suggestions match</div>
                  <div className="empty-state-text">Clear the filter or run another app search.</div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={close}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={addSelected} disabled={selected.size === 0}>
            <Plus size={14} />
            Add {selected.size || ''} Keywords
          </button>
        </div>
      </div>
    </div>
  );
}
