import { formatDuration, matchDuration } from '../lib/pingpong'
import type { Match, Tournament } from '../types'

interface Props {
  tournament: Tournament
  matches: Match[]
  onOpen: (id: string) => void
}

function groupByRound(matches: Match[]): { round: number; items: Match[] }[] {
  const map = new Map<number, Match[]>()
  for (const m of matches) {
    const arr = map.get(m.round) ?? []
    arr.push(m)
    map.set(m.round, arr)
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([round, items]) => ({ round, items }))
}

export default function MatchList({ tournament, matches, onOpen }: Props) {
  const rounds = groupByRound(matches)
  const doneCount = matches.filter((m) => m.done).length

  const timed = matches.filter((m) => m.done && m.started_at && m.ended_at)
  const tag = (m: Match) => `${m.player_a}–${m.player_b} (${formatDuration(matchDuration(m))})`
  let stats: { longest: Match; shortest: Match } | null = null
  if (timed.length) {
    const longest = timed.reduce((x, y) => (matchDuration(y) > matchDuration(x) ? y : x))
    const shortest = timed.reduce((x, y) => (matchDuration(y) < matchDuration(x) ? y : x))
    stats = { longest, shortest }
  }

  return (
    <section>
      <div className="section-title">
        Les matchs <span className="count">{doneCount}/{matches.length} joués</span>
      </div>

      {rounds.map(({ round, items }) => {
        const playing = new Set<string>()
        items.forEach((m) => {
          playing.add(m.player_a)
          playing.add(m.player_b)
        })
        const byes = tournament.players.filter((p) => !playing.has(p))
        return (
          <div key={round}>
            <div className="round-label">
              Tour {round}
              {byes.length > 0 && <span className="bye">&middot; exempt : {byes.join(', ')}</span>}
            </div>
            {items.map((m) => {
              const aWin = m.done && m.score_a > m.score_b
              const bWin = m.done && m.score_b > m.score_a
              const live = !m.done && (m.score_a > 0 || m.score_b > 0)
              const status = m.done ? 'Terminé' : live ? 'En cours' : 'À jouer'
              const showScore = m.done || m.score_a > 0 || m.score_b > 0
              return (
                <div
                  key={m.id}
                  className={`match${m.done ? ' done' : live ? ' live' : ''}`}
                  onClick={() => onOpen(m.id)}
                >
                  <div className="match-players">
                    <span className={`mp ${aWin ? 'win' : m.done ? 'lose' : ''}`}>
                      {m.player_a}
                      <span className="mp-score">{showScore ? m.score_a : ''}</span>
                    </span>
                    <span className={`mp ${bWin ? 'win' : m.done ? 'lose' : ''}`}>
                      {m.player_b}
                      <span className="mp-score">{showScore ? m.score_b : ''}</span>
                    </span>
                  </div>
                  <div className="match-status">
                    <span className="dot" />
                    {status}
                    {m.done ? ` · ${formatDuration(matchDuration(m))}` : ''}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}

      {stats && (
        <div className="match-stats">
          ⏱ Plus long : <b>{tag(stats.longest)}</b> &middot; Plus court : <b>{tag(stats.shortest)}</b>
        </div>
      )}
    </section>
  )
}
