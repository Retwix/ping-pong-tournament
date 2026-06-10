export interface ScheduledRound {
  /** Pairs of player names that play this round. */
  pairs: [string, string][]
  /** Players sitting out this round (only when player count is odd). */
  byes: string[]
}

const BYE = '__BYE__'

/** Returns a new array with the elements randomly shuffled (Fisher–Yates). */
export function shuffle<T>(input: T[]): T[] {
  const arr = input.slice()
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * Round-robin schedule via the circle method.
 * Every player meets every other exactly once. Odd counts get one bye per round.
 */
export function generateSchedule(players: string[]): ScheduledRound[] {
  const list = players.slice()
  const hasBye = list.length % 2 !== 0
  if (hasBye) list.push(BYE)

  const n = list.length
  const roundsCount = n - 1
  const half = n / 2
  let arr = list.slice()
  const rounds: ScheduledRound[] = []

  for (let r = 0; r < roundsCount; r++) {
    const pairs: [string, string][] = []
    const byes: string[] = []
    for (let i = 0; i < half; i++) {
      const p1 = arr[i]
      const p2 = arr[n - 1 - i]
      if (p1 === BYE) byes.push(p2)
      else if (p2 === BYE) byes.push(p1)
      else pairs.push([p1, p2])
    }
    rounds.push({ pairs, byes })
    // rotate: keep first fixed, rotate the rest clockwise
    arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)]
  }
  return rounds
}

/** Total number of matches for a round-robin of `n` players. */
export function matchCount(n: number): number {
  return (n * (n - 1)) / 2
}

/** Number of rounds (tours) for `n` players. */
export function roundCount(n: number): number {
  return n % 2 === 0 ? n - 1 : n
}
