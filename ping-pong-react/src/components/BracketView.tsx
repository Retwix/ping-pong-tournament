import { useState } from 'react'
import { IconLayoutList, IconBinaryTree2 } from '@tabler/icons-react'
import { formatDuration, matchDuration } from '../lib/pingpong'
import { isPlayable, roundLabel } from '../lib/doubleElim'
import { BYE, TBD } from '../types'
import type { Bracket, Match } from '../types'

interface Props {
  matches: Match[]
  onOpen: (id: string) => void
}

type ViewMode = 'list' | 'tree'

function displayName(name: string): string {
  if (name === TBD) return 'À venir'
  if (name === BYE) return 'Bye'
  return name
}

/** One match cell, shared by both views. */
function MatchCell({ m, onOpen }: { m: Match; onOpen: (id: string) => void }) {
  const playable = isPlayable(m)
  const aWin = m.done && m.score_a > m.score_b
  const bWin = m.done && m.score_b > m.score_a
  const live = !m.done && (m.score_a > 0 || m.score_b > 0)
  const status = m.done ? 'Terminé' : live ? 'En cours' : playable ? 'À jouer' : 'En attente'
  const showScore = m.done || m.score_a > 0 || m.score_b > 0
  const cls = `match bracket-cell${m.done ? ' done' : live ? ' live' : ''}${playable ? ' playable' : ' pending'}`
  return (
    <div className={cls} onClick={playable ? () => onOpen(m.id) : undefined}>
      <div className="match-players">
        <span className={`mp ${aWin ? 'win' : m.done ? 'lose' : ''}${m.player_a === TBD ? ' tbd' : ''}`}>
          {displayName(m.player_a)}
          <span className="mp-score">{showScore ? m.score_a : ''}</span>
        </span>
        <span className={`mp ${bWin ? 'win' : m.done ? 'lose' : ''}${m.player_b === TBD ? ' tbd' : ''}`}>
          {displayName(m.player_b)}
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
}

function maxRound(matches: Match[], bracket: Bracket): number {
  return matches.filter((m) => m.bracket === bracket).reduce((mx, m) => Math.max(mx, m.round), 0)
}

function roundsOf(matches: Match[], bracket: Bracket): { round: number; items: Match[] }[] {
  const map = new Map<number, Match[]>()
  for (const m of matches) {
    if (m.bracket !== bracket) continue
    const arr = map.get(m.round) ?? []
    arr.push(m)
    map.set(m.round, arr)
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([round, items]) => ({ round, items: items.sort((x, y) => x.idx - y.idx) }))
}

export default function BracketView({ matches, onOpen }: Props) {
  const [view, setView] = useState<ViewMode>('list')

  // Hide auto-completed walkovers (BYEs): they aren't games anyone plays.
  const visible = matches.filter((m) => !m.bye)
  const maxW = maxRound(visible, 'W')
  const maxL = maxRound(visible, 'L')
  const doneCount = visible.filter((m) => m.done).length

  const wRounds = roundsOf(visible, 'W')
  const lRounds = roundsOf(visible, 'L')
  const gf = visible.filter((m) => m.bracket === 'GF')

  const Column = ({ round, items, bracket }: { round: number; items: Match[]; bracket: Bracket }) => (
    <div className="bracket-col">
      <div className="bracket-col-head">{roundLabel(bracket, round, maxW, maxL)}</div>
      <div className="bracket-col-body">
        {items.map((m) => (
          <MatchCell key={m.id} m={m} onOpen={onOpen} />
        ))}
      </div>
    </div>
  )

  return (
    <section>
      <div className="section-title with-toggle">
        Tableau <span className="count">{doneCount}/{visible.length} joués</span>
        <div className="view-toggle">
          <button
            className={view === 'list' ? 'active' : ''}
            onClick={() => setView('list')}
            title="Vue liste"
            aria-label="Vue liste"
          >
            <IconLayoutList size={17} stroke={1.8} />
          </button>
          <button
            className={view === 'tree' ? 'active' : ''}
            onClick={() => setView('tree')}
            title="Vue tableau"
            aria-label="Vue tableau"
          >
            <IconBinaryTree2 size={17} stroke={1.8} />
          </button>
        </div>
      </div>

      {view === 'list' ? (
        <div className="bracket-list">
          {[...wRounds.map((r) => ({ ...r, bracket: 'W' as Bracket })),
            ...lRounds.map((r) => ({ ...r, bracket: 'L' as Bracket })),
            ...gf.map((m) => ({ round: m.round, items: [m], bracket: 'GF' as Bracket }))].map((grp) => (
            <div key={`${grp.bracket}-${grp.round}`}>
              <div className="round-label">{roundLabel(grp.bracket, grp.round, maxW, maxL)}</div>
              {grp.items.map((m) => (
                <MatchCell key={m.id} m={m} onOpen={onOpen} />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="bracket-tree">
          {wRounds.length > 0 && (
            <div className="bracket-region">
              <div className="bracket-region-title">Tableau des gagnants</div>
              <div className="bracket-cols">
                {wRounds.map((r) => (
                  <Column key={`W${r.round}`} round={r.round} items={r.items} bracket="W" />
                ))}
              </div>
            </div>
          )}
          {lRounds.length > 0 && (
            <div className="bracket-region">
              <div className="bracket-region-title">Tableau des perdants</div>
              <div className="bracket-cols">
                {lRounds.map((r) => (
                  <Column key={`L${r.round}`} round={r.round} items={r.items} bracket="L" />
                ))}
              </div>
            </div>
          )}
          {gf.length > 0 && (
            <div className="bracket-region">
              <div className="bracket-region-title">Grande finale</div>
              <div className="bracket-cols">
                <Column round={1} items={gf} bracket="GF" />
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
