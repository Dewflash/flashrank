import type { AppMetadata } from '@/types';

export const ALL_TIME_POPULAR_KEYWORDS = [
  'chatgpt',
  'vpn',
  'google',
  'gmail',
  'youtube',
  'instagram',
  'tiktok',
  'whatsapp',
  'facebook',
  'telegram',
  'netflix',
  'spotify',
  'amazon',
  'maps',
  'weather',
  'photo editor',
  'video editor',
  'calendar',
  'planner',
  'habit tracker',
  'fitness',
  'ai',
  'browser',
  'translate',
  'games',
  'puzzle',
  'farm',
  'music',
  'notes',
  'budget',
];

const STOPWORDS = new Set([
  'app',
  'apps',
  'and',
  'for',
  'free',
  'the',
  'with',
  'your',
  'you',
  'ios',
  'iphone',
  'ipad',
  'mobile',
  'first',
  'pro',
  'plus',
]);

const RELATED_SEEDS: Array<{ patterns: RegExp[]; terms: string[] }> = [
  {
    patterns: [/christian/, /prayer/, /bible/, /faith/, /devotional/, /scripture/, /worship/],
    terms: [
      'daily prayer',
      'christian prayer',
      'bible study',
      'daily devotional',
      'devotional',
      'scripture',
      'bible verse',
      'prayer journal',
      'faith journal',
      'christian meditation',
      'worship',
      'pray',
    ],
  },
  {
    patterns: [/farm/, /farming/, /harvest/, /crop/, /village/, /hay/],
    terms: [
      'farm game',
      'farming game',
      'harvest game',
      'village game',
      'crop game',
      'animal farm',
      'farm simulator',
      'country farm',
      'farm town',
      'barn game',
    ],
  },
  {
    patterns: [/habit/, /goal/, /routine/, /planner/, /productiv/],
    terms: [
      'habit tracker',
      'daily habits',
      'goal tracker',
      'routine planner',
      'productivity',
      'to do list',
      'self improvement',
      'daily planner',
      'streaks',
    ],
  },
  {
    patterns: [/fitness/, /workout/, /run/, /health/, /training/],
    terms: [
      'workout tracker',
      'fitness tracker',
      'training plan',
      'running tracker',
      'exercise',
      'health tracker',
      'gym workout',
    ],
  },
  {
    patterns: [/photo/, /camera/, /video/, /edit/],
    terms: [
      'photo editor',
      'video editor',
      'camera filters',
      'photo effects',
      'image editor',
      'collage maker',
    ],
  },
  {
    patterns: [/budget/, /finance/, /money/, /expense/, /bank/],
    terms: [
      'budget planner',
      'expense tracker',
      'money manager',
      'personal finance',
      'spending tracker',
      'bill organizer',
    ],
  },
];

function normalizeTerm(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function uniqueTerms(values: string[], limit = 24): string[] {
  const seen = new Set<string>();
  return values
    .map(normalizeTerm)
    .filter((value) => {
      if (value.length < 2 || value.length > 60 || seen.has(value)) return false;
      seen.add(value);
      return true;
    })
    .slice(0, limit);
}

function importantTokens(text: string): string[] {
  return normalizeTerm(text)
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token))
    .slice(0, 12);
}

export function buildContextualKeywordSeeds(app: AppMetadata): string[] {
  const name = normalizeTerm(app.name);
  const category = normalizeTerm(app.category);
  const description = normalizeTerm(app.description ?? '');
  const genres = (app.genres ?? []).map(normalizeTerm).join(' ');
  const evidence = [name, category, description, genres].filter(Boolean).join(' ');
  const nameTokens = importantTokens(app.name);
  const descriptionTokens = importantTokens(description).filter((token) => !nameTokens.includes(token));
  const relatedSeeds = RELATED_SEEDS.flatMap((group) =>
    group.patterns.some((pattern) => pattern.test(evidence)) ? group.terms : []
  );

  return uniqueTerms(
    [
      ...relatedSeeds,
      name,
      ...nameTokens,
      ...nameTokens.map((token) => `${token} app`),
      ...nameTokens.slice(0, 4).flatMap((token) =>
        descriptionTokens.slice(0, 3).map((descriptionToken) => `${token} ${descriptionToken}`)
      ),
      ...descriptionTokens.slice(0, 8),
      category ? `${category} apps` : '',
      category ? `best ${category} apps` : '',
    ],
    36
  );
}
