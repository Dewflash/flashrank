'use client';

import React, { useState } from 'react';
import { X, Search } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { TrackedApp } from '@/types';
import { searchApps } from '@/lib/api';

export default function AddAppModal() {
  const { isAddAppModalOpen, setAddAppModalOpen, addApp, setSelectedApp } =
    useAppStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [addAsCompetitor, setAddAsCompetitor] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setIsLoading(true);
    try {
      const apps = await searchApps(searchTerm);
      setResults(apps);
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectApp = (app: any) => {
    const trackedApp: TrackedApp = {
      id: String(app.id || app.trackId || Date.now()),
      name: app.name || app.trackName || 'Unknown App',
      developer: app.developer || app.artistName || 'Unknown Developer',
      icon:
        app.icon ||
        app.artworkUrl100 ||
        app.artworkUrl60 ||
        '',
      price: app.price || app.formattedPrice || 'Free',
      rating: app.rating || app.averageUserRating || 0,
      ratingCount: app.ratingCount || app.userRatingCount || 0,
      category: app.category || app.primaryGenreName || 'Utilities',
      platform: 'ios',
      bundleId: app.bundleId || '',
      url: app.url || app.trackViewUrl || '',
      isCompetitor: addAsCompetitor,
      addedAt: new Date().toISOString(),
      region: 'us',
    };

    addApp(trackedApp);
    if (!addAsCompetitor) {
      setSelectedApp(trackedApp.id);
    }
    handleClose();
  };

  const handleClose = () => {
    setAddAppModalOpen(false);
    setSearchTerm('');
    setResults([]);
    setAddAsCompetitor(false);
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
              onClick={() => setAddAsCompetitor(false)}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              My App
            </button>
            <button
              className={`btn ${addAsCompetitor ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setAddAsCompetitor(true)}
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
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoFocus
                  style={{ flex: 1 }}
                />
                <button className="btn btn-primary" type="submit" disabled={isLoading}>
                  <Search size={14} />
                  {isLoading ? 'Searching...' : 'Search'}
                </button>
              </div>
            </div>
          </form>

          {/* Results */}
          <div className="search-results">
            {results.map((app: any) => (
              <div
                key={app.id || app.trackId}
                className="search-result-item"
                onClick={() => handleSelectApp(app)}
              >
                {(app.icon || app.artworkUrl100) ? (
                  <img
                    src={app.icon || app.artworkUrl100}
                    alt={app.name || app.trackName}
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
                    {(app.name || app.trackName || 'A').charAt(0)}
                  </div>
                )}
                <div className="search-result-info">
                  <div className="search-result-name">
                    {app.name || app.trackName}
                  </div>
                  <div className="search-result-developer">
                    {app.developer || app.artistName}
                  </div>
                </div>
              </div>
            ))}
            {results.length === 0 && searchTerm && !isLoading && (
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
