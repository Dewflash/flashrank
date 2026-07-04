'use client';

import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Search,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  Plus,
  LayoutDashboard,
  Star,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import TagManagerModal from '@/components/TagManagerModal';
import SettingsModal from '@/components/SettingsModal';

export default function Sidebar() {
  const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const {
    apps,
    selectedAppId,
    selectedRegion,
    setSelectedApp,
    viewMode,
    setViewMode,
    keywords,
    tags,
    isSidebarCollapsed,
    toggleSidebar,
    setAddAppModalOpen,
    isRefreshing,
    lastSyncTime,
    filter,
    setTagFilter,
  } = useAppStore();

  const selectedApp = apps.find((a) => a.id === selectedAppId);
  const keywordCount = keywords.filter(
    (k) => k.appId === selectedAppId && k.region === selectedRegion
  ).length;
  const competitorCount = apps.filter(
    (a) => a.isCompetitor && a.region === selectedRegion
  ).length;

  const formatSyncTime = (time: string | null) => {
    if (!time) return 'Never';
    const date = new Date(time);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 720px)').matches &&
      !isSidebarCollapsed
    ) {
      toggleSidebar();
    }
  }, [isSidebarCollapsed, toggleSidebar]);

  return (
    <aside className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-logo">F</div>
        <div>
          <div className="sidebar-title">FlashRank</div>
          <div className="sidebar-subtitle">ASO Studio</div>
        </div>
        <button
          className="btn btn-ghost btn-icon"
          onClick={toggleSidebar}
          style={{ marginLeft: 'auto' }}
        >
          {isSidebarCollapsed ? (
            <ChevronRight size={16} />
          ) : (
            <ChevronLeft size={16} />
          )}
        </button>
      </div>

      {/* App Selector */}
      <div className="app-selector">
        <button
          className="app-selector-btn"
          onClick={() => setAddAppModalOpen(true)}
        >
          {selectedApp ? (
            <>
              {selectedApp.icon ? (
                <img
                  src={selectedApp.icon}
                  alt={selectedApp.name}
                  className="app-selector-icon"
                />
              ) : (
                <div className="app-selector-icon-placeholder">
                  <BarChart3 size={18} color="white" />
                </div>
              )}
              <div className="app-selector-info">
                <div className="app-selector-name">{selectedApp.name}</div>
                <div className="app-selector-developer">
                  {selectedApp.developer}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="app-selector-icon-placeholder">
                <Plus size={18} color="white" />
              </div>
              <div className="app-selector-info">
                <div className="app-selector-name">Add an App</div>
                <div className="app-selector-developer">
                  Search the App Store
                </div>
              </div>
            </>
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <div className="nav-section">
          <div className="nav-section-title">Views</div>
          <button
            className={`nav-item ${viewMode === 'overview' ? 'active' : ''}`}
            onClick={() => setViewMode('overview')}
          >
            <LayoutDashboard size={18} className="nav-item-icon" />
            <span className="nav-label">Overview</span>
          </button>
          <button
            className={`nav-item ${viewMode === 'keywords' ? 'active' : ''}`}
            onClick={() => setViewMode('keywords')}
          >
            <Search size={18} className="nav-item-icon" />
            <span className="nav-label">Keywords</span>
            <span className="nav-badge">{keywordCount}</span>
          </button>
          <button
            className={`nav-item ${viewMode === 'competitors' ? 'active' : ''}`}
            onClick={() => setViewMode('competitors')}
          >
            <Users size={18} className="nav-item-icon" />
            <span className="nav-label">Competitors</span>
            <span className="nav-badge">{competitorCount}</span>
          </button>
          <button
            className={`nav-item ${viewMode === 'ratings' ? 'active' : ''}`}
            onClick={() => setViewMode('ratings')}
          >
            <Star size={18} className="nav-item-icon" />
            <span className="nav-label">Ratings & Reviews</span>
          </button>
        </div>

        <div className="nav-section">
          <div className="nav-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Tags
            <button 
              className="btn-icon" 
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-tertiary)' }}
              onClick={() => setIsTagManagerOpen(true)}
              title="Manage Tags"
            >
              <Settings size={12} />
            </button>
          </div>
          <div className="tag-list">
            {tags.map((tag) => (
              <div
                key={tag.id}
                className="tag-item"
                onClick={() => {
                  const current = filter.tags;
                  if (current.includes(tag.id)) {
                    setTagFilter(current.filter((t) => t !== tag.id));
                  } else {
                    setTagFilter([...current, tag.id]);
                  }
                }}
                style={{
                  background: filter.tags.includes(tag.id)
                    ? 'var(--bg-surface-active)'
                    : undefined,
                }}
              >
                <span className="tag-dot" style={{ background: tag.color }} />
                <span className="nav-label">{tag.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="nav-section">
          <button
            className="nav-item"
            style={{ marginTop: 'auto' }}
            onClick={() => setIsSettingsOpen(true)}
          >
            <Settings size={18} className="nav-item-icon" />
            <span className="nav-label">Settings & APIs</span>
          </button>
        </div>
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="sync-status">
          <span className={`sync-dot ${isRefreshing ? 'refreshing' : ''}`} />
          <span className="sync-text" suppressHydrationWarning>
            {isRefreshing ? 'Syncing...' : `Synced ${formatSyncTime(lastSyncTime)}`}
          </span>
        </div>
      </div>
      <TagManagerModal isOpen={isTagManagerOpen} onClose={() => setIsTagManagerOpen(false)} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </aside>
  );
}
