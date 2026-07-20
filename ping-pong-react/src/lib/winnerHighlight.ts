/**
 * Segments of a game title around the winner's name, so the UI can emphasize
 * the winner inside titles like "Alice vs Bob".
 */
export interface WinnerSplit {
  before: string
  winner: string
  after: string
}

const isLetter = (ch: string | undefined): boolean =>
  ch !== undefined && /\p{L}/u.test(ch)

/**
 * Split `name` around the first whole-word occurrence of `winner`. Matching is
 * done on plain string positions (no regex on the name) so names containing
 * regex metacharacters are handled literally; "whole word" means the match is
 * not flanked by Unicode letters, so "Ali" never matches inside "Alice".
 * Returns null when the winner does not appear — callers fall back to showing
 * the winner elsewhere on the card.
 */
export function splitOnWinner(name: string, winner: string): WinnerSplit | null {
  if (winner === '') return null
  let from = 0
  while (from <= name.length - winner.length) {
    const at = name.indexOf(winner, from)
    if (at === -1) return null
    const wholeWord = !isLetter(name[at - 1]) && !isLetter(name[at + winner.length])
    if (wholeWord) {
      return {
        before: name.slice(0, at),
        winner: name.slice(at, at + winner.length),
        after: name.slice(at + winner.length),
      }
    }
    from = at + 1
  }
  return null
}
