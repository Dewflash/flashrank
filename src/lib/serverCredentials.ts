interface AppStoreConnectEnv {
  issuerId: string;
  keyId: string;
  privateKey: string;
}

interface AppleSearchAdsEnv {
  clientId: string;
  teamId: string;
  keyId: string;
  privateKey: string;
}

interface DeepLEnv {
  authKey: string;
}

function normalizePrivateKey(value: string | undefined): string {
  return (value ?? '').replace(/\\n/g, '\n').trim();
}

export function getAppStoreConnectEnv(): AppStoreConnectEnv {
  return {
    issuerId: process.env.APP_STORE_CONNECT_ISSUER_ID?.trim() ?? '',
    keyId: process.env.APP_STORE_CONNECT_KEY_ID?.trim() ?? '',
    privateKey: normalizePrivateKey(process.env.APP_STORE_CONNECT_PRIVATE_KEY),
  };
}

export function getAppleSearchAdsEnv(): AppleSearchAdsEnv {
  return {
    clientId: process.env.APPLE_SEARCH_ADS_CLIENT_ID?.trim() ?? '',
    teamId: process.env.APPLE_SEARCH_ADS_TEAM_ID?.trim() ?? '',
    keyId: process.env.APPLE_SEARCH_ADS_KEY_ID?.trim() ?? '',
    privateKey: normalizePrivateKey(process.env.APPLE_SEARCH_ADS_PRIVATE_KEY),
  };
}

export function getDeepLEnv(): DeepLEnv {
  return {
    authKey: process.env.DEEPL_AUTH_KEY?.trim() ?? '',
  };
}

export function hasPrivateKey(value: string): boolean {
  return value.includes('BEGIN PRIVATE KEY');
}
