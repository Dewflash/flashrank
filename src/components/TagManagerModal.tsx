'use client';

import React, { useState } from 'react';
import { X, Plus, Edit2, Trash2 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { KeywordTag } from '@/types';

const PRESET_COLORS = [
  'var(--tag-blue)',
  'var(--tag-purple)',
  'var(--tag-green)',
  'var(--tag-orange)',
  'var(--tag-pink)',
  'var(--tag-red)',
  'var(--tag-yellow)',
  'var(--tag-cyan)',
];

export default function TagManagerModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { tags, addTag, removeTag, updateTag } = useAppStore();
  
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState(PRESET_COLORS[0]);

  const handleCreateNew = () => {
    const newTag: KeywordTag = {
      id: `tag-${Date.now()}`,
      name: 'New Tag',
      color: PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)],
    };
    addTag(newTag);
    startEditing(newTag);
  };

  const startEditing = (tag: KeywordTag) => {
    setEditingTagId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  };

  const saveEdit = () => {
    if (!editingTagId || !editName.trim()) return;
    updateTag(editingTagId, { name: editName.trim(), color: editColor });
    setEditingTagId(null);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: '400px' }}>
        <div className="modal-header">
          <h2 className="modal-title">Manage Tags</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ maxHeight: '400px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {tags.map((tag) => (
              <div
                key={tag.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--border-radius-sm)',
                  border: '1px solid var(--border-color)',
                }}
              >
                {editingTagId === tag.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                    <input
                      autoFocus
                      type="text"
                      className="form-input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit();
                        if (e.key === 'Escape') setEditingTagId(null);
                      }}
                      style={{ padding: '4px 8px', fontSize: '13px' }}
                    />
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => setEditColor(c)}
                          style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            background: c,
                            border: editColor === c ? '2px solid white' : 'none',
                            cursor: 'pointer',
                          }}
                        />
                      ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                      <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={() => setEditingTagId(null)}>Cancel</button>
                      <button className="btn btn-primary" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={saveEdit}>Save</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          background: tag.color,
                        }}
                      />
                      <span style={{ fontSize: '13px', fontWeight: 500 }}>{tag.name}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="btn btn-ghost btn-icon" onClick={() => startEditing(tag)}>
                        <Edit2 size={14} style={{ color: 'var(--text-tertiary)' }} />
                      </button>
                      <button className="btn btn-ghost btn-icon" onClick={() => removeTag(tag.id)}>
                        <Trash2 size={14} style={{ color: 'var(--color-danger)' }} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          <button
            className="btn btn-secondary"
            style={{ width: '100%', marginTop: '16px', justifyContent: 'center' }}
            onClick={handleCreateNew}
          >
            <Plus size={14} />
            Create New Tag
          </button>
        </div>
      </div>
    </div>
  );
}
