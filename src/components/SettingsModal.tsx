'use client';

/* eslint-disable react-hooks/set-state-in-effect */

import React, { useState, useEffect } from 'react';
import { X, Key, Shield } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { getCredentialStatuses, CredentialStatus } from '@/lib/credentials';

type ServerCredentialStatus = {
  appStoreConnect: {
    state: CredentialStatus['state'];
    hasIssuerId: boolean;
    hasKeyId: boolean;
    hasPrivateKey: boolean;
  };
  appleSearchAds: {
    state: CredentialStatus['state'];
    hasClientId: boolean;
    hasTeamId: boolean;
    hasKeyId: boolean;
    hasPrivateKey: boolean;
  };
  deepl: {
    state: CredentialStatus['state'];
    hasAuthKey: boolean;
  };
};

function StatusPill({ status }: { status: Pick<CredentialStatus, 'state'> }) {
  const className =
    status.state === 'ready'
      ? 'status-pill ready'
      : status.state === 'incomplete'
        ? 'status-pill incomplete'
        : 'status-pill missing';

  return (
    <span className={className}>
      {status.state === 'ready'
        ? 'Ready'
        : status.state === 'incomplete'
          ? 'Incomplete'
          : 'Not set'}
    </span>
  );
}

export default function SettingsModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { apiKeys, setApiKeys } = useAppStore();
  
  const [localKeys, setLocalKeys] = useState(apiKeys);
  const [activeTab, setActiveTab] = useState<'asc' | 'asa' | 'deepl'>('asc');
  const [serverStatus, setServerStatus] = useState<ServerCredentialStatus | null>(null);
  const statuses = getCredentialStatuses(localKeys);
  const localAscStatus = statuses.find((status) => status.provider === 'appStoreConnect')!;
  const localAsaStatus = statuses.find((status) => status.provider === 'appleSearchAds')!;
  const ascStatus: CredentialStatus =
    serverStatus?.appStoreConnect.state === 'ready'
      ? { ...localAscStatus, state: 'ready', missingFields: [] }
      : localAscStatus;
  const asaStatus: CredentialStatus =
    serverStatus?.appleSearchAds.state === 'ready'
      ? { ...localAsaStatus, state: 'ready', missingFields: [] }
      : localAsaStatus;
  const deeplStatus = {
    state: serverStatus?.deepl.state ?? 'missing',
  } satisfies Pick<CredentialStatus, 'state'>;

  useEffect(() => {
    if (isOpen) {
      setLocalKeys(apiKeys);
      fetch('/api/credentials/status')
        .then((response) => (response.ok ? response.json() : null))
        .then((data: ServerCredentialStatus | null) => setServerStatus(data))
        .catch(() => setServerStatus(null));
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
              display: 'inline-flex',
              alignItems: 'center',
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
            <StatusPill status={ascStatus} />
          </button>
          <button
            style={{
              padding: '12px 16px',
              display: 'inline-flex',
              alignItems: 'center',
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
            <StatusPill status={asaStatus} />
          </button>
          <button
            style={{
              padding: '12px 16px',
              display: 'inline-flex',
              alignItems: 'center',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'deepl' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: activeTab === 'deepl' ? 'var(--text-primary)' : 'var(--text-tertiary)',
              fontWeight: activeTab === 'deepl' ? 600 : 400,
              cursor: 'pointer',
            }}
            onClick={() => setActiveTab('deepl')}
          >
            DeepL
            <StatusPill status={deeplStatus} />
          </button>
        </div>

        <div className="modal-body" style={{ maxHeight: '400px', overflowY: 'auto', paddingTop: 0 }}>
          {activeTab === 'asc' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ padding: '12px', background: 'var(--color-info-bg)', color: 'var(--color-info)', borderRadius: 'var(--border-radius-sm)', fontSize: '13px', display: 'flex', gap: '8px' }}>
                <Shield size={16} style={{ flexShrink: 0 }} />
                <span>Paste keys in <code>.env.local</code> for server-side use, or store them locally here for testing. Create an App Store Connect API key, then keep the Issuer ID, Key ID, and .p8 private key.</span>
              </div>
              {serverStatus?.appStoreConnect.state === 'ready' && (
                <div className="credential-note">
                  Detected complete App Store Connect credentials in <code>.env.local</code>.
                </div>
              )}
              {ascStatus.missingFields.length > 0 && (
                <div className="credential-note">
                  Missing: {ascStatus.missingFields.join(', ')}
                </div>
              )}
              
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
                <span>Paste keys in <code>.env.local</code> for server-side use, or store them locally here for testing. Create Search Ads API credentials, then keep the client ID, team ID, key ID, and private key.</span>
              </div>
              {serverStatus?.appleSearchAds.state === 'ready' && (
                <div className="credential-note">
                  Detected complete Apple Search Ads credentials in <code>.env.local</code>.
                </div>
              )}
              {asaStatus.missingFields.length > 0 && (
                <div className="credential-note">
                  Missing: {asaStatus.missingFields.join(', ')}
                </div>
              )}

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

          {activeTab === 'deepl' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ padding: '12px', background: 'var(--color-info-bg)', color: 'var(--color-info)', borderRadius: 'var(--border-radius-sm)', fontSize: '13px', display: 'flex', gap: '8px' }}>
                <Shield size={16} style={{ flexShrink: 0 }} />
                <span>DeepL powers hover translation for foreign-language keywords. Add <code>DEEPL_AUTH_KEY</code> to <code>.env.local</code>; the key stays server-side.</span>
              </div>
              {serverStatus?.deepl.state === 'ready' ? (
                <div className="credential-note">
                  Detected DeepL credentials in <code>.env.local</code>.
                </div>
              ) : (
                <div className="credential-note">
                  Missing: DEEPL_AUTH_KEY
                </div>
              )}
              <div className="credential-note">
                DeepL API Free includes a limited monthly character allowance. Use an API Free key ending in <code>:fx</code> or a Pro key; the app picks the right endpoint automatically.
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
