'use client';

import React, { useState, useCallback } from 'react';
import { X, Plus, Sparkles } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { TrackedKeyword } from '@/types';
import { getKeywordSuggestions, calculatePopularity, calculateDifficulty } from '@/lib/api';

export default function AddKeywordModal() {
  const {
    isAddKeywordModalOpen,
    setAddKeywordModalOpen,
    addKeyword,
    selectedAppId,
    tags,
  } = useAppStore();

  const [keywordInput, setKeywordInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setKeywordInput(value);
    // Debounced fetch
    const timer = setTimeout(() => fetchSuggestions(value), 300);
    return () => clearTimeout(timer);
  };

  const handleAddKeyword = (keyword: string) => {
    if (!selectedAppId || !keyword.trim()) return;

    const popularity = calculatePopularity(keyword);
    const difficulty = calculateDifficulty(popularity, []);

    const newKeyword: TrackedKeyword = {
      id: `kw-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      keyword: keyword.trim().toLowerCase(),
      appId: selectedAppId,
      region: 'us',
      popularity,
      difficulty,
      difficultyScore: difficulty === 'low' ? 25 : difficulty === 'medium' ? 55 : 80,
      currentRank: null,
      previousRank: null,
      rankChange: null,
      tags: tags.filter((t) => selectedTags.includes(t.id)),
      note: null,
      rankHistory: [],
      lastUpdated: new Date().toISOString(),
      addedAt: new Date().toISOString(),
    };

    addKeyword(newKeyword);
    setKeywordInput('');
    setSuggestions([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleAddKeyword(keywordInput);
  };

  const handleClose = () => {
    setAddKeywordModalOpen(false);
    setKeywordInput('');
    setSuggestions([]);
    setSelectedTags([]);
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
                onChange={handleInputChange}
                autoFocus
              />
            </div>
          </form>

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
                  onClick={() => handleAddKeyword(suggestion)}
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
            onClick={() => handleAddKeyword(keywordInput)}
            disabled={!keywordInput.trim()}
          >
            <Plus size={14} />
            Add Keyword
          </button>
        </div>
      </div>
    </div>
  );
}
