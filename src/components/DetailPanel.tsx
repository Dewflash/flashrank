'use client';

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

const mockTopApps = [
  {
    rank: 1,
    name: 'Focus Timer - Pomodoro',
    developer: 'AppCo',
    rating: 4.8,
    ratingCount: 52000,
  },
  {
    rank: 2,
    name: 'Forest: Focus for Productivity',
    developer: 'Seekrtech',
    rating: 4.7,
    ratingCount: 89000,
  },
  {
    rank: 3,
    name: 'Be Focused - Focus Timer',
    developer: 'Denys Yevenko',
    rating: 4.6,
    ratingCount: 12000,
  },
  {
    rank: 4,
    name: 'Flow - Focus & Pomodoro Timer',
    developer: 'Yugen Apps',
    rating: 4.5,
    ratingCount: 8000,
  },
  {
    rank: 5,
    name: 'Tide: Focus Timer & Sleep',
    developer: 'Moreless, Inc',
    rating: 4.5,
    ratingCount: 15000,
  },
  {
    rank: 6,
    name: 'Plantie - Focus & Study Timer',
    developer: 'Plantie Inc',
    rating: 4.4,
    ratingCount: 6500,
  },
  {
    rank: 7,
    name: 'Session - Pomodoro Timer',
    developer: 'Session Co',
    rating: 4.3,
    ratingCount: 3200,
  },
  {
    rank: 8,
    name: 'Focus Keeper - Time Management',
    developer: 'Limepresso',
    rating: 4.3,
    ratingCount: 9800,
  },
  {
    rank: 9,
    name: 'Centered - Flow & Focus',
    developer: 'Centered Inc',
    rating: 4.2,
    ratingCount: 2100,
  },
  {
    rank: 10,
    name: 'Focus To-Do: Pomodoro & Tasks',
    developer: 'Shenzhen Tomato',
    rating: 4.1,
    ratingCount: 7400,
  },
];

export default function DetailPanel() {
  const {
    keywords,
    selectedKeywordId,
    isDetailPanelOpen,
    setDetailPanelOpen,
    setSelectedKeyword,
    updateKeywordNote,
  } = useAppStore();

  const keyword = keywords.find((k) => k.id === selectedKeywordId);
  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    if (keyword?.note) {
      setNoteText(keyword.note.text);
    } else {
      setNoteText('');
    }
  }, [keyword]);

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
          </div>
          <div className="stat-card">
            <div className="stat-label">Current Rank</div>
            <div className="stat-value">
              {keyword.currentRank ? `#${keyword.currentRank}` : '—'}
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
          {mockTopApps.map((app) => (
            <div key={app.rank} className="top-app-item">
              <span className="top-app-rank">{app.rank}</span>
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
                {app.name.charAt(0)}
              </div>
              <div className="top-app-info">
                <div className="top-app-name">{app.name}</div>
                <div className="top-app-developer">{app.developer}</div>
              </div>
              <div className="top-app-rating">
                <Star size={10} fill="var(--color-warning)" stroke="none" />
                {app.rating}
              </div>
            </div>
          ))}
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
