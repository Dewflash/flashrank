'use client';

/* eslint-disable react-hooks/set-state-in-effect */

import React from 'react';
import { Globe2, MessageSquare, RefreshCw, Star } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

type Review = {
  id: string;
  title: string;
  body: string;
  author: string;
  rating: number;
  version: string | null;
  updatedAt: string | null;
};

type StorefrontReviewPayload = {
  country: string;
  rating: number;
  ratingCount: number;
  reviews: Review[];
  source: 'public-itunes';
};

const STORE_FRONTS = ['us', 'gb', 'ca', 'au', 'sg', 'de', 'fr', 'jp'];

function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase()) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

function formatDate(value: string | null): string {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function RatingsReviewsView() {
  const { apps, selectedAppId, selectedRegion } = useAppStore();
  const selectedApp = apps.find((app) => app.id === selectedAppId);
  const [rows, setRows] = React.useState<StorefrontReviewPayload[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const storefronts = React.useMemo(
    () => Array.from(new Set([selectedRegion.toLowerCase(), ...STORE_FRONTS])),
    [selectedRegion]
  );

  const loadReviews = React.useCallback(async () => {
    if (!selectedAppId) return;

    setIsLoading(true);
    setError(null);

    try {
      const responses = await Promise.all(
        storefronts.map(async (country) => {
          const params = new URLSearchParams({ id: selectedAppId, country });
          const response = await fetch(`/api/reviews?${params.toString()}`);
          if (!response.ok) return null;
          return (await response.json()) as StorefrontReviewPayload;
        })
      );

      const nextRows = responses
        .filter((row): row is StorefrontReviewPayload => row !== null)
        .sort((a, b) => b.ratingCount - a.ratingCount);

      setRows(nextRows);
      if (nextRows.length === 0) {
        setError('No public rating data returned for this app.');
      }
    } catch {
      setRows([]);
      setError('Could not load public App Store ratings right now.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedAppId, storefronts]);

  React.useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  const totalRatings = rows.reduce((sum, row) => sum + row.ratingCount, 0);
  const averageRating =
    totalRatings > 0
      ? rows.reduce((sum, row) => sum + row.rating * row.ratingCount, 0) / totalRatings
      : selectedApp?.rating ?? 0;
  const recentReviews = rows
    .flatMap((row) =>
      row.reviews.map((review) => ({
        ...review,
        country: row.country,
      }))
    )
    .sort((a, b) => {
      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 24);

  if (!selectedApp) {
    return (
      <div className="empty-state" style={{ flex: 1 }}>
        <Star size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
        <div className="empty-state-title">Add an app first</div>
        <div className="empty-state-text">Ratings and reviews load for the selected App Store app.</div>
      </div>
    );
  }

  return (
    <div className="ratings-view">
      <div className="ratings-header">
        <div className="ratings-app">
          {selectedApp.icon ? (
            <img src={selectedApp.icon} alt={selectedApp.name} className="ratings-app-icon" />
          ) : (
            <div className="ratings-app-icon placeholder">{selectedApp.name.charAt(0)}</div>
          )}
          <div>
            <h2>{selectedApp.name}</h2>
            <p>{selectedApp.developer} · public App Store storefront data</p>
          </div>
        </div>
        <button className="btn btn-secondary" onClick={loadReviews} disabled={isLoading}>
          <RefreshCw size={16} className={isLoading ? 'spin' : ''} />
          Refresh
        </button>
      </div>

      {error && <div className="credential-note">{error}</div>}

      <div className="ratings-summary-grid">
        <div className="overview-card">
          <div className="overview-card-title">
            <Star size={14} style={{ marginRight: 6, opacity: 0.5 }} />
            Global Ratings
          </div>
          <div className="overview-card-value">
            {isLoading ? '...' : totalRatings.toLocaleString()}
          </div>
          <div className="overview-card-subtitle">sampled public storefronts</div>
        </div>
        <div className="overview-card">
          <div className="overview-card-title">
            <Star size={14} style={{ marginRight: 6, opacity: 0.5 }} />
            Average Rating
          </div>
          <div className="overview-card-value">
            {isLoading ? '...' : averageRating.toFixed(2)}
          </div>
          <div className="overview-card-subtitle">weighted by rating count</div>
        </div>
        <div className="overview-card">
          <div className="overview-card-title">
            <MessageSquare size={14} style={{ marginRight: 6, opacity: 0.5 }} />
            Recent Reviews
          </div>
          <div className="overview-card-value">{recentReviews.length}</div>
          <div className="overview-card-subtitle">from public RSS feeds</div>
        </div>
      </div>

      <div className="ratings-grid">
        <section className="overview-card ratings-card">
          <div className="chart-section-title">
            <Globe2 size={14} />
            Storefront Ratings
          </div>
          <div className="table-container ratings-table-wrap">
            <table className="data-table ratings-table">
              <thead>
                <tr>
                  <th>Country</th>
                  <th>Ratings</th>
                  <th>Average</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.country}>
                    <td>{countryName(row.country)}</td>
                    <td>{row.ratingCount.toLocaleString()}</td>
                    <td>
                      <span className="rating-stars">
                        <Star size={13} fill="currentColor" />
                        {row.rating ? row.rating.toFixed(2) : 'N/A'}
                      </span>
                    </td>
                  </tr>
                ))}
                {!isLoading && rows.length === 0 && (
                  <tr>
                    <td colSpan={3}>No storefront ratings found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="overview-card ratings-card">
          <div className="chart-section-title">
            <MessageSquare size={14} />
            Latest Text Reviews
          </div>
          <div className="reviews-list">
            {isLoading && <div className="credential-note">Loading recent reviews...</div>}
            {!isLoading && recentReviews.length === 0 && (
              <div className="credential-note">No public text reviews returned for sampled storefronts.</div>
            )}
            {recentReviews.map((review) => (
              <article key={`${review.country}-${review.id}`} className="review-item">
                <div className="review-head">
                  <strong>{review.title}</strong>
                  <span className="rating-stars">
                    <Star size={12} fill="currentColor" />
                    {review.rating || 'N/A'}
                  </span>
                </div>
                <p>{review.body}</p>
                <div className="review-meta">
                  {review.author} · {countryName(review.country)} · {formatDate(review.updatedAt)}
                  {review.version ? ` · v${review.version}` : ''}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
