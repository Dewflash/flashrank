'use client';

import { useEffect, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { runBackgroundSync } from '@/lib/syncEngine';

/**
 * Global keyboard shortcut handler for FlashRank's macOS-style shortcuts.
 */
export default function KeyboardShortcuts() {
  const {
    setAddKeywordModalOpen,
    setAddAppModalOpen,
    setViewMode,
    isAddKeywordModalOpen,
    isAddAppModalOpen,
    selectedKeywordId,
    setSelectedKeyword,
    setDetailPanelOpen,
    removeKeyword,
    keywords,
    selectedAppId,
    selectedRegion,
  } = useAppStore();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isModal = isAddKeywordModalOpen || isAddAppModalOpen;
      const isMeta = e.metaKey || e.ctrlKey;

      // Close modals on Escape
      if (e.key === 'Escape') {
        if (isAddKeywordModalOpen) {
          setAddKeywordModalOpen(false);
          return;
        }
        if (isAddAppModalOpen) {
          setAddAppModalOpen(false);
          return;
        }
        if (selectedKeywordId) {
          setSelectedKeyword(null);
          setDetailPanelOpen(false);
          return;
        }
      }

      // Don't handle shortcuts when in modals or text inputs
      if (isModal) return;
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // ⌘+K — Add keyword
      if (isMeta && e.key === 'k') {
        e.preventDefault();
        setAddKeywordModalOpen(true);
        return;
      }

      // ⌘+N — Add app
      if (isMeta && e.key === 'n') {
        e.preventDefault();
        setAddAppModalOpen(true);
        return;
      }

      // ⌘+F — Focus search
      if (isMeta && e.key === 'f') {
        e.preventDefault();
        const searchInput = document.querySelector('.search-input') as HTMLInputElement;
        if (searchInput) searchInput.focus();
        return;
      }

      // ⌘+R — Refresh data
      if (isMeta && e.key === 'r') {
        e.preventDefault();
        void runBackgroundSync({
          force: true,
          appId: selectedAppId,
          region: selectedRegion,
        });
        return;
      }

      // 1, 2, 3 — Switch views
      if (e.key === '1') {
        setViewMode('overview');
        return;
      }
      if (e.key === '2') {
        setViewMode('keywords');
        return;
      }
      if (e.key === '3') {
        setViewMode('competitors');
        return;
      }

      // Delete/Backspace — Remove selected keyword
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedKeywordId) {
        e.preventDefault();
        removeKeyword(selectedKeywordId);
        return;
      }

      // Arrow Up/Down — Navigate keywords
      const appKeywords = keywords.filter((k) => k.appId === selectedAppId);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (appKeywords.length === 0) return;

        const currentIndex = appKeywords.findIndex(
          (k) => k.id === selectedKeywordId
        );

        let nextIndex: number;
        if (e.key === 'ArrowDown') {
          nextIndex =
            currentIndex < appKeywords.length - 1 ? currentIndex + 1 : 0;
        } else {
          nextIndex =
            currentIndex > 0 ? currentIndex - 1 : appKeywords.length - 1;
        }

        setSelectedKeyword(appKeywords[nextIndex].id);
        setDetailPanelOpen(true);
        return;
      }
    },
    [
      isAddKeywordModalOpen,
      isAddAppModalOpen,
      selectedKeywordId,
      keywords,
      selectedAppId,
      selectedRegion,
      setAddKeywordModalOpen,
      setAddAppModalOpen,
      setViewMode,
      setSelectedKeyword,
      setDetailPanelOpen,
      removeKeyword,
    ]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return null; // This component renders nothing
}
