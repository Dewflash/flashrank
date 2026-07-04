'use client';

import React from 'react';
import Sidebar from '@/components/Sidebar';
import HeaderBar from '@/components/HeaderBar';
import KeywordTable from '@/components/KeywordTable';
import DetailPanel from '@/components/DetailPanel';
import AddKeywordModal from '@/components/AddKeywordModal';
import AddAppModal from '@/components/AddAppModal';
import KeywordResearchModal from '@/components/KeywordResearchModal';
import OverviewView from '@/components/OverviewView';
import CompetitorsView from '@/components/CompetitorsView';
import RatingsReviewsView from '@/components/RatingsReviewsView';
import StatusBar from '@/components/StatusBar';
import KeyboardShortcuts from '@/components/KeyboardShortcuts';
import { useAppStore } from '@/store/useAppStore';
import { runBackgroundSync } from '@/lib/syncEngine';

export default function Home() {
  const { viewMode } = useAppStore();

  React.useEffect(() => {
    // Kick off background sync (will only run if > 24 hours since last sync)
    runBackgroundSync();
  }, []);

  const renderMainContent = () => {
    switch (viewMode) {
      case 'overview':
        return <OverviewView />;
      case 'competitors':
        return <CompetitorsView />;
      case 'ratings':
        return <RatingsReviewsView />;
      case 'keywords':
      default:
        return (
          <>
            <KeywordTable />
            <DetailPanel />
          </>
        );
    }
  };

  return (
    <div className="app-shell">
      <KeyboardShortcuts />
      <Sidebar />
      <div className="main-content">
        <HeaderBar />
        <div className="workspace-area">
          {renderMainContent()}
        </div>
        <StatusBar />
      </div>

      {/* Modals */}
      <AddKeywordModal />
      <KeywordResearchModal />
      <AddAppModal />
    </div>
  );
}
