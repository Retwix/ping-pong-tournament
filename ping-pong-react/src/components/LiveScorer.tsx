import { useEffect, useRef, useState } from 'react'
import { formatDuration, isMatchPoint, isWon, matchDuration, serverIsA } from '../lib/pingpong'
import type { Match, MatchSide } from '../types'

interface Props {
  match: Match
  target: number
  onPatch: (patch: Partial<Match>) => void
  onClose: () => void
  onFinish: () => void
}

export default function LiveScorer({ match, target, onPatch, onClose, onFinish }: Props) {
  // Per-session undo stack of [score_a, score_b] snapshots.
  const historyRef = useRef<[number, number][]>([])
  // Tick state purely to re-render the running clock.
  const [, forceTick] = useState(0)

  const won = isWon(match.score_a, match.score_b, target)
  const aWon = won && match.score_a > match.score_b
  const bWon = won && match.score_b > match.score_a
  const aServe = !won && serverIsA(match, target)
  const aMp = !won && isMatchPoint(true, match.score_a, match.score_b, target)
  const bMp = !won && isMatchPoint(false, match.score_a, match.score_b, target)

  const addPoint = (side: MatchSide) => {
    if (isWon(match.score_a, match.score_b, target)) return
    historyRef.current.push([match.score_a, match.score_b])
    const patch: Partial<Match> =
      side === 'a' ? { score_a: match.score_a + 1 } : { score_b: match.score_b + 1 }
    if (!match.started_at && match.score_a + match.score_b === 0) {
      patch.started_at = new Date().toISOString()
    }
    onPatch(patch)
  }
  const undo = () => {
    const prev = historyRef.current.pop()
    if (prev) onPatch({ score_a: prev[0], score_b: prev[1] })
  }
  const finish = () => {
    if (!isWon(match.score_a, match.score_b, target)) return
    onPatch({ done: true, ended_at: new Date().toISOString() })
    onFinish()
  }
  const swapServe = () => {
    if (match.score_a + match.score_b === 0) {
      onPatch({ serve_start: match.serve_start === 'a' ? 'b' : 'a' })
    }
  }

  // Running clock while the match is live.
  useEffect(() => {
    if (match.done) return
    const id = setInterval(() => forceTick((n) => n + 1), 500)
    return () => clearInterval(id)
  }, [match.done])

  // Keyboard shortcuts (rebound each render so closures see the latest score).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          addPoint('a')
          break
        case 'ArrowRight':
          e.preventDefault()
          addPoint('b')
          break
        case 'z':
        case 'Z':
        case 'Backspace':
          e.preventDefault()
          undo()
          break
        case 'Enter':
          e.preventDefault()
          finish()
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="overlay">
      <div className="ov-top">
        <button className="ov-close" onClick={onClose}>
          ✕
        </button>
        <span className="ov-timer">{formatDuration(matchDuration(match))}</span>
        <span className="ov-target">
          Jeu en {target} · {match.player_a} vs {match.player_b}
        </span>
      </div>

      <div className="scoreboard">
        <div
          className={`side${aServe ? ' serving' : ''}${aWon ? ' winner' : ''}${aMp ? ' mpoint' : ''}`}
          onClick={() => addPoint('a')}
        >
          <span className="matchpoint-flag">Balle de match</span>
          <span className="side-name">
            <span className="serve-pip" />
            <span className="nm">{match.player_a}</span>
          </span>
          <span className="side-score">{match.score_a}</span>
          <span className="tap-hint">{aWon ? 'Vainqueur 🏆' : 'Tape pour +1'}</span>
        </div>

        <div
          className={`side${!won && !aServe ? ' serving' : ''}${bWon ? ' winner' : ''}${bMp ? ' mpoint' : ''}`}
          onClick={() => addPoint('b')}
        >
          <span className="matchpoint-flag">Balle de match</span>
          <span className="side-name">
            <span className="serve-pip" />
            <span className="nm">{match.player_b}</span>
          </span>
          <span className="side-score">{match.score_b}</span>
          <span className="tap-hint">{bWon ? 'Vainqueur 🏆' : 'Tape pour +1'}</span>
        </div>
      </div>

      <div className="ov-controls">
        <button onClick={undo}>↶ Annuler</button>
        <button onClick={swapServe}>🏓 Service</button>
        <button className="primary" disabled={!won} onClick={finish}>
          Valider le match
        </button>
      </div>
      <div className="kbd-hint">
        <kbd>←</kbd> point gauche · <kbd>→</kbd> point droite · <kbd>Z</kbd> annuler · <kbd>Entrée</kbd> valider ·{' '}
        <kbd>Échap</kbd> fermer
      </div>
    </div>
  )
}
