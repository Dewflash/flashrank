import { NextRequest, NextResponse } from 'next/server';

const ITUNES_LOOKUP_URL = 'https://itunes.apple.com/lookup';

/**
 * GET /api/lookup
 *
 * Looks up a specific app by its App Store ID via the iTunes Lookup API.
 *
 * Query params:
 *   - id (required): The App Store ID (numeric string).
 *   - country (optional, default 'us'): Two-letter country code.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const id = searchParams.get('id');
  const country = searchParams.get('country') || 'us';

  if (!id) {
    return NextResponse.json(
      { error: 'Missing required query parameter: id' },
      { status: 400 }
    );
  }

  try {
    const url = `${ITUNES_LOOKUP_URL}?id=${encodeURIComponent(id)}&country=${encodeURIComponent(country)}`;
    const response = await fetch(url, { next: { revalidate: 300 } });

    if (!response.ok) {
      throw new Error(`iTunes API responded with status ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json(data, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('[/api/lookup] Error fetching from iTunes API:', error);

    return NextResponse.json(
      { error: 'Failed to look up app from iTunes API' },
      { status: 502 }
    );
  }
}

/**
 * OPTIONS handler for CORS preflight requests.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
