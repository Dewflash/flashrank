import type { KeywordTag } from '@/types';

export const seedTags: KeywordTag[] = [
  { id: 'tag-brand', name: 'Brand', color: 'var(--tag-blue)' },
  { id: 'tag-generic', name: 'Generic', color: 'var(--tag-green)' },
  { id: 'tag-competitor', name: 'Competitor', color: 'var(--tag-orange)' },
  { id: 'tag-priority', name: 'High Priority', color: 'var(--tag-red)' },
];

export const legacyDemoAppIds = new Set([
  '506627515',
  '732319042',
  '824318267',
  '843506607',
  '998449634',
]);
