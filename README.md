# FlashRank

A desktop-style ASO studio for tracking App Store keyword ranks, popularity, difficulty, competitors, notes, and region-specific keyword sets.

The default workspace is seeded with Hay Day and the farming competitors you supplied so the app opens into a useful ASO board immediately.

## Run locally

```bash
npm run dev
```

Then open `http://localhost:3000`.

## Data sources

FlashRank currently uses:

- Apple's public iTunes Search/Lookup API for app lookup, pasted App Store URLs, keyword rank checks, top apps, and competitor rank comparison.
- Apple Search Hints for keyword suggestions.
- Deterministic estimated fallback scores for keyword popularity until Apple Search Ads request signing is wired.
- Placeholder App Store Connect metrics until App Store Connect request signing is wired.

The UI labels estimated data so it is not confused with Apple-backed metrics.

## Free mode

No keys are required for the public App Store pieces:

- Search by app name or paste an App Store URL.
- Add your app and competitor apps.
- Track keyword rank snapshots by region.
- Compare competitor ranks in the same keyword result set.
- Generate keyword suggestions and estimated popularity/difficulty.
- Refresh keyword rankings through a visible queue that preserves previous ranks if Apple data is unavailable.
- Export and local workspace state.

Apple does not expose every TryAstro-style metric for free. Impressions, downloads, product page analytics, real Search Ads popularity, and private app analytics need authenticated Apple APIs.

## API keys to collect later

Do not commit these keys. Copy `.env.local.example` to `.env.local` and paste the values there when you are ready to test real integrations. The settings screen detects complete `.env.local` credentials without exposing the private key values to the browser.

### App Store Connect

Create an API key in App Store Connect with the least privileges needed for analytics/report access:

1. Open App Store Connect.
2. Go to Users and Access.
3. Open Integrations.
4. Create or add an App Store Connect API key.
5. Download the `.p8` private key once and keep the Issuer ID and Key ID.

Paste into `.env.local`:

- Issuer ID
- Key ID
- `.p8` private key contents

### Apple Search Ads

Create Apple Search Ads / Apple Ads API credentials when API access is available for the account. Access can depend on account setup and permissions.

Paste into `.env.local`:

- Client ID
- Team ID
- Key ID
- Private key contents

## Useful scripts

```bash
npm run lint
npm run build
```
