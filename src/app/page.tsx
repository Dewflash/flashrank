'use client';

import React from 'react';
import Sidebar from '@/components/Sidebar';
import HeaderBar from '@/components/HeaderBar';
import KeywordTable from '@/components/KeywordTable';
import DetailPanel from '@/components/DetailPanel';
import AddKeywordModal from '@/components/AddKeywordModal';
import AddAppModal from '@/components/AddAppModal';
import OverviewView from '@/components/OverviewView';
import CompetitorsView from '@/components/CompetitorsView';
import StatusBar from '@/components/StatusBar';
import KeyboardShortcuts from '@/components/KeyboardShortcuts';
import { useAppStore } from '@/store/useAppStore';
import { runBackgroundSync } from '@/lib/syncEngine';

export default function Home() {
  const { viewMode } = useAppStore();
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
    // Kick off background sync (will only run if > 24 hours since last sync)
    runBackgroundSync();
  }, []);

  if (!isMounted) return null;


  const renderMainContent = () => {
    switch (viewMode) {
      case 'overview':
        return <OverviewView />;
      case 'competitors':
        return <CompetitorsView />;
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
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {renderMainContent()}
        </div>
        <StatusBar />
      </div>

      {/* Modals */}
      <AddKeywordModal />
      <AddAppModal />
    </div>
  );
}
