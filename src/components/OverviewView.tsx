'use client';

/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, react-hooks/static-components */

import React from 'react';
import {
  TrendingUp,
  Target,
  Zap,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useAppStore } from '@/store/useAppStore';
import { isProviderReady } from '@/lib/credentials';

export default function OverviewView() {
  const { keywords, selectedAppId, selectedRegion, apps, apiKeys } = useAppStore();
  const appKeywords = keywords.filter(
    (k) => k.appId === selectedAppId && k.region === selectedRegion
  );

  const [metrics, setMetrics] = React.useState({ impressions: 0, productPageViews: 0, downloads: 0 });
  const [metricsSource, setMetricsSource] = React.useState<'missing' | 'app-store-connect' | 'connector-unavailable'>('missing');
  const [metricsMessage, setMetricsMessage] = React.useState<string | null>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = React.useState(false);

  React.useEffect(() => {
    if (selectedAppId && isProviderReady(apiKeys, 'appStoreConnect')) {
      setIsLoadingMetrics(true);
      fetch('/api/appStoreConnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issuerId: apiKeys.ascIssuerId,
          keyId: apiKeys.ascKeyId,
          privateKey: apiKeys.ascPrivateKey,
          appId: selectedAppId
        })
      })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error ?? `App Store Connect request failed with ${res.status}`);
        }
        return data;
      })
      .then(data => {
        if (data.data?.metrics) {
          setMetrics(data.data.metrics);
          setMetricsSource('app-store-connect');
          setMetricsMessage(null);
        }
      })
      .catch((err) => {
        console.error("Failed to load ASC metrics", err);
        setMetrics({ impressions: 0, productPageViews: 0, downloads: 0 });
        setMetricsSource('connector-unavailable');
        setMetricsMessage(err instanceof Error ? err.message : 'App Store Connect metrics unavailable.');
      })
      .finally(() => setIsLoadingMetrics(false));
    } else {
      setMetrics({ impressions: 0, productPageViews: 0, downloads: 0 });
      setMetricsSource('missing');
      setMetricsMessage(null);
    }
  }, [selectedAppId, apiKeys]);

  const improvingKeywords = appKeywords.filter(
    (k) => k.rankChange !== null && k.rankChange > 0
  ).length;
  const decliningKeywords = appKeywords.filter(
    (k) => k.rankChange !== null && k.rankChange < 0
  ).length;
  const top10Keywords = appKeywords.filter(
    (k) => k.currentRank !== null && k.currentRank <= 10
  ).length;

  // Difficulty distribution
  const difficultyData = [
    { name: 'Low', value: appKeywords.filter((k) => k.difficulty === 'low').length, color: 'var(--difficulty-low)' },
    { name: 'Medium', value: appKeywords.filter((k) => k.difficulty === 'medium').length, color: 'var(--difficulty-medium)' },
    { name: 'High', value: appKeywords.filter((k) => k.difficulty === 'high').length, color: 'var(--difficulty-high)' },
  ];
  const DIFFICULTY_COLORS = ['#34d399', '#fbbf24', '#f87171'];

  // Popularity distribution
  const popularityBuckets = [
    { range: '0-20', count: appKeywords.filter((k) => k.popularity <= 20).length },
    { range: '21-40', count: appKeywords.filter((k) => k.popularity > 20 && k.popularity <= 40).length },
    { range: '41-60', count: appKeywords.filter((k) => k.popularity > 40 && k.popularity <= 60).length },
    { range: '61-80', count: appKeywords.filter((k) => k.popularity > 60 && k.popularity <= 80).length },
    { range: '81-100', count: appKeywords.filter((k) => k.popularity > 80).length },
  ];

  const selectedApp = apps.find((a) => a.id === selectedAppId);
  const privateMetricLabel =
    metricsSource === 'missing'
      ? 'Owner-only: App Store Connect required'
      : metricsSource === 'connector-unavailable'
        ? 'Connector not wired yet'
        : 'App Store Connect';

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
            {label || payload[0].name}
          </div>
          <div style={{ color: 'var(--accent-primary-hover)', fontWeight: 600 }}>
            {payload[0].value} keywords
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-lg)' }}>
      {/* App Header */}
      {selectedApp && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-md)',
            marginBottom: 'var(--space-xl)',
          }}
        >
          {selectedApp.icon ? (
            <img
              src={selectedApp.icon}
              alt={selectedApp.name}
              style={{
                width: '56px',
                height: '56px',
                borderRadius: 'var(--border-radius-md)',
              }}
            />
          ) : (
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: 'var(--border-radius-md)',
                background: 'var(--accent-gradient)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                fontWeight: 700,
                color: 'white',
              }}
            >
              {selectedApp.name.charAt(0)}
            </div>
          )}
          <div>
            <h2
              style={{
                fontSize: '24px',
                fontWeight: 700,
                letterSpacing: '-0.02em',
              }}
            >
              {selectedApp.name}
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
              {selectedApp.developer} · {selectedApp.category}
            </p>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="overview-grid">
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Impressions (30d)</span>
            <Zap size={16} className="stat-card-icon" style={{ color: 'var(--tag-purple)' }} />
          </div>
          <div className="stat-card-value">
            {isLoadingMetrics ? '...' : (metrics.impressions > 0 ? metrics.impressions.toLocaleString() : 'N/A')}
          </div>
          <div className="stat-card-trend neutral">
            {privateMetricLabel}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Downloads (30d)</span>
            <Target size={16} className="stat-card-icon" style={{ color: 'var(--color-success)' }} />
          </div>
          <div className="stat-card-value">
            {isLoadingMetrics ? '...' : (metrics.downloads > 0 ? metrics.downloads.toLocaleString() : 'N/A')}
          </div>
          <div className="stat-card-trend neutral">
            {privateMetricLabel}
          </div>
        </div>

        <div className="overview-card">
          <div className="overview-card-title">
            <Target size={14} style={{ marginRight: '6px', opacity: 0.5 }} />
            Top 10 Rankings
          </div>
          <div className="overview-card-value">{top10Keywords}</div>
          <div className="overview-card-subtitle">
            Keywords in top 10 results
          </div>
        </div>

        <div className="overview-card">
          <div className="overview-card-title">
            <Zap size={14} style={{ marginRight: '6px', opacity: 0.5 }} />
            Movement
          </div>
          <div
            className="overview-card-value"
            style={{
              background: 'none',
              WebkitTextFillColor: 'unset',
            }}
          >
            <span style={{ color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <TrendingUp size={20} /> {improvingKeywords}
            </span>
          </div>
          <div className="overview-card-subtitle">
            <span style={{ color: 'var(--color-danger)' }}>
              {decliningKeywords} declining
            </span>
          </div>
        </div>
      </div>

      {metricsMessage && (
        <div className="credential-note" style={{ margin: '0 var(--space-lg) var(--space-md)' }}>
          {metricsMessage}
        </div>
      )}

      {/* Charts */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 'var(--space-md)',
          marginTop: 'var(--space-lg)',
        }}
      >
        {/* Popularity Distribution */}
        <div className="overview-card" style={{ padding: 'var(--space-lg)' }}>
          <div className="chart-section-title" style={{ marginBottom: 'var(--space-md)' }}>
            Popularity Distribution
          </div>
          <div style={{ height: '220px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={popularityBuckets}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.05)"
                />
                <XAxis
                  dataKey="range"
                  tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
                  axisLine={{ stroke: 'var(--border-color)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
                  axisLine={{ stroke: 'var(--border-color)' }}
                  tickLine={false}
                  width={25}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="count"
                  fill="var(--accent-primary)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Difficulty Distribution */}
        <div className="overview-card" style={{ padding: 'var(--space-lg)' }}>
          <div className="chart-section-title" style={{ marginBottom: 'var(--space-md)' }}>
            Difficulty Distribution
          </div>
          <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={difficultyData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {difficultyData.map((entry, index) => (
                    <Cell key={entry.name} fill={DIFFICULTY_COLORS[index]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {difficultyData.map((d) => (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: d.color,
                    }}
                  />
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {d.name}: {d.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
