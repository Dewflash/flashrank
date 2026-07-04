'use client';

import React from 'react';
import { Users, Plus, Trash2, ArrowUp, ArrowDown, Search, Loader2 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import type { RankingAppSnapshot, TrackedApp, TrackedKeyword } from '@/types';
import {
  calculateDifficulty,
  calculateDifficultyScore,
  calculatePopularity,
  getKeywordSuggestions,
} from '@/lib/api';
import {
  fetchRankingSignals,
  hydrateKeywordRanking,
  slugifyKeyword,
} from '@/lib/keywordHydration';
import type { RankingSignals } from '@/lib/keywordHydration';

const MAX_EXTRACTED_KEYWORDS = 18;
const MAX_SCANNED_CANDIDATES = 60;

interface ExtractOpportunity {
  keyword: string;
  yourRank: number | null;
  competitorRank: number;
  popularity: number;
  difficultyScore: number;
  opportunityScore: number;
  added: boolean;
}

interface ExtractReport {
  scanned: number;
  matched: number;
  added: number;
  updated: number;
  opportunities: ExtractOpportunity[];
}

interface ScoredOpportunity extends ExtractOpportunity {
  signals: RankingSignals;
}

function uniqueTerms(values: string[]): string[] {
  const seen = new Set<string>();
  return values
    .map((value) => value.toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((value) => {
      if (value.length < 2 || seen.has(value)) return false;
      seen.add(value);
      return true;
    });
}

function competitorSeedTerms(app: TrackedApp): string[] {
  const name = app.name.toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim();
  const words = name.split(/\s+/).filter((word) => word.length > 2);
  const category = app.category.toLowerCase();

  return uniqueTerms([
    name,
    ...words,
    `${name} app`,
    `${name} game`,
    `${name} alternative`,
    `${category} apps`,
    `best ${category} apps`,
  ]).slice(0, 8);
}

function opportunityScore(
  popularity: number,
  difficultyScore: number,
  yourRank: number | null,
  competitorRank: number
): number {
  const competitorLead =
    yourRank === null ? Math.max(0, 32 - competitorRank) : Math.max(0, yourRank - competitorRank);
  const difficultyBonus = Math.max(0, 100 - difficultyScore);
  return Math.round(popularity * 0.55 + competitorLead * 1.5 + difficultyBonus * 0.25);
}

export default function CompetitorsView() {
  const {
    apps,
    keywords,
    selectedAppId,
    selectedRegion,
    addApp,
    removeApp,
    setAddAppModalOpen,
    setAddAppMode,
    addKeyword,
    upsertKeywords,
    tags,
  } = useAppStore();
  const [extractingId, setExtractingId] = React.useState<string | null>(null);
  const [extractMessages, setExtractMessages] = React.useState<Record<string, string>>({});
  const [extractReports, setExtractReports] = React.useState<Record<string, ExtractReport>>({});

  const competitors = apps.filter((a) => a.isCompetitor && a.region === selectedRegion);
  const primaryApp = apps.find((a) => a.id === selectedAppId);
  const appKeywords = keywords.filter(
    (k) => k.appId === selectedAppId && k.region === selectedRegion
  );
  const competitorTag = tags.find((tag) => tag.name.toLowerCase() === 'competitor');

  const strongestCompetitorForKeyword = React.useCallback(
    (keyword: TrackedKeyword) => {
      return competitors
        .map((competitor) => {
          const rank =
            keyword.competitorRanks?.[competitor.id] ??
            keyword.rankingApps?.find((app) => app.appId === competitor.id)?.rank ??
            null;
          return rank === null ? null : { competitor, rank };
        })
        .filter((value): value is { competitor: TrackedApp; rank: number } => value !== null)
        .sort((a, b) => a.rank - b.rank)[0] ?? null;
    },
    [competitors]
  );

  const competitorStats = React.useMemo(() => {
    return new Map(
      competitors.map((competitor) => {
        let shared = 0;
        let top10 = 0;
        let outranking = 0;
        let bestRank: number | null = null;

        appKeywords.forEach((keyword) => {
          const observedRank =
            keyword.competitorRanks?.[competitor.id] ??
            keyword.rankingApps?.find((app) => app.appId === competitor.id)?.rank ??
            null;
          if (observedRank === null) return;

          shared += 1;
          if (observedRank <= 10) top10 += 1;
          bestRank = bestRank === null ? observedRank : Math.min(bestRank, observedRank);
          if (keyword.currentRank === null || observedRank < keyword.currentRank) {
            outranking += 1;
          }
        });

        return [
          competitor.id,
          {
            shared,
            top10,
            outranking,
            bestRank,
          },
        ];
      })
    );
  }, [appKeywords, competitors]);

  const observedCompetitors = React.useMemo(() => {
    const knownAppIds = new Set(apps.filter((app) => app.region === selectedRegion).map((app) => app.id));
    const byAppId = new Map<
      string,
      {
        snapshot: RankingAppSnapshot;
        appearances: number;
        bestRank: number;
        outranking: number;
      }
    >();

    appKeywords.forEach((keyword) => {
      (keyword.rankingApps ?? []).forEach((snapshot) => {
        if (snapshot.isSelectedApp || knownAppIds.has(snapshot.appId)) return;

        const existing = byAppId.get(snapshot.appId);
        const outranksSelected = keyword.currentRank === null || snapshot.rank < keyword.currentRank ? 1 : 0;

        if (!existing) {
          byAppId.set(snapshot.appId, {
            snapshot,
            appearances: 1,
            bestRank: snapshot.rank,
            outranking: outranksSelected,
          });
          return;
        }

        existing.appearances += 1;
        existing.bestRank = Math.min(existing.bestRank, snapshot.rank);
        existing.outranking += outranksSelected;
      });
    });

    return Array.from(byAppId.values())
      .sort((a, b) => {
        if (b.outranking !== a.outranking) return b.outranking - a.outranking;
        if (b.appearances !== a.appearances) return b.appearances - a.appearances;
        return a.bestRank - b.bestRank;
      })
      .slice(0, 6);
  }, [appKeywords, apps, selectedRegion]);

  const trackObservedCompetitor = async (snapshot: RankingAppSnapshot) => {
    if (!selectedAppId || !primaryApp || extractingId) return;

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setExtractMessages((current) => ({
        ...current,
        [snapshot.appId]: 'No Internet Connection. Competitor comparisons were not updated.',
      }));
      return;
    }

    const competitor: TrackedApp = {
      id: snapshot.appId,
      name: snapshot.appName,
      developer: snapshot.developer,
      icon: snapshot.appIcon,
      price: 'Free',
      rating: snapshot.rating,
      ratingCount: snapshot.ratingCount,
      category: primaryApp.category,
      platform: primaryApp.platform,
      bundleId: snapshot.bundleId,
      url: snapshot.url,
      isCompetitor: true,
      region: selectedRegion,
      addedAt: new Date().toISOString(),
    };

    setExtractingId(competitor.id);
    setExtractMessages((current) => ({
      ...current,
      [competitor.id]: 'Adding competitor and backfilling comparisons...',
    }));

    try {
      addApp(competitor);
      const nextCompetitors = [
        ...competitors.filter((app) => app.id !== competitor.id),
        competitor,
      ];
      const hydrated = [];
      for (const keyword of appKeywords) {
        hydrated.push(
          await hydrateKeywordRanking(keyword, selectedAppId, selectedRegion, nextCompetitors)
        );
      }
      upsertKeywords(hydrated);
      setExtractMessages((current) => ({
        ...current,
        [competitor.id]: `Added from observed rankings and compared against ${hydrated.length} keyword${hydrated.length === 1 ? '' : 's'}.`,
      }));
    } catch {
      setExtractMessages((current) => ({
        ...current,
        [competitor.id]: 'Could not add this competitor. Check the network and try again.',
      }));
    } finally {
      setExtractingId(null);
    }
  };

  const extractCompetitorKeywords = async (competitor: TrackedApp) => {
    if (!selectedAppId || !primaryApp || extractingId) return;

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setExtractMessages((current) => ({
        ...current,
        [competitor.id]: 'No Internet Connection. Competitor keyword extraction was not started.',
      }));
      return;
    }

    setExtractingId(competitor.id);
    setExtractMessages((current) => ({
      ...current,
      [competitor.id]: 'Scanning public App Store rankings...',
    }));

    const existing = new Set(
      keywords
        .filter((keyword) => keyword.appId === selectedAppId && keyword.region === selectedRegion)
        .map((keyword) => keyword.keyword.toLowerCase())
    );

    try {
      const seeds = competitorSeedTerms(competitor);
      const hinted = await Promise.all(
        seeds.map(async (seed) => {
          try {
            return await getKeywordSuggestions(seed);
          } catch {
            return [];
          }
        })
      );

      const candidates = uniqueTerms([
        ...seeds,
        ...hinted.flat(),
        primaryApp.name,
        primaryApp.category,
        `${primaryApp.category} apps`,
        `best ${primaryApp.category} apps`,
        `${primaryApp.name} alternative`,
        ...appKeywords.map((keyword) => keyword.keyword),
      ])
        .filter((keyword) => !existing.has(keyword))
        .slice(0, MAX_SCANNED_CANDIDATES);

      const hydratedExisting: TrackedKeyword[] = [];
      const opportunities: ScoredOpportunity[] = [];
      for (const keyword of appKeywords) {
        hydratedExisting.push(
          await hydrateKeywordRanking(keyword, selectedAppId, selectedRegion, competitors)
        );
      }

      for (const [index, candidate] of candidates.entries()) {
        setExtractMessages((current) => ({
          ...current,
          [competitor.id]: `Scanning ${index + 1} of ${candidates.length}: ${candidate}`,
        }));

        const signals = await fetchRankingSignals(candidate, selectedAppId, selectedRegion, competitors, 100);
        const competitorRank = signals.competitorRanks[competitor.id] ?? null;
        if (competitorRank === null) continue;

        const popularity = calculatePopularity(candidate);
        const difficultyScore = calculateDifficultyScore(popularity, signals.topRatings);
        const score = opportunityScore(popularity, difficultyScore, signals.currentRank, competitorRank);

        opportunities.push({
          keyword: candidate,
          yourRank: signals.currentRank,
          competitorRank,
          popularity,
          difficultyScore,
          opportunityScore: score,
          added: false,
          signals,
        });
      }

      const sortedOpportunities = opportunities.sort((a, b) => b.opportunityScore - a.opportunityScore);
      const selectedOpportunities = sortedOpportunities.slice(0, MAX_EXTRACTED_KEYWORDS);
      const selectedKeywords = new Set(selectedOpportunities.map((opportunity) => opportunity.keyword));

      const extracted: TrackedKeyword[] = selectedOpportunities.map((opportunity) => {
        const keywordSlug = slugifyKeyword(opportunity.keyword);

        return {
          id: `kw-${selectedRegion}-${selectedAppId}-${competitor.id}-${keywordSlug}`,
          keyword: opportunity.keyword,
          appId: selectedAppId,
          region: selectedRegion,
          popularity: opportunity.popularity,
          popularitySource: 'estimated',
          difficulty: calculateDifficulty(opportunity.popularity, opportunity.signals.topRatings),
          difficultyScore: opportunity.difficultyScore,
          difficultySource: 'itunes-search',
          currentRank: opportunity.signals.currentRank,
          previousRank: null,
          rankChange: null,
          rankSource: 'itunes-search',
          competitorRanks: opportunity.signals.competitorRanks,
          rankingApps: opportunity.signals.rankingApps,
          tags: competitorTag ? [competitorTag] : [],
          note: null,
          rankHistory: [
            {
              date: new Date().toISOString(),
              rank: opportunity.signals.currentRank,
            },
          ],
          lastUpdated: new Date().toISOString(),
          addedAt: new Date().toISOString(),
        };
      });

      upsertKeywords(hydratedExisting);
      extracted.forEach(addKeyword);
      setExtractReports((current) => ({
        ...current,
        [competitor.id]: {
          scanned: candidates.length,
          matched: opportunities.length,
          added: extracted.length,
          updated: hydratedExisting.length,
          opportunities: sortedOpportunities.slice(0, 8).map((opportunity) => ({
            keyword: opportunity.keyword,
            yourRank: opportunity.yourRank,
            competitorRank: opportunity.competitorRank,
            popularity: opportunity.popularity,
            difficultyScore: opportunity.difficultyScore,
            opportunityScore: opportunity.opportunityScore,
            added: selectedKeywords.has(opportunity.keyword),
          })),
        },
      }));
      setExtractMessages((current) => ({
        ...current,
        [competitor.id]:
          extracted.length > 0 || hydratedExisting.length > 0
            ? `Scanned ${candidates.length} public candidates, matched ${opportunities.length}, and added ${extracted.length} opportunity keyword${extracted.length === 1 ? '' : 's'}.`
            : 'No new observed ranking keywords found in public search results.',
      }));
    } catch {
      setExtractMessages((current) => ({
        ...current,
        [competitor.id]: 'Extraction failed. Check the network and try again.',
      }));
    } finally {
      setExtractingId(null);
    }
  };

  const observedCompetitorSection = observedCompetitors.length > 0 && (
    <div style={{ marginBottom: 'var(--space-xl)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 'var(--space-md)',
          marginBottom: 'var(--space-md)',
        }}
      >
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Observed in Rankings</h3>
          <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: 4 }}>
            Apps repeatedly appearing above or beside your app in tracked keyword results.
          </p>
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 'var(--space-md)',
        }}
      >
        {observedCompetitors.map(({ snapshot, appearances, bestRank, outranking }) => (
          <div key={snapshot.appId} className="overview-card compact-card">
            <div className="competitor-header" style={{ paddingTop: 0 }}>
              {snapshot.appIcon ? (
                <img src={snapshot.appIcon} alt={snapshot.appName} className="competitor-app-icon" />
              ) : (
                <div className="competitor-app-icon placeholder">{snapshot.appName.charAt(0)}</div>
              )}
              <div className="competitor-app-info">
                <h3>{snapshot.appName}</h3>
                <p>{snapshot.developer}</p>
              </div>
            </div>
            <div className="comparison-metrics">
              <span>Seen {appearances}x</span>
              <span>Best #{bestRank}</span>
              <span>Outranks {outranking}</span>
            </div>
            <button
              className="btn btn-secondary"
              style={{ width: '100%', marginTop: 'var(--space-md)' }}
              onClick={() => void trackObservedCompetitor(snapshot)}
              disabled={extractingId !== null}
            >
              {extractingId === snapshot.appId ? (
                <Loader2 size={14} className="spin" />
              ) : (
                <Plus size={14} />
              )}
              Add as competitor
            </button>
            {extractMessages[snapshot.appId] && (
              <div className="credential-note" style={{ marginTop: 8 }}>
                {extractMessages[snapshot.appId]}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-lg)' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--space-xl)',
        }}
      >
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700 }}>
            Competitor Analysis
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
            Track and compare keyword rankings against competitors
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setAddAppMode('competitor');
            setAddAppModalOpen(true);
          }}
          disabled={!selectedAppId}
          title={selectedAppId ? 'Add competitor' : 'Add your app first'}
        >
          <Plus size={14} />
          Add Competitor
        </button>
      </div>

      {observedCompetitorSection}

      {competitors.length === 0 ? (
        <div className="empty-state" style={{ marginTop: '80px' }}>
          <Users size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
          <div className="empty-state-title">
            {!selectedAppId
              ? 'Add your app first'
              : observedCompetitors.length > 0
                ? 'No tracked competitors yet'
                : 'No competitors added'}
          </div>
          <div className="empty-state-text">
            {!selectedAppId
              ? 'Choose the app you want to benchmark before adding competitors.'
              : observedCompetitors.length > 0
              ? 'Add an observed app above to turn ranking sightings into side-by-side comparison data.'
              : 'Add competitor apps to compare keyword rankings and discover new opportunities.'}
          </div>
          <button
            className="btn btn-primary"
            style={{ marginTop: '16px' }}
            onClick={() => {
              setAddAppMode('competitor');
              setAddAppModalOpen(true);
            }}
            disabled={!selectedAppId}
          >
            <Plus size={14} />
            Add your first competitor
          </button>
        </div>
      ) : (
        <>
          {/* Competitor Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 'var(--space-md)',
              marginBottom: 'var(--space-xl)',
            }}
          >
            {competitors.map((comp) => (
              <div key={comp.id} className="overview-card">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 'var(--space-md)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                    {comp.icon ? (
                      <img
                        src={comp.icon}
                        alt={comp.name}
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: 'var(--border-radius-sm)',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: 'var(--border-radius-sm)',
                          background: 'var(--accent-gradient)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontWeight: 700,
                        }}
                      >
                        {comp.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>
                        {comp.name}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                        {comp.developer}
                      </div>
                    </div>
                  </div>
                  <button
                    className="btn btn-ghost btn-icon"
                    onClick={() => removeApp(comp.id)}
                    title="Remove competitor"
                  >
                    <Trash2 size={14} style={{ color: 'var(--color-danger)' }} />
                  </button>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 'var(--space-sm)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                      Shared Keywords
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 600 }}>
                      {competitorStats.get(comp.id)?.shared ?? 0}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                      Outranks
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 600 }}>
                      {competitorStats.get(comp.id)?.outranking ?? 0}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                      Top 10
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 600 }}>
                      {competitorStats.get(comp.id)?.top10 ?? 0}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                      Best
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 600 }}>
                      {competitorStats.get(comp.id)?.bestRank
                        ? `#${competitorStats.get(comp.id)?.bestRank}`
                        : '—'}
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => void extractCompetitorKeywords(comp)}
                    disabled={extractingId !== null}
                  >
                    {extractingId === comp.id ? (
                      <Loader2 size={14} className="spin" />
                    ) : (
                      <Search size={14} />
                    )}
                    Extract ranking keywords
                  </button>
                  {extractMessages[comp.id] && (
                    <div className="credential-note">
                      {extractMessages[comp.id]}
                    </div>
                  )}
                  {extractReports[comp.id] && (
                    <div className="extract-report">
                      <div className="extract-report-summary">
                        <span>{extractReports[comp.id].scanned} scanned</span>
                        <span>{extractReports[comp.id].matched} matched</span>
                        <span>{extractReports[comp.id].added} added</span>
                        <span>{extractReports[comp.id].updated} refreshed</span>
                      </div>
                      {extractReports[comp.id].opportunities.length > 0 && (
                        <div className="extract-opportunities">
                          {extractReports[comp.id].opportunities.map((opportunity) => (
                            <div key={opportunity.keyword} className="extract-opportunity-row">
                              <div>
                                <div className="keyword-text">{opportunity.keyword}</div>
                                <div className="extract-opportunity-meta">
                                  You {opportunity.yourRank ? `#${opportunity.yourRank}` : '—'} · Competitor #{opportunity.competitorRank}
                                </div>
                              </div>
                              <div className="extract-opportunity-score">
                                {opportunity.added ? 'Added' : opportunity.opportunityScore}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Comparison Table */}
          <div>
            <h3
              style={{
                fontSize: '16px',
                fontWeight: 600,
                marginBottom: 'var(--space-md)',
              }}
            >
              Keyword Comparison
            </h3>
            <div className="table-container" style={{ maxHeight: '500px' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: '180px' }}>Keyword</th>
                    <th>
                      {primaryApp?.name || 'Your App'}
                    </th>
                    {competitors.map((comp) => (
                      <th key={comp.id}>{comp.name}</th>
                    ))}
                    <th>Best Competitor</th>
                    <th>Gap</th>
                    <th>Popularity</th>
                  </tr>
                </thead>
                <tbody>
                  {appKeywords.map((kw) => {
                    const strongest = strongestCompetitorForKeyword(kw);
                    const gap =
                      strongest && kw.currentRank !== null
                        ? kw.currentRank - strongest.rank
                        : null;

                    return (
                      <tr key={kw.id}>
                        <td>
                          <span className="keyword-text">{kw.keyword}</span>
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
                            {kw.rankChange !== null && kw.rankChange !== 0 && (
                              <span
                                className={`rank-change ${kw.rankChange > 0 ? 'up' : 'down'}`}
                              >
                                {kw.rankChange > 0 ? (
                                  <ArrowUp size={10} />
                                ) : (
                                  <ArrowDown size={10} />
                                )}
                                {Math.abs(kw.rankChange)}
                              </span>
                            )}
                          </div>
                        </td>
                        {competitors.map((comp) => {
                          const competitorRank =
                            kw.competitorRanks?.[comp.id] ??
                            kw.rankingApps?.find((app) => app.appId === comp.id)?.rank ??
                            null;
                          return (
                            <td key={comp.id}>
                              {competitorRank ? (
                                <span className={`rank-value ${competitorRank <= 3 ? `rank-${competitorRank}` : ''}`}>
                                  #{competitorRank}
                                </span>
                              ) : (
                                <span className="rank-value unranked">—</span>
                              )}
                            </td>
                          );
                        })}
                        <td>
                          {strongest ? (
                            <div className="competitor-mini">
                              {strongest.competitor.icon ? (
                                <img src={strongest.competitor.icon} alt="" className="ranking-app-icon" />
                              ) : (
                                <span className="ranking-app-icon placeholder">
                                  {strongest.competitor.name.charAt(0)}
                                </span>
                              )}
                              <span>#{strongest.rank}</span>
                            </div>
                          ) : (
                            <span className="rank-value unranked">—</span>
                          )}
                        </td>
                        <td>
                          {gap === null ? (
                            <span className="rank-value unranked">—</span>
                          ) : gap > 0 ? (
                            <span className="rank-change down">
                              <ArrowDown size={12} />
                              {gap} behind
                            </span>
                          ) : gap < 0 ? (
                            <span className="rank-change up">
                              <ArrowUp size={12} />
                              {Math.abs(gap)} ahead
                            </span>
                          ) : (
                            <span className="rank-change neutral">tied</span>
                          )}
                        </td>
                        <td>
                          <div className="popularity-cell">
                            <div className="popularity-bar-container">
                              <div
                                className="popularity-bar"
                                style={{
                                  width: `${kw.popularity}%`,
                                  background:
                                    kw.popularity >= 70
                                      ? 'var(--color-success)'
                                      : kw.popularity >= 40
                                        ? 'var(--accent-primary)'
                                        : 'var(--color-warning)',
                                }}
                              />
                            </div>
                            <span className="popularity-value">
                              {kw.popularity}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {appKeywords.length === 0 && (
                    <tr>
                      <td colSpan={competitors.length + 5}>
                        Add or find keywords for {primaryApp?.name ?? 'your app'} before comparing competitors.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
