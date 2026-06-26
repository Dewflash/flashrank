'use client';

import React, { useState, useEffect } from 'react';
import { X, Key, Shield, HelpCircle } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

export default function SettingsModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { apiKeys, setApiKeys } = useAppStore();
  
  const [localKeys, setLocalKeys] = useState(apiKeys);
  const [activeTab, setActiveTab] = useState<'asc' | 'asa'>('asc');

  useEffect(() => {
    if (isOpen) {
      setLocalKeys(apiKeys);
    }
  }, [isOpen, apiKeys]);

  const handleSave = () => {
    setApiKeys(localKeys);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: '500px' }}>
        <div className="modal-header">
          <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Key size={18} /> Settings & API Keys
          </h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '16px' }}>
          <button
            style={{
              padding: '12px 16px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'asc' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: activeTab === 'asc' ? 'var(--text-primary)' : 'var(--text-tertiary)',
              fontWeight: activeTab === 'asc' ? 600 : 400,
              cursor: 'pointer',
            }}
            onClick={() => setActiveTab('asc')}
          >
            App Store Connect
          </button>
          <button
            style={{
              padding: '12px 16px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'asa' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: activeTab === 'asa' ? 'var(--text-primary)' : 'var(--text-tertiary)',
              fontWeight: activeTab === 'asa' ? 600 : 400,
              cursor: 'pointer',
            }}
            onClick={() => setActiveTab('asa')}
          >
            Apple Search Ads
          </button>
        </div>

        <div className="modal-body" style={{ maxHeight: '400px', overflowY: 'auto', paddingTop: 0 }}>
          {activeTab === 'asc' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ padding: '12px', background: 'var(--color-info-bg)', color: 'var(--color-info)', borderRadius: 'var(--border-radius-sm)', fontSize: '13px', display: 'flex', gap: '8px' }}>
                <Shield size={16} style={{ flexShrink: 0 }} />
                <span>Provides real app analytics (Impressions, Product Page Views, Downloads). Requires a Sales and Reports role key from App Store Connect.</span>
              </div>
              
              <div className="form-group">
                <label className="form-label">Issuer ID</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 57246542-96fe-1a63-e053-0824d011072a"
                  value={localKeys.ascIssuerId}
                  onChange={(e) => setLocalKeys({ ...localKeys, ascIssuerId: e.target.value })}
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Key ID</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 2X9R4HXF34"
                  value={localKeys.ascKeyId}
                  onChange={(e) => setLocalKeys({ ...localKeys, ascKeyId: e.target.value })}
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Private Key (.p8 file contents)</label>
                <textarea
                  className="form-input"
                  placeholder="-----BEGIN PRIVATE KEY-----\n..."
                  rows={4}
                  value={localKeys.ascPrivateKey}
                  onChange={(e) => setLocalKeys({ ...localKeys, ascPrivateKey: e.target.value })}
                  style={{ fontFamily: 'monospace', fontSize: '12px' }}
                />
              </div>
            </div>
          )}

          {activeTab === 'asa' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ padding: '12px', background: 'var(--color-info-bg)', color: 'var(--color-info)', borderRadius: 'var(--border-radius-sm)', fontSize: '13px', display: 'flex', gap: '8px' }}>
                <Shield size={16} style={{ flexShrink: 0 }} />
                <span>Provides exact Apple Search Ads popularity scores (1-100). Requires an Apple Search Ads API Certificate.</span>
              </div>

              <div className="form-group">
                <label className="form-label">Client ID</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. SEARCHADS.xxxx"
                  value={localKeys.asaClientId}
                  onChange={(e) => setLocalKeys({ ...localKeys, asaClientId: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Team ID</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. SEARCHADS.xxxx"
                  value={localKeys.asaTeamId}
                  onChange={(e) => setLocalKeys({ ...localKeys, asaTeamId: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Key ID</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  value={localKeys.asaKeyId}
                  onChange={(e) => setLocalKeys({ ...localKeys, asaKeyId: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Private Key (.pem file contents)</label>
                <textarea
                  className="form-input"
                  placeholder="-----BEGIN PRIVATE KEY-----\n..."
                  rows={4}
                  value={localKeys.asaPrivateKey}
                  onChange={(e) => setLocalKeys({ ...localKeys, asaPrivateKey: e.target.value })}
                  style={{ fontFamily: 'monospace', fontSize: '12px' }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ marginTop: '24px' }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            Save Keys
          </button>
        </div>
      </div>
    </div>
  );
}
