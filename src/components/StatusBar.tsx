'use client';

import React from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Command } from 'lucide-react';

export default function StatusBar() {
  const { keywords, selectedAppId, selectedKeywordId } = useAppStore();
  const appKeywords = keywords.filter((k) => k.appId === selectedAppId);
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
