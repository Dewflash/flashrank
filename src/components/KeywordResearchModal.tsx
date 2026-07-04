'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Lightbulb, Loader2, Plus, Search, X } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import type { AppMetadata, TrackedKeyword } from '@/types';
import {
  buildRankingSignals,
  slugifyKeyword,
} from '@/lib/keywordHydration';
import type { RankingSignals } from '@/lib/keywordHydration';
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
  opportunityScore: number;
  topApps: AppMetadata[];
  rankingSignals: RankingSignals;
}

const MAX_ROWS = 60;

function uniqueKeywords(values: string[]): string[] {
  const seen = new Set<string>();
  return values
    .map((value) => value.toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((value) => {
      if (value.length < 2 || seen.has(value)) return false;
      seen.add(value);
      return true;
    });
}

function splitSeedInput(value: string): string[] {
  return uniqueKeywords(value.split(/[,\n]/g));
}

function scoreOpportunity(
  popularity: number,
  difficultyScore: number,
  position: number | null,
  hasCompetitor: boolean
): number {
  const rankBonus = position === null ? 16 : Math.max(0, 16 - position);
  const competitorBonus = hasCompetitor ? 8 : 0;
  return Math.round(popularity * 0.7 + (100 - difficultyScore) * 0.3 + rankBonus + competitorBonus);
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
  const competitors = useMemo(
    () => apps.filter((app) => app.isCompetitor && app.region === selectedRegion),
    [apps, selectedRegion]
  );
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
  const [seedInput, setSeedInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setKeywordResearchModalOpen(false);
    setQuery('');
    setSeedInput('');
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
          const rankingSignals = buildRankingSignals(results, selectedApp.id, competitors);
          const hasCompetitor = Object.values(rankingSignals.competitorRanks).some((rank) => rank !== null);
          const position = positionIndex === -1 ? null : positionIndex + 1;

          nextRows.push({
            keyword,
            popularity,
            difficulty: calculateDifficulty(popularity, topRatings),
            difficultyScore,
            position,
            opportunityScore: scoreOpportunity(popularity, difficultyScore, position, hasCompetitor),
            topApps: results.slice(0, 8),
            rankingSignals,
          });
        }

        const sortedRows = nextRows.sort((a, b) => b.opportunityScore - a.opportunityScore);
        setRows(sortedRows);
        setSelected(new Set(sortedRows.slice(0, Math.min(5, sortedRows.length)).map((row) => row.keyword)));
      } catch {
        setRows([]);
        setError('Could not load keyword suggestions right now.');
      } finally {
        setIsLoading(false);
      }
    },
    [competitors, existingKeywords, selectedApp, selectedRegion]
  );

  useEffect(() => {
    if (!isKeywordResearchModalOpen || !selectedApp) return;
    const timer = window.setTimeout(() => {
      void buildRows(seedTerms(selectedApp.name, selectedApp.category));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [buildRows, isKeywordResearchModalOpen, selectedApp]);

  const filteredRows = rows.filter((row) => {
    const normalizedQuery = query.trim().toLowerCase();
    return normalizedQuery ? row.keyword.includes(normalizedQuery) : true;
  });

  const selectedRows = rows.filter((row) => selected.has(row.keyword));

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

  const selectVisibleRows = () => {
    setSelected(new Set(filteredRows.map((row) => row.keyword)));
  };

  const selectTopRows = () => {
    setSelected(new Set(filteredRows.slice(0, Math.min(100, filteredRows.length)).map((row) => row.keyword)));
  };

  const clearSelected = () => setSelected(new Set());

  const runCustomSeeds = () => {
    if (!selectedApp) return;
    const seeds = splitSeedInput(seedInput);
    if (seeds.length === 0) {
      setError('Enter one or more seed keywords separated by commas.');
      return;
    }
    void buildRows(seeds);
  };

  const addSelected = () => {
    if (!selectedAppId) return;

    rows
      .filter((row) => selected.has(row.keyword))
      .forEach((row) => {
        const newKeyword: TrackedKeyword = {
          id: `kw-${selectedRegion}-${selectedAppId}-${slugifyKeyword(row.keyword)}`,
          keyword: row.keyword,
          appId: selectedAppId,
          region: selectedRegion,
          popularity: row.popularity,
          popularitySource: 'estimated',
          difficulty: row.difficulty,
          difficultyScore: row.difficultyScore,
          difficultySource: 'itunes-search',
          currentRank: row.rankingSignals.currentRank,
          previousRank: null,
          rankChange: null,
          rankSource: 'itunes-search',
          competitorRanks: row.rankingSignals.competitorRanks,
          rankingApps: row.rankingSignals.rankingApps,
          tags: genericTag ? [genericTag] : [],
          note: null,
          rankHistory: [
            {
              date: new Date().toISOString(),
              rank: row.rankingSignals.currentRank,
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
            <div className="keyword-seed-input">
              <input
                className="search-input"
                value={seedInput}
                onChange={(event) => setSeedInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    runCustomSeeds();
                  }
                }}
                placeholder="Seed terms, comma separated"
              />
              <button className="btn btn-secondary" onClick={runCustomSeeds} disabled={isLoading}>
                {isLoading ? <Loader2 size={14} className="spin" /> : <Search size={14} />}
                Scan
              </button>
            </div>
            <span className="suggestions-count">
              {isLoading ? 'Searching...' : `Found ${rows.length} suggestions`}
            </span>
          </div>

          <div className="keyword-research-actions">
            <div className="selected-keyword-chips">
              {selectedRows.length === 0 ? (
                <span className="selection-muted">No keywords selected</span>
              ) : (
                selectedRows.slice(0, 12).map((row) => (
                  <button
                    key={row.keyword}
                    className="selected-keyword-chip"
                    onClick={() => toggle(row.keyword)}
                    title="Remove from selected"
                  >
                    {row.keyword}
                    <X size={12} />
                  </button>
                ))
              )}
              {selectedRows.length > 12 && (
                <span className="selection-muted">+{selectedRows.length - 12} more</span>
              )}
            </div>
            <div className="keyword-bulk-actions">
              <button className="btn btn-secondary" onClick={selectTopRows} disabled={filteredRows.length === 0}>
                Select Top {Math.min(100, filteredRows.length) || ''}
              </button>
              <button className="btn btn-secondary" onClick={selectVisibleRows} disabled={filteredRows.length === 0}>
                Select Visible
              </button>
              <button className="btn btn-ghost" onClick={clearSelected} disabled={selected.size === 0}>
                Clear
              </button>
            </div>
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
                    <th>Opportunity</th>
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
                        <span className="source-pill verified">{row.opportunityScore}</span>
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
            Add {selected.size || ''} Keyword{selected.size === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>
  );
}
