/** Accent- and case-insensitive canonical form for search matching (« Léo » → « leo »). */
export const fold = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
