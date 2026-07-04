'use client';

import React from 'react';
import { Users, Plus, Trash2, ArrowUp, ArrowDown, Search, Loader2 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import type { AppMetadata, TrackedApp, TrackedKeyword } from '@/types';
import {
  calculateDifficulty,
  calculateDifficultyScore,
  calculatePopularity,
  getKeywordSuggestions,
  searchApps,
} from '@/lib/api';

const MAX_EXTRACTED_KEYWORDS = 18;

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

export default function CompetitorsView() {
  const {
    apps,
    keywords,
    selectedAppId,
    selectedRegion,
    removeApp,
    setAddAppModalOpen,
    addKeyword,
    tags,
  } = useAppStore();
  const [extractingId, setExtractingId] = React.useState<string | null>(null);
  const [extractMessages, setExtractMessages] = React.useState<Record<string, string>>({});

  const competitors = apps.filter((a) => a.isCompetitor && a.region === selectedRegion);
  const primaryApp = apps.find((a) => a.id === selectedAppId);
  const appKeywords = keywords.filter(
    (k) => k.appId === selectedAppId && k.region === selectedRegion
  );
  const competitorTag = tags.find((tag) => tag.name.toLowerCase() === 'competitor');

  const extractCompetitorKeywords = async (competitor: TrackedApp) => {
    if (!selectedAppId || !primaryApp || extractingId) return;

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
        ...appKeywords.map((keyword) => keyword.keyword),
      ])
        .filter((keyword) => !existing.has(keyword))
        .slice(0, 40);

      const extracted: TrackedKeyword[] = [];
      for (const candidate of candidates) {
        if (extracted.length >= MAX_EXTRACTED_KEYWORDS) break;

        let results: AppMetadata[] = [];
        try {
          results = await searchApps(candidate, selectedRegion, 30);
        } catch {
          results = [];
        }

        const competitorIndex = results.findIndex((app) => app.id === competitor.id);
        if (competitorIndex === -1) continue;

        const ownIndex = results.findIndex((app) => app.id === selectedAppId);
        const topRatings = results.slice(0, 10).map((app) => app.ratingCount);
        const popularity = calculatePopularity(candidate);
        const difficultyScore = calculateDifficultyScore(popularity, topRatings);

        const keywordSlug = candidate.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

        extracted.push({
          id: `kw-${selectedRegion}-${selectedAppId}-${competitor.id}-${keywordSlug}`,
          keyword: candidate,
          appId: selectedAppId,
          region: selectedRegion,
          popularity,
          popularitySource: 'estimated',
          difficulty: calculateDifficulty(popularity, topRatings),
          difficultyScore,
          difficultySource: 'itunes-search',
          currentRank: ownIndex === -1 ? null : ownIndex + 1,
          previousRank: null,
          rankChange: null,
          rankSource: 'itunes-search',
          competitorRanks: {
            [competitor.id]: competitorIndex + 1,
          },
          tags: competitorTag ? [competitorTag] : [],
          note: null,
          rankHistory: [
            {
              date: new Date().toISOString(),
              rank: ownIndex === -1 ? null : ownIndex + 1,
            },
          ],
          lastUpdated: new Date().toISOString(),
          addedAt: new Date().toISOString(),
        });
      }

      extracted.forEach(addKeyword);
      setExtractMessages((current) => ({
        ...current,
        [competitor.id]:
          extracted.length > 0
            ? `Added ${extracted.length} observed ranking keyword${extracted.length === 1 ? '' : 's'}.`
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
          onClick={() => setAddAppModalOpen(true)}
        >
          <Plus size={14} />
          Add Competitor
        </button>
      </div>

      {competitors.length === 0 ? (
        <div className="empty-state" style={{ marginTop: '80px' }}>
          <Users size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
          <div className="empty-state-title">No competitors added</div>
          <div className="empty-state-text">
            Add competitor apps to compare keyword rankings and discover new opportunities.
          </div>
          <button
            className="btn btn-primary"
            style={{ marginTop: '16px' }}
            onClick={() => setAddAppModalOpen(true)}
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
                      Rating
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 600 }}>
                      ⭐ {comp.rating.toFixed(1)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                      Reviews
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 600 }}>
                      {comp.ratingCount.toLocaleString()}
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
                    <th>Popularity</th>
                  </tr>
                </thead>
                <tbody>
                  {appKeywords.map((kw) => (
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
                        const competitorRank = kw.competitorRanks?.[comp.id] ?? null;
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
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
