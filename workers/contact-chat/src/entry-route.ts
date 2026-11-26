/** Browser-declared attribution for the standard contact route. */
export type EntryRoute = 'corJpDirect' | 'griftaiLink' | 'unknown';

export function readEntryRoute(value: unknown): EntryRoute {
  return value === 'corJpDirect' || value === 'griftaiLink' ? value : 'unknown';
}

export function entryAttribution(entryRoute: EntryRoute) {
  const site = entryRoute === 'griftaiLink' ? 'griftai'
    : entryRoute === 'corJpDirect' ? 'corJp' : 'unknown';
  return { entryRoute, site, provenance: 'declared' as const };
}
