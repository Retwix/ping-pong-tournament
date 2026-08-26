import { IconX } from '@tabler/icons-react'
import { useEffect } from 'react'
import type { RatingExample } from '../lib/classement'
import { signed } from '../lib/format'
import { RATING } from '../lib/rating'

interface Props {
  example: RatingExample | null
  onClose: () => void
}

/**
 * « Le détail du calcul » — the design handoff's Elo modal (M1), with the copy
 * adapted to the real engine: weighted Elo, départ 1500, weights for margin and
 * stakes. The example block shows the latest real rated match, not seeds.
 */
export default function EloModal({ example, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal cl-elo-modal">
        <button className="pm-close" onClick={onClose} aria-label="Fermer">
          <IconX size={18} stroke={2} />
        </button>

        <h2 className="cl-elo-title">Le détail du calcul</h2>
        <p className="cl-elo-sub">Elo · départ {RATING.R0} · aucun ajustement manuel.</p>

        <div className="cl-elo-formula">
          <div className="cl-elo-label">La formule</div>
          <div className="cl-elo-formula-text">
            nouvelle note = note + poids × (résultat − attendu)
          </div>
          <p>
            « Attendu » est ta probabilité de gagner vue par le classement. Le poids grandit avec
            l'écart au score et l'enjeu du match.
          </p>
        </div>

        <ol className="cl-elo-steps">
          <li>
            <b>Départ à {RATING.R0}</b>
            <span>
              Chaque joueur commence à {RATING.R0}. Ce sont ensuite les résultats, et eux seuls, qui
              écartent la note de ce point de départ.
            </span>
          </li>
          <li>
            <b>La probabilité de victoire</b>
            <span>
              L'écart entre deux notes donne un résultat attendu. Battre plus fort que soi est
              improbable — donc très payant.
            </span>
          </li>
          <li>
            <b>Le transfert de points</b>
            <span>
              Le vainqueur prend des points au perdant : gains et pertes se répondent, rien ne se
              crée.
            </span>
          </li>
          <li>
            <b>La taille du gain</b>
            <span>
              Un 11–2 pèse plus qu'un 11–9 (jusqu'à ×{RATING.marginCap}), une finale ×
              {RATING.wFinal}, la grande finale ×{RATING.wGrandFinal}. Sous{' '}
              {RATING.provisionalGames} matchs, la note reste « provisoire » : trop peu de résultats
              pour te situer.
            </span>
          </li>
        </ol>

        {example && (
          <div className="cl-elo-example">
            <div className="cl-elo-label">Dernier match</div>
            <div className="cl-elo-ex-row">
              <div className="cl-elo-ex-tile">
                <b>{example.winner.name}</b>
                <span>{Math.round(example.winner.ratingBefore)} avant le match</span>
              </div>
              <span className="cl-elo-ex-verb">bat</span>
              <div className="cl-elo-ex-tile">
                <b>{example.loser.name}</b>
                <span>{Math.round(example.loser.ratingBefore)} avant le match</span>
              </div>
            </div>
            <div className="cl-elo-ex-result">
              <span className="win">
                {example.winner.name} {signed(example.winner.delta)} →{' '}
                {Math.round(example.winner.ratingAfter)}
              </span>
              <i />
              <span className="loss">
                {example.loser.name} {signed(example.loser.delta)} →{' '}
                {Math.round(example.loser.ratingAfter)}
              </span>
            </div>
          </div>
        )}

        <button className="cl-elo-ok" onClick={onClose}>
          Compris
        </button>
      </div>
    </div>
  )
}
