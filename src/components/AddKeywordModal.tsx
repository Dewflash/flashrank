'use client';

import React, { useState, useCallback } from 'react';
import { X, Plus, Sparkles } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { TrackedKeyword } from '@/types';
import {
  getKeywordSuggestions,
  calculatePopularity,
  calculateDifficulty,
  calculateDifficultyScore,
} from '@/lib/api';
import { fetchRankingSignals, slugifyKeyword } from '@/lib/keywordHydration';

export default function AddKeywordModal() {
  const {
    isAddKeywordModalOpen,
    setAddKeywordModalOpen,
    addKeyword,
    selectedAppId,
    selectedRegion,
    apps,
    tags,
  } = useAppStore();

  const [keywordInput, setKeywordInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSuggestions = useCallback(
    async (term: string) => {
      if (term.length < 2) {
        setSuggestions([]);
        return;
      }
      setIsLoading(true);
      try {
        const results = await getKeywordSuggestions(term);
        setSuggestions(results.slice(0, 10));
      } catch {
        // Fallback suggestions
        setSuggestions([
          `${term} app`,
          `${term} free`,
          `${term} pro`,
          `best ${term}`,
          `${term} for iphone`,
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  React.useEffect(() => {
    const timer = window.setTimeout(() => fetchSuggestions(keywordInput), 300);
    return () => window.clearTimeout(timer);
  }, [fetchSuggestions, keywordInput]);

  const handleAddKeyword = async (keyword: string) => {
    if (!selectedAppId || !keyword.trim()) return;

    const normalizedKeyword = keyword.trim().toLowerCase();
    setIsLoading(true);
    setError(null);

    try {
      const competitors = apps.filter(
        (app) => app.isCompetitor && app.region === selectedRegion
      );
      const rankingSignals = await fetchRankingSignals(
        normalizedKeyword,
        selectedAppId,
        selectedRegion,
        competitors,
        100
      );

      if (rankingSignals.sourceStatus === 'error') {
        setError('No Internet Connection. Keyword was not added because ranking data could not be checked.');
        return;
      }

      const popularity = calculatePopularity(normalizedKeyword);
      const difficulty = calculateDifficulty(popularity, rankingSignals.topRatings);
      const difficultyScore = calculateDifficultyScore(popularity, rankingSignals.topRatings);

      const newKeyword: TrackedKeyword = {
        id: `kw-${selectedRegion}-${selectedAppId}-${slugifyKeyword(normalizedKeyword)}`,
        keyword: normalizedKeyword,
        appId: selectedAppId,
        region: selectedRegion,
        popularity,
        difficulty,
        difficultyScore,
        currentRank: rankingSignals.currentRank,
        previousRank: null,
        rankChange: null,
        tags: tags.filter((t) => selectedTags.includes(t.id)),
        note: null,
        rankHistory: [
          {
            date: new Date().toISOString(),
            rank: rankingSignals.currentRank,
          },
        ],
        competitorRanks: rankingSignals.competitorRanks,
        rankingApps: rankingSignals.rankingApps,
        popularitySource: 'estimated',
        difficultySource: 'itunes-search',
        rankSource: 'itunes-search',
        lastUpdated: new Date().toISOString(),
        addedAt: new Date().toISOString(),
      };

      addKeyword(newKeyword);
      setKeywordInput('');
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void handleAddKeyword(keywordInput);
  };

  const handleClose = () => {
    setAddKeywordModalOpen(false);
    setKeywordInput('');
    setSuggestions([]);
    setSelectedTags([]);
    setError(null);
  };

  if (!isAddKeywordModalOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Add Keyword</h2>
          <button className="btn btn-ghost btn-icon" onClick={handleClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Keyword</label>
              <input
                type="text"
                className="form-input"
                placeholder="Enter a keyword to track..."
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                autoFocus
              />
            </div>
          </form>

          {error && <div className="credential-note">{error}</div>}

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--text-tertiary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Sparkles size={12} />
                Suggestions
              </div>
              {suggestions.map((suggestion) => (
                <div
                  key={suggestion}
                  className="search-result-item"
                  onClick={() => void handleAddKeyword(suggestion)}
                  style={{ padding: '8px 10px' }}
                >
                  <Plus size={14} style={{ color: 'var(--accent-primary)' }} />
                  <span style={{ fontSize: '13px' }}>{suggestion}</span>
                </div>
              ))}
            </div>
          )}

          {/* Tag Selector */}
          <div className="form-group" style={{ marginTop: '16px' }}>
            <label className="form-label">Tags (optional)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  className="keyword-tag-pill"
                  style={{
                    background: selectedTags.includes(tag.id)
                      ? `${tag.color}30`
                      : 'var(--bg-surface)',
                    color: selectedTags.includes(tag.id) ? tag.color : 'var(--text-tertiary)',
                    cursor: 'pointer',
                    border: `1px solid ${selectedTags.includes(tag.id) ? tag.color : 'var(--border-color)'}`,
                    padding: '4px 10px',
                    fontSize: '11px',
                  }}
                  onClick={() => {
                    if (selectedTags.includes(tag.id)) {
                      setSelectedTags(selectedTags.filter((t) => t !== tag.id));
                    } else {
                      setSelectedTags([...selectedTags, tag.id]);
                    }
                  }}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={handleClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={() => void handleAddKeyword(keywordInput)}
            disabled={!keywordInput.trim() || isLoading}
          >
            <Plus size={14} />
            {isLoading ? 'Checking rankings...' : 'Add Keyword'}
          </button>
        </div>
      </div>
    </div>
  );
}
