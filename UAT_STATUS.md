# FlashRank UAT Status

This app uses public Apple App Store/iTunes endpoints where possible. It does not fake private Apple metrics. Features that require Apple Search Ads, App Store Connect, DeepL, or Lemon Squeezy are wired as key-required/blocked states until credentials and the signed connector implementation exist.

## Section C: Keyword Intelligence & ASO Data

| Test ID | Status | Notes |
| --- | --- | --- |
| C1 Popularity & Difficulty | Partial | Difficulty is calculated from public top-result competition. Popularity is deterministic estimated data. Exact Apple Search Ads popularity is not public/free, and the signed Apple Ads connector is intentionally blocked instead of returning fake data. |
| C2 Historical Graphs | Pass | Click a tracked keyword to open the detail panel with 30-day rank history. Newly added keywords start with a first snapshot, then history grows through refresh/sync. |
| C3 Keyword Suggestions | Pass | Find Suggestions uses public Apple hints/search plus metadata-derived seed terms. |
| C4 Keyword Translation | Key required | Hovering non-English keywords calls the server-side DeepL route. Without `DEEPL_AUTH_KEY`, the tooltip reports that a DeepL key is required. |

## Section D: Competitor Analysis

| Test ID | Status | Notes |
| --- | --- | --- |
| D1 Extract Competitor Keywords | Partial | Competitor cards can scan candidate terms and add observed public ranking keywords where the competitor appears in App Store search results. Apple does not provide a public “all keywords this app ranks for” endpoint. |
| D2 Competitor Rankings | Pass | Keyword comparison shows side-by-side app and competitor ranks for tracked keywords. Extraction adds competitor rank snapshots from public search results. |

## Section E: Ratings & Reviews Monitoring

| Test ID | Status | Notes |
| --- | --- | --- |
| E1 Global Ratings Fetch | Pass | Ratings & Reviews samples public storefront lookup data and calculates total/weighted average across supported storefronts. |
| E2 New Review Detection | Partial | Latest public text reviews load from Apple RSS storefront feeds. Full owner-grade review workflow/history still requires App Store Connect. |

## Section F: Licensing & Billing

| Test ID | Status | Notes |
| --- | --- | --- |
| F1 Free Trial Limits | Not implemented | Lemon Squeezy is not needed for free-only use. Add if/when premium gating is wanted. |
| F2 Purchase Flow | Not implemented | Requires a Lemon Squeezy product/checkout URL. |
| F3 License Activation | Not implemented | Requires Lemon Squeezy license API key and license policy. |

## Edge Cases

| Scenario | Status | Notes |
| --- | --- | --- |
| API rate limiting | Pass | Forced refreshes now run through a sequential client-side queue with progress and per-keyword skip handling. Failed keyword refreshes preserve previous ranks instead of blanking them. |
| Network loss | Pass | Refresh and competitor extraction detect offline state and show a clear “No Internet Connection” message instead of hanging or overwriting ranks. |
| Obscure storefronts | Pass | Public routes return empty/N/A states rather than fake scores when Apple does not return storefront data. |
