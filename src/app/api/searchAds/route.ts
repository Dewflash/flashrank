import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { clientId, teamId, keyId, privateKey, keyword } = body;

    // In a true production environment, we would use the Search Ads API
    // https://api.searchads.apple.com/api/v4/keywords/targeting/search
    // using the provided certificates to fetch exact search volume.

    if (!clientId || !teamId || !keyId || !privateKey) {
      return NextResponse.json(
        { error: 'Missing Apple Search Ads API keys.' },
        { status: 401 }
      );
    }

    if (!privateKey.includes('BEGIN PRIVATE KEY')) {
      return NextResponse.json(
        { error: 'Invalid private key format.' },
        { status: 400 }
      );
    }

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Return a mocked exact popularity score from 1-100
    // We deterministically generate a score based on the string length
    // so it stays consistent for the same keyword during a session.
    let hash = 0;
    for (let i = 0; i < keyword.length; i++) {
      hash = keyword.charCodeAt(i) + ((hash << 5) - hash);
    }
    const score = Math.abs(hash) % 100;

    return NextResponse.json({
      data: {
        keyword,
        popularity: Math.max(5, score), // ASA scores are typically 5-100
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch Search Ads data' },
      { status: 500 }
    );
  }
}
