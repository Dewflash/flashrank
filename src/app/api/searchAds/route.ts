import { NextResponse } from 'next/server';
import { getAppleSearchAdsEnv, hasPrivateKey } from '@/lib/serverCredentials';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const envKeys = getAppleSearchAdsEnv();
    const {
      keyword,
    } = body;
    const clientId = body.clientId?.trim() || envKeys.clientId;
    const teamId = body.teamId?.trim() || envKeys.teamId;
    const keyId = body.keyId?.trim() || envKeys.keyId;
    const privateKey = body.privateKey?.trim() || envKeys.privateKey;

    if (!clientId || !teamId || !keyId || !privateKey) {
      return NextResponse.json(
        { error: 'Missing Apple Search Ads API keys.' },
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
        keyword,
        error: 'Apple Search Ads request signing is not implemented yet.',
        connector: 'apple-search-ads',
        credentialsSource: envKeys.privateKey ? 'env' : 'request',
        readyForRealCredentials: Boolean(clientId && teamId && keyId && privateKey),
        docs: 'https://developer.apple.com/documentation/apple-ads-api',
      },
      { status: 501 }
    );
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch Search Ads data' },
      { status: 500 }
    );
  }
}
