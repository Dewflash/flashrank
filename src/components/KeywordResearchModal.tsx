'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Lightbulb, Loader2, Plus, Search, X } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import type { AppMetadata, TrackedKeyword } from '@/types';
import {
  buildRankingSignals,
  describeRankStatus,
  PUBLIC_RANKING_RESULT_LIMIT,
  slugifyKeyword,
} from '@/lib/keywordHydration';
import type { RankingSignals } from '@/lib/keywordHydration';
import {
  calculateDifficulty,
  calculateDifficultyScore,
  calculatePopularity,
  getKeywordSuggestions,
  lookupApp,
  searchApps,
} from '@/lib/api';
import { buildContextualKeywordSeeds } from '@/lib/keywordSeeds';

interface SuggestionRow {
  keyword: string;
  popularity: number;
  difficulty: TrackedKeyword['difficulty'];
  difficultyScore: number;
  position: number | null;
  opportunityScore: number;
  topApps: AppMetadata[];
  rankingResultCount: number;
  rankingSignals: RankingSignals;
}

const MAX_ROWS = 80;
const MAX_EXPANSION_ROUNDS = 2;
const MAX_EXPANSION_FRONTIER = 14;
type SuggestionSortField = 'opportunity' | 'popularity' | 'difficulty' | 'position' | 'apps';
type SuggestionFilter = 'all' | 'low' | 'medium' | 'high';

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

function appTermSeeds(app: AppMetadata): string[] {
  return uniqueKeywords([
    app.name,
    app.developer,
    app.category,
    ...(app.genres ?? []),
    ...buildContextualKeywordSeeds(app),
  ]).slice(0, 16);
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
  const rankedKeywordCount = useMemo(
    () =>
      keywords.filter(
        (kw) =>
          kw.appId === selectedAppId &&
          kw.region === selectedRegion &&
          kw.currentRank !== null
      ).length,
    [keywords, selectedAppId, selectedRegion]
  );

  const genericTag = tags.find((tag) => tag.name.toLowerCase() === 'generic');
  const [rows, setRows] = useState<SuggestionRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [seedInput, setSeedInput] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<SuggestionFilter>('all');
  const [popularityFilter, setPopularityFilter] = useState<SuggestionFilter>('all');
  const [sortField, setSortField] = useState<SuggestionSortField>('opportunity');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setKeywordResearchModalOpen(false);
    setQuery('');
    setSeedInput('');
    setError(null);
  };

  const buildRows = useCallback(
    async (terms: string[], sourceApp: AppMetadata = selectedApp as AppMetadata) => {
      if (!selectedApp) return;
      setIsLoading(true);
      setError(null);

      try {
        const competitorTerms = competitors.flatMap(appTermSeeds);
        const explored = new Set<string>();
        const expandedTerms: string[] = [];
        let frontier = uniqueKeywords([
          ...terms,
          ...buildContextualKeywordSeeds(sourceApp),
          ...competitorTerms,
        ]).slice(0, MAX_EXPANSION_FRONTIER);

        for (let round = 0; round < MAX_EXPANSION_ROUNDS; round += 1) {
          const seeds = frontier.filter((term) => !explored.has(term));
          if (seeds.length === 0) break;
          seeds.forEach((term) => explored.add(term));
          expandedTerms.push(...seeds);
          setError(null);

          const hinted = await Promise.all(
            seeds.map(async (term) => {
              try {
                return await getKeywordSuggestions(term);
              } catch {
                return [];
              }
            })
          );
          const rankingDerived = await Promise.all(
            seeds.slice(0, 6).map(async (term) => {
              try {
                const appsForTerm = await searchApps(term, selectedRegion, 8);
                return appsForTerm.flatMap(appTermSeeds);
              } catch {
                return [];
              }
            })
          );

          frontier = uniqueKeywords([
            ...hinted.flat(),
            ...rankingDerived.flat(),
          ])
            .filter((term) => !explored.has(term))
            .slice(0, MAX_EXPANSION_FRONTIER);
        }

        const candidates = uniqueKeywords([
          ...expandedTerms,
        ])
          .filter((keyword) => !existingKeywords.has(keyword))
          .slice(0, MAX_ROWS);

        const nextRows: SuggestionRow[] = [];
        for (const keyword of candidates) {
          const popularity = calculatePopularity(keyword);
          let results: AppMetadata[] = [];
          try {
            results = await searchApps(keyword, selectedRegion, PUBLIC_RANKING_RESULT_LIMIT);
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
            rankingResultCount: rankingSignals.rankingResultCount,
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
      void (async () => {
        const enrichedApp = await lookupApp(selectedApp.id, selectedRegion).catch(() => null);
        const sourceApp = enrichedApp ?? selectedApp;
        await buildRows(buildContextualKeywordSeeds(sourceApp), sourceApp);
      })();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [buildRows, isKeywordResearchModalOpen, selectedApp, selectedRegion]);

  const filteredRows = rows.filter((row) => {
    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery && !row.keyword.includes(normalizedQuery)) return false;
    if (difficultyFilter !== 'all' && row.difficulty !== difficultyFilter) return false;
    if (popularityFilter === 'high' && row.popularity < 70) return false;
    if (popularityFilter === 'medium' && (row.popularity < 35 || row.popularity >= 70)) return false;
    if (popularityFilter === 'low' && row.popularity >= 35) return false;
    return true;
  });
  const rankedSuggestionCount = rows.filter((row) => row.position !== null).length;

  const sortedRows = [...filteredRows].sort((a, b) => {
    const dir = sortDirection === 'asc' ? 1 : -1;
    switch (sortField) {
      case 'popularity':
        return dir * (a.popularity - b.popularity);
      case 'difficulty':
        return dir * (a.difficultyScore - b.difficultyScore);
      case 'position': {
        const aPosition = a.position ?? 999;
        const bPosition = b.position ?? 999;
        return dir * (aPosition - bPosition);
      }
      case 'apps':
        return dir * (a.rankingResultCount - b.rankingResultCount);
      case 'opportunity':
      default:
        return dir * (a.opportunityScore - b.opportunityScore);
    }
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
    setSelected(new Set(sortedRows.map((row) => row.keyword)));
  };

  const selectTopRows = () => {
    setSelected(new Set(sortedRows.slice(0, Math.min(100, sortedRows.length)).map((row) => row.keyword)));
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
        const rankStatus = describeRankStatus({
          currentRank: row.rankingSignals.currentRank,
          rankingResultCount: row.rankingSignals.rankingResultCount,
          sourceStatus: row.rankingSignals.sourceStatus,
        });
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
          rankingResultCount: row.rankingSignals.rankingResultCount,
          ...rankStatus,
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

  const handleSort = (field: SuggestionSortField) => {
    if (sortField === field) {
      setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortField(field);
    setSortDirection(field === 'position' ? 'asc' : 'desc');
  };

  const renderSortIndicator = (field: SuggestionSortField) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
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
              {rows.length > 0
                ? `${selectedApp?.name ?? 'Selected app'} ranks in ${rankedSuggestionCount.toLocaleString()} of ${rows.length.toLocaleString()} scanned suggestions in ${selectedRegion.toUpperCase()}`
                : `${rankedKeywordCount.toLocaleString()} tracked ranked keyword${rankedKeywordCount === 1 ? '' : 's'} in ${selectedRegion.toUpperCase()}`}
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

          <div className="keyword-research-filters">
            <label>
              Popularity
              <select
                value={popularityFilter}
                onChange={(event) => setPopularityFilter(event.target.value as SuggestionFilter)}
              >
                <option value="all">All</option>
                <option value="high">High 70+</option>
                <option value="medium">Medium 35-69</option>
                <option value="low">Low below 35</option>
              </select>
            </label>
            <label>
              Difficulty
              <select
                value={difficultyFilter}
                onChange={(event) => setDifficultyFilter(event.target.value as SuggestionFilter)}
              >
                <option value="all">All</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <span className="selection-muted">
              Showing {sortedRows.length} of {rows.length}; built from app/category seeds and Apple search hints.
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
              <button className="btn btn-secondary" onClick={selectTopRows} disabled={sortedRows.length === 0}>
                Select Top {Math.min(100, sortedRows.length) || ''}
              </button>
              <button className="btn btn-secondary" onClick={selectVisibleRows} disabled={sortedRows.length === 0}>
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
                    <th onClick={() => handleSort('popularity')}>
                      <div className="th-content">Popularity {renderSortIndicator('popularity')}</div>
                    </th>
                    <th onClick={() => handleSort('difficulty')}>
                      <div className="th-content">Difficulty {renderSortIndicator('difficulty')}</div>
                    </th>
                    <th onClick={() => handleSort('position')}>
                      <div className="th-content">Position {renderSortIndicator('position')}</div>
                    </th>
                    <th onClick={() => handleSort('opportunity')}>
                      <div className="th-content">Opportunity {renderSortIndicator('opportunity')}</div>
                    </th>
                    <th onClick={() => handleSort('apps')}>
                      <div className="th-content">Apps in Ranking {renderSortIndicator('apps')}</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((row) => (
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
                          {row.rankingResultCount > 6 && (
                            <span className="ranking-app-more">+{row.rankingResultCount - 6}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sortedRows.length === 0 && (
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
