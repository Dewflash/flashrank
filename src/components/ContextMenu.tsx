'use client';

import React, { useEffect, useRef } from 'react';
import { Trash2, Copy, ExternalLink, StickyNote, Users } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import type { RankingAppSnapshot, TrackedApp } from '@/types';

interface ContextMenuProps {
  x: number;
  y: number;
  keywordId: string;
  selectedKeywordIds?: string[];
  onClose: () => void;
}

export default function ContextMenu({
  x,
  y,
  keywordId,
  selectedKeywordIds = [],
  onClose,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const {
    apps,
    keywords,
    removeKeyword,
    tags,
    updateKeywordTags,
    setSelectedKeyword,
    setDetailPanelOpen,
    addApp,
    setViewMode,
  } = useAppStore();
  const keyword = keywords.find((k) => k.id === keywordId);

  useEffect(() => {
    const handleClick = () => onClose();
    const handleScroll = () => onClose();
    document.addEventListener('click', handleClick);
    document.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [onClose]);

  if (!keyword) return null;
  const keywordRegion = keyword.region;
  const targetIds =
    selectedKeywordIds.includes(keywordId) && selectedKeywordIds.length > 0
      ? selectedKeywordIds
      : [keywordId];
  const targetKeywords = targetIds
    .map((id) => keywords.find((trackedKeyword) => trackedKeyword.id === id))
    .filter(
      (trackedKeyword): trackedKeyword is NonNullable<typeof trackedKeyword> =>
        Boolean(trackedKeyword)
    );
  const selectedCount = targetKeywords.length;
  const extractableByAppId = new Map<string, RankingAppSnapshot>();
  targetKeywords.forEach((targetKeyword) => {
    (targetKeyword.rankingApps ?? []).forEach((app) => {
      if (app.appId === targetKeyword.appId) return;
      if (
        apps.some(
          (trackedApp) =>
            trackedApp.id === app.appId &&
            trackedApp.region === targetKeyword.region &&
            trackedApp.isCompetitor
        )
      ) {
        return;
      }
      if (!extractableByAppId.has(app.appId)) {
        extractableByAppId.set(app.appId, app);
      }
    });
  });
  const extractableRankingApps = Array.from(extractableByAppId.values());
  const selectedNoun = `selected keyword${selectedCount === 1 ? '' : 's'}`;
  const headerLabel =
    selectedCount > 1 ? `${selectedCount} selected keywords` : keyword.keyword;
  const hasTag = (keywordToCheck: typeof keyword, tagId: string) =>
    keywordToCheck.tags.some((tag) => tag.id === tagId);
  const allTargetsHaveTag = (tagId: string) =>
    targetKeywords.length > 0 &&
    targetKeywords.every((targetKeyword) => hasTag(targetKeyword, tagId));
  const anyTargetHasTag = (tagId: string) =>
    targetKeywords.some((targetKeyword) => hasTag(targetKeyword, tagId));
  const formatKeywordDetails = () =>
    [
      'Keyword,Popularity,Difficulty,Position,Change,Tags',
      ...targetKeywords.map((targetKeyword) =>
        [
          targetKeyword.keyword,
          targetKeyword.popularity,
          targetKeyword.difficultyScore,
          targetKeyword.currentRank ?? '',
          targetKeyword.rankChange ?? '',
          targetKeyword.tags.map((tag) => tag.name).join('|'),
        ]
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(',')
      ),
    ].join('\n');
  const writeClipboard = (value: string) => {
    void navigator.clipboard.writeText(value).catch(() => undefined);
    onClose();
  };
  const extractLimit = Math.min(extractableRankingApps.length, 10);
  const extractLabel =
    extractLimit > 0
      ? `Extract ${extractLimit} Competitor${extractLimit === 1 ? '' : 's'}`
      : 'Extract Competitors';

  // Adjust position to stay within viewport
  const adjustedX = Math.min(x, window.innerWidth - 200);
  const adjustedY = Math.min(y, window.innerHeight - 300);

  const handleCopyKeyword = () => {
    writeClipboard(targetKeywords.map((targetKeyword) => targetKeyword.keyword).join('\n'));
  };

  const handleCopyKeywordDetails = () => {
    writeClipboard(formatKeywordDetails());
  };

  const handleDelete = () => {
    if (
      selectedCount > 1 &&
      !window.confirm(`Delete ${selectedCount} selected keywords?`)
    ) {
      return;
    }
    targetKeywords.forEach((targetKeyword) => removeKeyword(targetKeyword.id));
    onClose();
  };

  const handleViewDetails = () => {
    setSelectedKeyword(keywordId);
    setDetailPanelOpen(true);
    onClose();
  };

  const handleToggleTag = (tagId: string) => {
    const tag = tags.find((t) => t.id === tagId);
    if (!tag) return;

    targetKeywords.forEach((targetKeyword) => {
      const currentTags = targetKeyword.tags;
      if (allTargetsHaveTag(tagId)) {
        updateKeywordTags(
          targetKeyword.id,
          currentTags.filter((t) => t.id !== tagId)
        );
      } else if (!currentTags.some((t) => t.id === tagId)) {
        updateKeywordTags(targetKeyword.id, [...currentTags, tag]);
      }
    });
  };

  const handleSearchAppStore = () => {
    const url = `https://apps.apple.com/${keywordRegion.toLowerCase()}/search?term=${encodeURIComponent(keyword.keyword)}`;
    window.open(url, '_blank');
    onClose();
  };

  const toCompetitorApp = (snapshot: RankingAppSnapshot): TrackedApp => ({
    id: snapshot.appId,
    name: snapshot.appName,
    developer: snapshot.developer,
    icon: snapshot.appIcon,
    price: 'Unknown',
    rating: snapshot.rating,
    ratingCount: snapshot.ratingCount,
    category: 'Observed competitor',
    platform: 'ios',
    bundleId: snapshot.bundleId,
    url: snapshot.url,
    isCompetitor: true,
    addedAt: new Date().toISOString(),
    region: keywordRegion,
  });

  const handleExtractCompetitors = () => {
    extractableRankingApps.slice(0, 10).forEach((app) => addApp(toCompetitorApp(app)));
    setViewMode('competitors');
    onClose();
  };

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: adjustedY,
        left: adjustedX,
        zIndex: 200,
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color-hover)',
        borderRadius: 'var(--border-radius-md)',
        boxShadow: 'var(--shadow-lg)',
        padding: '4px',
        minWidth: '200px',
        animation: 'fadeIn 100ms ease-out',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Keyword name header */}
      <div
        style={{
          padding: '6px 10px',
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--text-tertiary)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          borderBottom: '1px solid var(--border-color)',
          marginBottom: '4px',
        }}
      >
        {headerLabel}
      </div>

      <MenuItem
        icon={<StickyNote size={14} />}
        label="View Details"
        onClick={handleViewDetails}
        disabled={selectedCount !== 1}
      />
      <MenuItem
        icon={<Users size={14} />}
        label={extractLabel}
        onClick={handleExtractCompetitors}
        disabled={extractableRankingApps.length === 0}
      />
      <MenuItem
        icon={<Copy size={14} />}
        label={`Copy ${selectedNoun}`}
        onClick={handleCopyKeyword}
      />
      <MenuItem
        icon={<Copy size={14} />}
        label={`Copy ${selectedNoun} with details`}
        onClick={handleCopyKeywordDetails}
      />
      <MenuItem icon={<ExternalLink size={14} />} label="Search App Store" onClick={handleSearchAppStore} />

      {/* Tags submenu */}
      <div
        style={{
          borderTop: '1px solid var(--border-color)',
          margin: '4px 0',
        }}
      />
      <div
        style={{
          padding: '4px 10px',
          fontSize: '10px',
          fontWeight: 600,
          color: 'var(--text-tertiary)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        Tags
      </div>
      {tags.map((tag) => {
        const isActive = allTargetsHaveTag(tag.id);
        const isMixed = !isActive && anyTargetHasTag(tag.id);
        return (
          <div
            key={tag.id}
            onClick={(e) => {
              e.stopPropagation();
              handleToggleTag(tag.id);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 10px',
              fontSize: '13px',
              color: isActive || isMixed ? tag.color : 'var(--text-secondary)',
              cursor: 'pointer',
              borderRadius: '4px',
              transition: 'background 100ms',
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLElement).style.background = 'var(--bg-surface-hover)')
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.background = 'transparent')
            }
          >
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '3px',
                background: isActive
                  ? tag.color
                  : isMixed
                    ? `${tag.color}66`
                    : 'transparent',
                border: `2px solid ${tag.color}`,
              }}
            />
            {tag.name}
          </div>
        );
      })}

      <div
        style={{
          borderTop: '1px solid var(--border-color)',
          margin: '4px 0',
        }}
      />
      <MenuItem
        icon={<Trash2 size={14} />}
        label={`Delete ${selectedNoun}`}
        onClick={handleDelete}
        danger
      />
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger = false,
  disabled = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <div
      onClick={() => {
        if (!disabled) onClick();
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 10px',
        fontSize: '13px',
        color: disabled
          ? 'var(--text-tertiary)'
          : danger
            ? 'var(--color-danger)'
            : 'var(--text-secondary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        borderRadius: '4px',
        transition: 'background 100ms',
      }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLElement).style.background = disabled
          ? 'transparent'
          : danger
            ? 'var(--color-danger-bg)'
            : 'var(--bg-surface-hover)')
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLElement).style.background = 'transparent')
      }
    >
      {icon}
      {label}
    </div>
  );
}
