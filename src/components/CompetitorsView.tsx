'use client';

import React from 'react';
import { Users, Plus, Trash2, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

export default function CompetitorsView() {
  const {
    apps,
    keywords,
    selectedAppId,
    removeApp,
    setAddAppModalOpen,
  } = useAppStore();

  const competitors = apps.filter((a) => a.isCompetitor);
  const primaryApp = apps.find((a) => a.id === selectedAppId);
  const appKeywords = keywords.filter((k) => k.appId === selectedAppId);

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
                        // Simulated competitor rank
                        const simRank =
                          kw.currentRank
                            ? Math.max(
                                1,
                                kw.currentRank +
                                  Math.floor(Math.random() * 20 - 10)
                              )
                            : null;
                        return (
                          <td key={comp.id}>
                            {simRank ? (
                              <span className={`rank-value ${simRank <= 3 ? `rank-${simRank}` : ''}`}>
                                #{simRank}
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
