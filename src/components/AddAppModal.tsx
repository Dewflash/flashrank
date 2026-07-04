'use client';

import React, { useRef, useState } from 'react';
import { X, Search } from 'lucide-react';
import { appScopeKey, useAppStore } from '@/store/useAppStore';
import type { AppMetadata, TrackedApp } from '@/types';
import { searchApps } from '@/lib/api';
import {
  buildStarterKeywordsForApp,
  hydrateKeywordRanking,
} from '@/lib/keywordHydration';

export default function AddAppModal() {
  const {
    isAddAppModalOpen,
    setAddAppModalOpen,
    addAppMode,
    setAddAppMode,
    setAppImportProgress,
    addApp,
    setSelectedApp,
    setViewMode,
    setKeywordResearchModalOpen,
    selectedRegion,
    selectedAppId,
    keywords,
    tags,
    apps,
    addKeyword,
    upsertKeywords,
  } =
    useAppStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [submittedTerm, setSubmittedTerm] = useState('');
  const [results, setResults] = useState<AppMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const latestSearchId = useRef(0);
  const addAsCompetitor = addAppMode === 'competitor';

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    const query = searchTerm.trim();
    const searchId = latestSearchId.current + 1;
    latestSearchId.current = searchId;
    setSubmittedTerm(query);
    setResults([]);
    setIsLoading(true);
    try {
      const appResults = await searchApps(query, selectedRegion);
      if (latestSearchId.current === searchId) {
        setResults(appResults);
      }
    } catch {
      if (latestSearchId.current === searchId) {
        setResults([]);
      }
    } finally {
      if (latestSearchId.current === searchId) {
        setIsLoading(false);
      }
    }
  };

  const handleSelectApp = async (app: AppMetadata) => {
    const trackedApp: TrackedApp = {
      ...app,
      isCompetitor: addAsCompetitor,
      addedAt: new Date().toISOString(),
      region: selectedRegion,
    };

    setIsAdding(true);
    try {
      addApp(trackedApp);
      if (!addAsCompetitor) {
        const importKey = appScopeKey(trackedApp.id, selectedRegion);
        setSelectedApp(trackedApp.id);
        setViewMode('keywords');
        setAppImportProgress(importKey, {
          status: 'loading',
          message: `Preparing ${trackedApp.name} keyword workspace from public App Store data...`,
          keywordCount: 0,
          updatedAt: new Date().toISOString(),
        });

        const competitors = apps.filter(
          (existingApp) => existingApp.isCompetitor && existingApp.region === selectedRegion
        );
        try {
          const starterKeywords = await buildStarterKeywordsForApp({
            app: trackedApp,
            region: selectedRegion,
            existingKeywords: keywords,
            tags,
            competitors,
            limit: 10,
          });
          starterKeywords.forEach(addKeyword);
          setAppImportProgress(importKey, {
            status: 'complete',
            message:
              starterKeywords.length > 0
                ? `Added ${starterKeywords.length} starter keyword${starterKeywords.length === 1 ? '' : 's'} from public Apple results.`
                : 'No starter keywords were found. Use Find Suggestions or add keywords manually.',
            keywordCount: starterKeywords.length,
            updatedAt: new Date().toISOString(),
          });
        } catch {
          setAppImportProgress(importKey, {
            status: 'error',
            message: 'Could not prepare starter keywords. Use Find Suggestions or add keywords manually.',
            keywordCount: 0,
            updatedAt: new Date().toISOString(),
          });
        }
        window.setTimeout(() => setKeywordResearchModalOpen(true), 120);
      } else if (selectedAppId) {
        const nextCompetitors = [
          ...apps.filter(
            (existingApp) =>
              existingApp.isCompetitor &&
              existingApp.region === selectedRegion &&
              existingApp.id !== trackedApp.id
          ),
          trackedApp,
        ];
        const selectedKeywords = keywords.filter(
          (keyword) => keyword.appId === selectedAppId && keyword.region === selectedRegion
        );
        const hydrated = [];
        for (const keyword of selectedKeywords) {
          try {
            hydrated.push(
              await hydrateKeywordRanking(keyword, selectedAppId, selectedRegion, nextCompetitors)
            );
          } catch {
            // Keep the competitor even if one keyword refresh fails.
          }
        }
        upsertKeywords(hydrated);
        setViewMode('competitors');
      }
    } finally {
      setIsAdding(false);
      handleClose();
    }
  };

  const handleClose = () => {
    setAddAppModalOpen(false);
    setSearchTerm('');
    setSubmittedTerm('');
    setResults([]);
    setAddAppMode('mine');
    setIsAdding(false);
  };

  if (!isAddAppModalOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '600px' }}
      >
        <div className="modal-header">
          <h2 className="modal-title">
            {addAsCompetitor ? 'Add Competitor' : 'Add App'}
          </h2>
          <button className="btn btn-ghost btn-icon" onClick={handleClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {/* Toggle */}
          <div
            style={{
              display: 'flex',
              gap: '8px',
              marginBottom: '16px',
            }}
          >
            <button
              className={`btn ${!addAsCompetitor ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setAddAppMode('mine')}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              My App
            </button>
            <button
              className={`btn ${addAsCompetitor ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setAddAppMode('competitor')}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              Competitor
            </button>
          </div>

          <form onSubmit={handleSearch}>
            <div className="form-group">
              <label className="form-label">Search the App Store</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter app name or bundle ID..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setResults([]);
                    setSubmittedTerm('');
                  }}
                  autoFocus
                  style={{ flex: 1 }}
                />
                <button className="btn btn-primary" type="submit" disabled={isLoading || isAdding}>
                  <Search size={14} />
                  {isLoading ? 'Searching...' : 'Search'}
                </button>
              </div>
            </div>
          </form>

          {/* Results */}
          <div className="search-results">
            {isAdding && (
              <div className="credential-note" style={{ marginBottom: 12 }}>
                Adding app and preparing starter keywords...
              </div>
            )}
            {isLoading && results.length === 0 && (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                <div className="empty-state-text">
                  Searching {selectedRegion.toUpperCase()} App Store...
                </div>
              </div>
            )}
            {results.map((app) => (
              <div
                key={app.id}
                className="search-result-item"
                onClick={() => {
                  if (!isAdding) void handleSelectApp(app);
                }}
              >
                {app.icon ? (
                  <img
                    src={app.icon}
                    alt={app.name}
                    className="search-result-icon"
                  />
                ) : (
                  <div
                    className="search-result-icon"
                    style={{
                      background: 'var(--accent-gradient)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '16px',
                      fontWeight: 600,
                    }}
                  >
                    {app.name.charAt(0)}
                  </div>
                )}
                <div className="search-result-info">
                  <div className="search-result-name">
                    {app.name}
                  </div>
                  <div className="search-result-developer">
                    {app.developer}
                  </div>
                </div>
              </div>
            ))}
            {results.length === 0 && submittedTerm && !isLoading && !isAdding && (
              <div
                className="empty-state"
                style={{ padding: '24px 0' }}
              >
                <div className="empty-state-text">
                  No apps found. Try a different search term.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
