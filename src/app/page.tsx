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
import { useAppStore } from '@/store/useAppStore';

export default function Home() {
  const { viewMode } = useAppStore();

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
      <Sidebar />
      <div className="main-content">
        <HeaderBar />
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {renderMainContent()}
        </div>
      </div>

      {/* Modals */}
      <AddKeywordModal />
      <AddAppModal />
    </div>
  );
}
