import { NextResponse } from 'next/server';
import {
  getAppStoreConnectEnv,
  getAppleSearchAdsEnv,
  getDeepLEnv,
  hasPrivateKey,
} from '@/lib/serverCredentials';

type CredentialState = 'missing' | 'incomplete' | 'ready';

function stateFromFields(fields: string[], privateKey: string): CredentialState {
  const allValues = [...fields, privateKey];
  const presentCount = allValues.filter((value) => value.trim().length > 0).length;
  const missingCount =
    fields.filter((value) => value.trim().length === 0).length +
    (hasPrivateKey(privateKey) ? 0 : 1);

  if (missingCount === 0) return 'ready';
  if (presentCount === 0) return 'missing';
  return 'incomplete';
}

export async function GET() {
  const asc = getAppStoreConnectEnv();
  const asa = getAppleSearchAdsEnv();
  const deepl = getDeepLEnv();

  return NextResponse.json({
    appStoreConnect: {
      state: stateFromFields([asc.issuerId, asc.keyId], asc.privateKey),
      hasIssuerId: asc.issuerId.length > 0,
      hasKeyId: asc.keyId.length > 0,
      hasPrivateKey: hasPrivateKey(asc.privateKey),
    },
    appleSearchAds: {
      state: stateFromFields([asa.clientId, asa.teamId, asa.keyId], asa.privateKey),
      hasClientId: asa.clientId.length > 0,
      hasTeamId: asa.teamId.length > 0,
      hasKeyId: asa.keyId.length > 0,
      hasPrivateKey: hasPrivateKey(asa.privateKey),
    },
    deepl: {
      state: deepl.authKey.length > 0 ? 'ready' : 'missing',
      hasAuthKey: deepl.authKey.length > 0,
    },
  });
}
