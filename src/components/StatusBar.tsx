'use client';

import React from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Command } from 'lucide-react';
import { getKeywordScopeAppId } from '@/lib/keywordScope';

export default function StatusBar() {
  const { keywords, selectedAppId, selectedRegion, selectedKeywordId, isRefreshing, syncProgress } = useAppStore();
  const keywordScopeAppId = getKeywordScopeAppId(selectedAppId);
  const appKeywords = keywords.filter((k) => k.appId === keywordScopeAppId && k.region === selectedRegion);
  const rankedCount = appKeywords.filter((k) => k.currentRank !== null).length;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 16px',
        borderTop: '1px solid var(--border-color)',
        background: 'rgba(15, 15, 30, 0.6)',
        fontSize: '11px',
        color: 'var(--text-tertiary)',
        minHeight: '28px',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div style={{ display: 'flex', gap: '16px' }}>
        <span>{appKeywords.length} keywords tracked</span>
        <span>·</span>
        <span>{rankedCount} ranked</span>
        {(isRefreshing || syncProgress.status === 'error' || syncProgress.status === 'complete') &&
          syncProgress.message && (
            <>
              <span>·</span>
              <span
                style={{
                  color:
                    syncProgress.status === 'error'
                      ? 'var(--color-danger)'
                      : isRefreshing
                        ? 'var(--accent-primary-hover)'
                        : 'var(--text-secondary)',
                }}
              >
                {syncProgress.message}
              </span>
            </>
          )}
        {selectedKeywordId && (
          <>
            <span>·</span>
            <span style={{ color: 'var(--accent-primary-hover)' }}>
              1 selected
            </span>
          </>
        )}
      </div>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          <Command size={10} /> K — Add keyword
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          <Command size={10} /> F — Search
        </span>
        <span>1/2/3 — Switch views</span>
      </div>
    </div>
  );
}
