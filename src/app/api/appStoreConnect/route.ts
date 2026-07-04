import { NextResponse } from 'next/server';
import { getAppStoreConnectEnv, hasPrivateKey } from '@/lib/serverCredentials';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const envKeys = getAppStoreConnectEnv();
    const {
      appId,
    } = body;
    const issuerId = body.issuerId?.trim() || envKeys.issuerId;
    const keyId = body.keyId?.trim() || envKeys.keyId;
    const privateKey = body.privateKey?.trim() || envKeys.privateKey;

    if (!issuerId || !keyId || !privateKey) {
      return NextResponse.json(
        { error: 'Missing App Store Connect API keys.' },
        { status: 401 }
      );
    }

    if (!hasPrivateKey(privateKey)) {
      return NextResponse.json(
        { error: 'Invalid private key format.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        appId,
        error: 'App Store Connect request signing and Analytics report fetching are not implemented yet.',
        connector: 'app-store-connect',
        credentialsSource: envKeys.privateKey ? 'env' : 'request',
        readyForRealCredentials: Boolean(issuerId && keyId && privateKey && appId),
        docs: 'https://developer.apple.com/documentation/appstoreconnectapi',
      },
      { status: 501 }
    );
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch App Store Connect data' },
      { status: 500 }
    );
  }
}
