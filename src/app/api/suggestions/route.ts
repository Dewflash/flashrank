import { NextRequest, NextResponse } from 'next/server';

const APPLE_HINTS_URL =
  'https://search.itunes.apple.com/WebObjects/MZSearchHints.woa/wa/hints';

/**
 * GET /api/suggestions
 *
 * Fetches keyword suggestions from Apple's MZSearchHints service.
 *
 * Query params:
 *   - term (required): The partial search query to get suggestions for.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const term = searchParams.get('term');

  if (!term) {
    return NextResponse.json(
      { error: 'Missing required query parameter: term' },
      { status: 400 }
    );
  }

  try {
    const url = `${APPLE_HINTS_URL}?clientApplication=Software&term=${encodeURIComponent(term)}`;
    const response = await fetch(url, { next: { revalidate: 3600 } });

    if (!response.ok) {
      throw new Error(
        `Apple Search Hints API responded with status ${response.status}`
      );
    }

    const text = await response.text();
    const suggestions = cleanSuggestions(parseHintsResponse(text), term);

    return NextResponse.json(
      { suggestions },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
        },
      }
    );
  } catch (error) {
    console.error(
      '[/api/suggestions] Error fetching from Apple Search Hints API:',
      error
    );

    return NextResponse.json(
      { error: 'Failed to fetch keyword suggestions', suggestions: [] },
      { status: 502 }
    );
  }
}

/**
 * Parse the hints response which can be XML or JSON.
 * Extracts keyword strings into a flat array.
 */
function parseHintsResponse(text: string): string[] {
  // Try parsing as JSON first
  try {
    const json = JSON.parse(text);

    // The JSON response may have a `hints` array of strings
    if (Array.isArray(json.hints)) {
      return json.hints.map((h: string | { term: string }) =>
        typeof h === 'string' ? h : h.term
      );
    }

    // Or it might be nested under `results`
    if (Array.isArray(json.results)) {
      return json.results.map((r: { term: string }) => r.term).filter(Boolean);
    }

    // Fallback: if the entire response is an array
    if (Array.isArray(json)) {
      return json.map((item: string | { term: string }) =>
        typeof item === 'string' ? item : item.term
      );
    }

    return [];
  } catch {
    // Not valid JSON — try XML parsing
  }

  // Simple XML extraction: pull <string> values from plist / XML
  const suggestions: string[] = [];

  // Match <string>...</string> tags commonly found in Apple plist responses
  const stringTagRegex = /<string>(.*?)<\/string>/gi;
  let match: RegExpExecArray | null;

  while ((match = stringTagRegex.exec(text)) !== null) {
    const value = match[1].trim();
    // Filter out non-keyword values (UUIDs, URLs, etc.)
    if (value && !value.startsWith('http') && value.length < 100) {
      suggestions.push(value);
    }
  }

  return [...new Set(suggestions)]; // Deduplicate
}

function cleanSuggestions(values: string[], term: string): string[] {
  const blocked = new Set([
    'suggestions',
    'software',
    'itunes',
    'app store',
    'search',
  ]);
  const normalizedTerm = term.trim().toLowerCase();
  const seen = new Set<string>();

  return values
    .map((value) => value.replace(/\s+/g, ' ').trim())
    .filter((value) => {
      const normalized = value.toLowerCase();
      if (normalized.length < 2 || normalized.length > 80) return false;
      if (blocked.has(normalized)) return false;
      if (!normalized.includes(normalizedTerm.split(/\s+/)[0])) return false;
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
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
