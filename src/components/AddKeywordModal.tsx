'use client';

import React, { useState, useCallback, useRef } from 'react';
import { X, Plus, Sparkles, Upload } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { TrackedKeyword } from '@/types';
import {
  getKeywordSuggestions,
  calculatePopularity,
  calculateDifficulty,
  calculateDifficultyScore,
} from '@/lib/api';
import { ALL_TIME_POPULAR_KEYWORDS } from '@/lib/keywordSeeds';
import {
  describeRankStatus,
  fetchRankingSignals,
  PUBLIC_RANKING_RESULT_LIMIT,
  slugifyKeyword,
} from '@/lib/keywordHydration';

function cleanKeywordValue(value: string): string {
  return value
    .replace(/^\s*[-*•\d.)]+\s*/, '')
    .trim()
    .toLowerCase();
}

function collectJsonKeywords(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(collectJsonKeywords);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const directValue =
      record.keyword ?? record.term ?? record.name ?? record.text ?? record.value;
    if (typeof directValue === 'string') return [directValue];
    return Object.values(record).flatMap(collectJsonKeywords);
  }
  return [];
}

function parseKeywordInput(value: string): string[] {
  const trimmed = value.trim();
  const rawValues = (() => {
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        return collectJsonKeywords(JSON.parse(trimmed));
      } catch {
        return [];
      }
    }

    return value.split(/[,\n;]/g);
  })();

  return rawValues
    .map(cleanKeywordValue)
    .filter((keyword, index, arr) => keyword.length > 0 && arr.indexOf(keyword) === index);
}

export default function AddKeywordModal() {
  const {
    isAddKeywordModalOpen,
    setAddKeywordModalOpen,
    addKeyword,
    selectedAppId,
    selectedRegion,
    apps,
    keywords,
    tags,
  } = useAppStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [keywordInput, setKeywordInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progressText, setProgressText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const popularSuggestions = React.useMemo(
    () =>
      ALL_TIME_POPULAR_KEYWORDS
        .filter((keyword) =>
          keywordInput.trim()
            ? keyword.includes(keywordInput.trim().toLowerCase())
            : true
        )
        .slice(0, 12)
        .map((keyword) => ({
          keyword,
          popularity: calculatePopularity(keyword),
        })),
    [keywordInput]
  );

  const keywordTerms = React.useMemo(
    () => parseKeywordInput(keywordInput),
    [keywordInput]
  );

  const fetchSuggestions = useCallback(
    async (term: string) => {
      if (term.length < 2 || /[,\n;{}\[\]"]/.test(term)) {
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

  const handleAddKeyword = async (keyword: string): Promise<boolean> => {
    if (!selectedAppId || !keyword.trim()) return false;

    const normalizedKeyword = keyword.trim().toLowerCase();
    const alreadyTracked = keywords.some(
      (trackedKeyword) =>
        trackedKeyword.appId === selectedAppId &&
        trackedKeyword.region === selectedRegion &&
        trackedKeyword.keyword.toLowerCase() === normalizedKeyword
    );

    if (alreadyTracked) {
      setError(`"${normalizedKeyword}" is already tracked for this app and region.`);
      return false;
    }

    try {
      const competitors = apps.filter(
        (app) => app.isCompetitor && app.region === selectedRegion
      );
      const rankingSignals = await fetchRankingSignals(
        normalizedKeyword,
        selectedAppId,
        selectedRegion,
        competitors,
        PUBLIC_RANKING_RESULT_LIMIT
      );

      if (rankingSignals.sourceStatus === 'error') {
        setError('No Internet Connection. Keyword was not added because ranking data could not be checked.');
        return false;
      }

      const popularity = calculatePopularity(normalizedKeyword);
      const difficulty = calculateDifficulty(popularity, rankingSignals.topRatings);
      const difficultyScore = calculateDifficultyScore(popularity, rankingSignals.topRatings);
      const rankStatus = describeRankStatus({
        currentRank: rankingSignals.currentRank,
        rankingResultCount: rankingSignals.rankingResultCount,
        sourceStatus: rankingSignals.sourceStatus,
      });

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
        rankingResultCount: rankingSignals.rankingResultCount,
        ...rankStatus,
        popularitySource: 'estimated',
        difficultySource: 'itunes-search',
        rankSource: 'itunes-search',
        lastUpdated: new Date().toISOString(),
        addedAt: new Date().toISOString(),
      };

      addKeyword(newKeyword);
      return true;
    } catch {
      setError(`Could not check rankings for "${normalizedKeyword}".`);
      return false;
    }
  };

  const handleAddKeywords = async (terms: string[]) => {
    if (!selectedAppId || terms.length === 0 || isLoading) return;

    setIsLoading(true);
    setError(null);
    setProgressText(null);

    try {
      let addedCount = 0;
      for (const [index, term] of terms.entries()) {
        setProgressText(`Checking ${index + 1} of ${terms.length}: ${term}`);
        const added = await handleAddKeyword(term);
        if (added) addedCount += 1;
      }

      if (addedCount > 0) {
        setKeywordInput('');
        setSuggestions([]);
        setProgressText(`Added ${addedCount} keyword${addedCount === 1 ? '' : 's'}.`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void handleAddKeywords(keywordTerms);
  };

  const handleImportFile = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      setKeywordInput(text);
      setSuggestions([]);
      setError(null);
      setProgressText(`Imported ${parseKeywordInput(text).length} keyword${parseKeywordInput(text).length === 1 ? '' : 's'} from ${file.name}.`);
    } catch {
      setError(`Could not import ${file.name}.`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    setAddKeywordModalOpen(false);
    setKeywordInput('');
    setSuggestions([]);
    setSelectedTags([]);
    setProgressText(null);
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
              <div className="form-label-row">
                <label className="form-label">Keywords</label>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                >
                  <Upload size={13} />
                  Import JSON/Text
                </button>
              </div>
              <textarea
                className="form-input"
                rows={5}
                placeholder={'Paste keywords, one per line, comma-separated, or JSON like ["daily prayer", {"keyword":"bible study"}]'}
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                autoFocus
              />
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.txt,text/plain,application/json"
                hidden
                onChange={(event) => void handleImportFile(event.target.files?.[0] ?? null)}
              />
              <div className="keyword-import-summary">
                {keywordTerms.length > 0
                  ? `${keywordTerms.length} keyword${keywordTerms.length === 1 ? '' : 's'} ready to check`
                  : 'No keywords parsed yet'}
              </div>
            </div>
          </form>

          {error && <div className="credential-note">{error}</div>}
          {progressText && <div className="credential-note">{progressText}</div>}

          {keywordTerms.length <= 1 && (
            <div className="add-keyword-suggestions">
              <div className="suggestion-section-head">
                <span>
                  <Sparkles size={12} />
                  {suggestions.length > 0 ? 'Search Suggestions' : 'Most Searched Overall'}
                </span>
                {suggestions.length === 0 && <span>Public starter terms</span>}
              </div>
              <div className="add-keyword-suggestion-list">
                {(suggestions.length > 0
                  ? suggestions.map((suggestion) => ({
                      keyword: suggestion,
                      popularity: calculatePopularity(suggestion),
                    }))
                  : popularSuggestions
                ).map((suggestion) => (
                  <button
                    key={suggestion.keyword}
                    type="button"
                    className="add-keyword-suggestion-row"
                    onClick={() => void handleAddKeywords([suggestion.keyword])}
                    disabled={isLoading}
                  >
                    <span className="suggestion-popularity">{suggestion.popularity}</span>
                    <span className="suggestion-keyword">{suggestion.keyword}</span>
                    <span className="suggestion-bar">
                      <span style={{ width: `${suggestion.popularity}%` }} />
                    </span>
                    <Plus size={14} />
                  </button>
                ))}
              </div>
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
            onClick={() => void handleAddKeywords(keywordTerms)}
            disabled={keywordTerms.length === 0 || isLoading}
          >
            <Plus size={14} />
            {isLoading
              ? 'Checking rankings...'
              : `Add ${keywordTerms.length || ''} Keyword${keywordTerms.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
