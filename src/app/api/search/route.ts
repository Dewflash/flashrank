import { NextRequest, NextResponse } from 'next/server';

const ITUNES_SEARCH_URL = 'https://itunes.apple.com/search';

/**
 * GET /api/search
 *
 * Proxies search requests to the iTunes Search API.
 *
 * Query params:
 *   - term (required): The search query string.
 *   - country (optional, default 'us'): Two-letter country code.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const term = searchParams.get('term');
  const country = searchParams.get('country') || 'us';

  if (!term) {
    return NextResponse.json(
      { error: 'Missing required query parameter: term' },
      { status: 400 }
    );
  }

  try {
    const url = `${ITUNES_SEARCH_URL}?term=${encodeURIComponent(term)}&country=${encodeURIComponent(country)}&entity=software&limit=25`;
    const response = await fetch(url, { next: { revalidate: 60 } });

    if (!response.ok) {
      throw new Error(`iTunes API responded with status ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json(data, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('[/api/search] Error fetching from iTunes API:', error);

    return NextResponse.json(
      { error: 'Failed to fetch search results from iTunes API' },
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
