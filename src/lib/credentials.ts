import type { AppState } from '@/types';

export type CredentialProvider = 'appStoreConnect' | 'appleSearchAds';
export type CredentialState = 'missing' | 'incomplete' | 'ready';

export interface CredentialStatus {
  provider: CredentialProvider;
  state: CredentialState;
  label: string;
  missingFields: string[];
  storesPrivateKeyLocally: boolean;
}

type ApiKeys = AppState['apiKeys'];

function hasPrivateKey(value: string): boolean {
  return value.trim().includes('BEGIN PRIVATE KEY');
}

function buildStatus(
  provider: CredentialProvider,
  label: string,
  fields: Array<[keyof ApiKeys, string]>,
  keys: ApiKeys
): CredentialStatus {
  const missingFields = fields
    .filter(([key]) => {
      const value = keys[key].trim();
      return key.toLowerCase().includes('privatekey')
        ? !hasPrivateKey(value)
        : value.length === 0;
    })
    .map(([, label]) => label);

  const enteredCount = fields.filter(([key]) => keys[key].trim().length > 0).length;

  return {
    provider,
    label,
    missingFields,
    state:
      missingFields.length === 0
        ? 'ready'
        : enteredCount === 0
          ? 'missing'
          : 'incomplete',
    storesPrivateKeyLocally: fields.some(([key]) => key.toLowerCase().includes('privatekey')),
  };
}

export function getCredentialStatuses(keys: ApiKeys): CredentialStatus[] {
  return [
    buildStatus(
      'appStoreConnect',
      'App Store Connect',
      [
        ['ascIssuerId', 'Issuer ID'],
        ['ascKeyId', 'Key ID'],
        ['ascPrivateKey', 'Private key'],
      ],
      keys
    ),
    buildStatus(
      'appleSearchAds',
      'Apple Search Ads',
      [
        ['asaClientId', 'Client ID'],
        ['asaTeamId', 'Team ID'],
        ['asaKeyId', 'Key ID'],
        ['asaPrivateKey', 'Private key'],
      ],
      keys
    ),
  ];
}

export function isProviderReady(keys: ApiKeys, provider: CredentialProvider): boolean {
  return getCredentialStatuses(keys).some(
    (status) => status.provider === provider && status.state === 'ready'
  );
}
