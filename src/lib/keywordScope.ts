export const KEYWORD_RESEARCH_APP_ID = '__keyword_research__';

export function getKeywordScopeAppId(selectedAppId: string | null | undefined): string {
  return selectedAppId ?? KEYWORD_RESEARCH_APP_ID;
}

export function isKeywordResearchScope(appId: string | null | undefined): boolean {
  return appId === KEYWORD_RESEARCH_APP_ID;
}
