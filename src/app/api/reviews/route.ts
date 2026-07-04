import { NextRequest, NextResponse } from 'next/server';

const LOOKUP_URL = 'https://itunes.apple.com/lookup';

interface RSSReviewEntry {
  id?: { label?: string };
  title?: { label?: string };
  content?: { label?: string };
  author?: { name?: { label?: string } };
  updated?: { label?: string };
  'im:rating'?: { label?: string };
  'im:version'?: { label?: string };
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const id = searchParams.get('id');
  const country = (searchParams.get('country') || 'us').toLowerCase();

  if (!id) {
    return NextResponse.json({ error: 'Missing id.' }, { status: 400 });
  }

  try {
    const [lookupResponse, reviewsResponse] = await Promise.all([
      fetch(`${LOOKUP_URL}?id=${encodeURIComponent(id)}&country=${encodeURIComponent(country)}`, {
        next: { revalidate: 900 },
      }),
      fetch(
        `https://itunes.apple.com/${encodeURIComponent(country)}/rss/customerreviews/id=${encodeURIComponent(id)}/sortBy=mostRecent/json`,
        { next: { revalidate: 900 } }
      ),
    ]);

    if (!lookupResponse.ok) {
      throw new Error(`Lookup failed with ${lookupResponse.status}`);
    }

    const lookup = await lookupResponse.json();
    const app = lookup.results?.[0] ?? null;
    let reviews: Array<{
      id: string;
      title: string;
      body: string;
      author: string;
      rating: number;
      version: string | null;
      updatedAt: string | null;
    }> = [];

    if (reviewsResponse.ok) {
      const reviewsJson = await reviewsResponse.json();
      const entries = reviewsJson.feed?.entry ?? [];
      const reviewEntries: RSSReviewEntry[] = Array.isArray(entries)
        ? entries.slice(1)
        : [];

      reviews = reviewEntries.map((entry, index) => ({
        id: entry.id?.label ?? `${country}-${index}`,
        title: entry.title?.label ?? 'Untitled review',
        body: entry.content?.label ?? '',
        author: entry.author?.name?.label ?? 'Anonymous',
        rating: Number(entry['im:rating']?.label ?? 0),
        version: entry['im:version']?.label ?? null,
        updatedAt: entry.updated?.label ?? null,
      }));
    }

    return NextResponse.json({
      country,
      rating: app?.averageUserRating ?? 0,
      ratingCount: app?.userRatingCount ?? 0,
      reviews,
      source: 'public-itunes',
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch ratings and reviews.' },
      { status: 502 }
    );
  }
}
