import { teamLabel } from './teams'

/** Accent- and case-insensitive canonical form for search matching (« Léo » → « leo »). */
export const fold = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Does this player match an already-folded search query, by name or pôle label? */
export const matchesJoueur = (j: { name: string; team: string }, foldedQuery: string): boolean =>
  fold(j.name).includes(foldedQuery) || fold(teamLabel(j.team)).includes(foldedQuery)
