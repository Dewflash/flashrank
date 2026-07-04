'use client';

/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, react-hooks/static-components */

import React, { useState, useEffect } from 'react';
import { X, Star, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useAppStore } from '@/store/useAppStore';
import { searchApps } from '@/lib/api';
import {
  buildRankingSignals,
  describeRankStatus,
  PUBLIC_RANKING_RESULT_LIMIT,
} from '@/lib/keywordHydration';
import type { RankingAppSnapshot } from '@/types';

export default function DetailPanel() {
  const {
    keywords,
    selectedKeywordId,
    isDetailPanelOpen,
    apps,
    selectedAppId,
    setDetailPanelOpen,
    setSelectedKeyword,
    updateKeywordNote,
  } = useAppStore();

  const keyword = keywords.find((k) => k.id === selectedKeywordId);
  const keywordAppId = keyword?.appId;
  const keywordId = keyword?.id;
  const keywordRegion = keyword?.region;
  const keywordTerm = keyword?.keyword;
  const keywordRankingApps = keyword?.rankingApps;
  const [noteText, setNoteText] = useState('');
  const [topApps, setTopApps] = useState<RankingAppSnapshot[]>([]);
  const [isLoadingApps, setIsLoadingApps] = useState(false);

  useEffect(() => {
    if (keyword?.note) {
      setNoteText(keyword.note.text);
    } else {
      setNoteText('');
    }
  }, [keyword?.note]);

  useEffect(() => {
    if (keywordId && keywordTerm) {
      setTopApps(keywordRankingApps?.slice(0, 10) ?? []);
      
      const fetchApps = async () => {
        setIsLoadingApps(true);
        try {
          const results = await searchApps(
            keywordTerm,
            keywordRegion || 'us',
            PUBLIC_RANKING_RESULT_LIMIT
          );
          const competitors = apps.filter(
            (app) => app.isCompetitor && app.region === keywordRegion
          );
          const rankingSignals = buildRankingSignals(
            results,
            selectedAppId ?? keywordAppId ?? '',
            competitors
          );
          setTopApps(rankingSignals.rankingApps.slice(0, 10));
        } catch (e) {
          console.error("Failed to fetch top apps", e);
        } finally {
          setIsLoadingApps(false);
        }
      };
      fetchApps();
    }
  }, [
    apps,
    keywordAppId,
    keywordId,
    keywordRankingApps,
    keywordRegion,
    keywordTerm,
    selectedAppId,
  ]);

  const handleNoteBlur = () => {
    if (keyword) {
      updateKeywordNote(keyword.id, noteText);
    }
  };

  if (!keyword) {
    return <div className={`detail-panel ${!isDetailPanelOpen ? 'hidden' : ''}`} />;
  }

  // Format chart data
  const chartData = keyword.rankHistory
    .slice(-30)
    .map((entry) => ({
      date: new Date(entry.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      rank: entry.rank,
    }))
    .filter((d) => d.rank !== null);

  // Invert rank for visual (lower rank number = higher on chart)
  const maxRank = Math.max(...chartData.map((d) => d.rank || 0), 50);
  const rankStatus = keyword.rankStatus
    ? {
        rankStatus: keyword.rankStatus,
        rankStatusMessage:
          keyword.rankStatusMessage ??
          describeRankStatus({
            currentRank: keyword.currentRank,
            rankingResultCount: keyword.rankingResultCount,
          }).rankStatusMessage,
      }
    : describeRankStatus({
        currentRank: keyword.currentRank,
        rankingResultCount: keyword.rankingResultCount,
      });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '8px 12px',
            fontSize: '12px',
          }}
        >
          <div style={{ color: 'var(--text-tertiary)', marginBottom: '4px' }}>
            {label}
          </div>
          <div style={{ color: 'var(--accent-primary-hover)', fontWeight: 600 }}>
            Rank #{payload[0].value}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`detail-panel ${!isDetailPanelOpen ? 'hidden' : ''}`}>
      {/* Header */}
      <div className="detail-panel-header">
        <div className="detail-panel-title">{keyword.keyword}</div>
        <button
          className="btn btn-ghost btn-icon"
          onClick={() => {
            setDetailPanelOpen(false);
            setSelectedKeyword(null);
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Body */}
      <div className="detail-panel-body">
        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Popularity</div>
            <div className="stat-value" style={{ color: 'var(--accent-primary-hover)' }}>
              {keyword.popularity}
            </div>
            <div className="stat-change">
              {keyword.popularitySource === 'apple-search-ads' ? 'Apple Search Ads' : 'Estimated'}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Difficulty</div>
            <div
              className="stat-value"
              style={{
                color:
                  keyword.difficulty === 'low'
                    ? 'var(--difficulty-low)'
                    : keyword.difficulty === 'medium'
                      ? 'var(--difficulty-medium)'
                      : 'var(--difficulty-high)',
              }}
            >
              {keyword.difficultyScore}
            </div>
            <div className="stat-change">
              <span className={`difficulty-badge ${keyword.difficulty}`}>
                {keyword.difficulty}
              </span>
            </div>
            <div className="stat-change">
              Top 10 competition
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Current Rank</div>
            <div className="stat-value" title={rankStatus.rankStatusMessage}>
              {keyword.currentRank
                ? `#${keyword.currentRank}`
                : rankStatus.rankStatus === 'pending'
                  ? 'Pending'
                  : rankStatus.rankStatus === 'error'
                    ? 'Error'
                    : 'Top 200+'}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Change</div>
            <div
              className="stat-value"
              style={{
                color:
                  keyword.rankChange && keyword.rankChange > 0
                    ? 'var(--color-success)'
                    : keyword.rankChange && keyword.rankChange < 0
                      ? 'var(--color-danger)'
                      : 'var(--text-tertiary)',
              }}
            >
              {keyword.rankChange && keyword.rankChange > 0 ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <TrendingUp size={16} /> +{keyword.rankChange}
                </span>
              ) : keyword.rankChange && keyword.rankChange < 0 ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <TrendingDown size={16} /> {keyword.rankChange}
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Minus size={16} /> 0
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Rank Trend Chart */}
        <div className="chart-section">
          <div className="chart-section-title">Rank History (30 Days)</div>
          <div className="chart-container" style={{ height: '200px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.05)"
                />
                <XAxis
                  dataKey="date"
                  tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }}
                  axisLine={{ stroke: 'var(--border-color)' }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  reversed
                  domain={[1, maxRank]}
                  tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }}
                  axisLine={{ stroke: 'var(--border-color)' }}
                  tickLine={false}
                  width={30}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="rank"
                  stroke="var(--accent-primary)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{
                    r: 4,
                    fill: 'var(--accent-primary)',
                    stroke: 'var(--bg-secondary)',
                    strokeWidth: 2,
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top 10 Apps */}
        <div className="top-apps-section">
          <div className="chart-section-title">Top 10 Apps</div>
          {isLoadingApps ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>
              Loading top apps...
            </div>
          ) : (
            topApps.map((app) => (
              <div
                key={`${app.appId}-${app.rank}`}
                className={`top-app-item ${app.isSelectedApp ? 'selected' : ''} ${app.isTrackedCompetitor ? 'competitor' : ''}`}
              >
                <span className="top-app-rank">{app.rank}</span>
                {app.appIcon ? (
                  <img
                    src={app.appIcon}
                    alt={app.appName}
                    className="top-app-icon"
                  />
                ) : (
                  <div
                    className="top-app-icon"
                    style={{
                      background: `hsl(${app.rank * 36}, 60%, 50%)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '11px',
                      fontWeight: 600,
                    }}
                  >
                    {app.appName.charAt(0)}
                  </div>
                )}
                <div className="top-app-info">
                  <div className="top-app-name">
                    {app.appName}
                    {app.isSelectedApp && <span className="source-pill verified">Your app</span>}
                    {app.isTrackedCompetitor && <span className="source-pill">Competitor</span>}
                  </div>
                  <div className="top-app-developer">{app.developer}</div>
                </div>
                <div className="top-app-rating">
                  <Star size={10} fill="var(--color-warning)" stroke="none" />
                  {app.rating ? app.rating.toFixed(1) : 'N/A'}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Notes */}
        <div className="notes-section">
          <div className="chart-section-title">Notes</div>
          <textarea
            className="note-textarea"
            placeholder="Add notes about this keyword..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onBlur={handleNoteBlur}
          />
        </div>
      </div>
    </div>
  );
}
