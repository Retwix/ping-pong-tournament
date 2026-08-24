import { useState } from 'react'
import { IconBinaryTree2, IconChevronRight, IconLayoutList } from '@tabler/icons-react'
import { formatDuration } from '../lib/pingpong'
import {
  avancement,
  dureeTerminee,
  etatNoeud,
  groupesTableau,
  noeudsVisibles,
  nomAdversaire,
  type EtatNoeud,
} from '../lib/tournamentBoard'
import type { Match } from '../types'

interface Props {
  matches: Match[]
  onOpen: (id: string) => void
}

/** « Tableau » is the default view; « Liste » is the flat fallback. */
type ViewMode = 'tableau' | 'liste'

const MODIFIER: Record<EtatNoeud, string> = {
  Terminé: 'termine',
  'En cours': 'encours',
  Prêt: 'pret',
  'En attente': 'attente',
}

/** Only a match with both opponents known and no result yet can be scored. */
const estJouable = (etat: EtatNoeud): boolean => etat === 'Prêt' || etat === 'En cours'

/** A node shows a score once there is one to show. */
const montreScore = (etat: EtatNoeud): boolean => etat === 'Terminé' || etat === 'En cours'

function Noeud({ match, onOpen }: { match: Match; onOpen: (id: string) => void }) {
  const etat = etatNoeud(match)
  const jouable = estJouable(etat)
  const gagneA = match.done && match.score_a > match.score_b
  const gagneB = match.done && match.score_b > match.score_a
  const inconnuA = nomAdversaire(match.player_a) !== match.player_a
  const inconnuB = nomAdversaire(match.player_b) !== match.player_b

  return (
    <div
      className={`tb-noeud tb-noeud--${MODIFIER[etat]}${jouable ? ' tb-noeud--jouable' : ''}`}
      onClick={jouable ? () => onOpen(match.id) : undefined}
    >
      <div className="tb-noeud-ligne">
        <span
          className={`tb-noeud-nom${gagneB ? ' tb-noeud-nom--perdant' : ''}${
            inconnuA ? ' tb-noeud-nom--inconnu' : ''
          }`}
        >
          {nomAdversaire(match.player_a)}
        </span>
        <span className="tb-noeud-score">{montreScore(etat) ? match.score_a : ''}</span>
      </div>
      <div className="tb-noeud-ligne">
        <span
          className={`tb-noeud-nom${gagneA ? ' tb-noeud-nom--perdant' : ''}${
            inconnuB ? ' tb-noeud-nom--inconnu' : ''
          }`}
        >
          {nomAdversaire(match.player_b)}
        </span>
        <span className="tb-noeud-score">{montreScore(etat) ? match.score_b : ''}</span>
      </div>
      <div className="tb-noeud-etat">{etat}</div>
    </div>
  )
}

/** The right-hand note on a list row: how long it took, or what it waits for. */
function noteDeLigne(match: Match, etat: EtatNoeud): string {
  if (etat === 'En attente') return 'attend un résultat'
  const ms = dureeTerminee(match)
  return ms === null ? '' : formatDuration(ms)
}

function LigneNoeud({ match, onOpen }: { match: Match; onOpen: (id: string) => void }) {
  const etat = etatNoeud(match)
  const jouable = estJouable(etat)
  const gagneA = match.done && match.score_a > match.score_b
  const gagneB = match.done && match.score_b > match.score_a

  return (
    <div
      className={`tb-row tb-row--${MODIFIER[etat]}${jouable ? '' : ' tb-row--inerte'}`}
      onClick={jouable ? () => onOpen(match.id) : undefined}
    >
      <span className="tb-row-dot" />
      <span className="tb-row-etat tb-row-etat--large">{etat}</span>
      <span className={`tb-row-nom tb-row-nom--a${gagneB ? ' tb-row-nom--perdant' : ''}`}>
        {nomAdversaire(match.player_a)}
      </span>
      <span className="tb-row-score">
        {montreScore(etat) ? `${match.score_a} – ${match.score_b}` : '—'}
      </span>
      <span className={`tb-row-nom${gagneA ? ' tb-row-nom--perdant' : ''}`}>
        {nomAdversaire(match.player_b)}
      </span>
      <span className="tb-row-note">{noteDeLigne(match, etat)}</span>
      <IconChevronRight size={15} stroke={2} className="tb-row-chev" />
    </div>
  )
}

export default function BracketView({ matches, onOpen }: Props) {
  const [view, setView] = useState<ViewMode>('tableau')
  const { joues, total, ratio } = avancement(noeudsVisibles(matches))
  const groupes = groupesTableau(matches)

  return (
    <section className="tb-matchs">
      <div className="tb-sec-head">
        <h2 className="tb-sec-title">Le tableau</h2>
        <div className="tb-progress">
          <span className="tb-progress-track">
            <span className="tb-progress-fill" style={{ width: `${ratio * 100}%` }} />
          </span>
          <span className="tb-progress-count">
            {joues}/{total} joués
          </span>
        </div>
        <div className="tb-toggle">
          <button
            className={view === 'tableau' ? 'active' : ''}
            onClick={() => setView('tableau')}
            title="Vue tableau"
            aria-label="Vue tableau"
          >
            <IconBinaryTree2 size={17} stroke={1.8} />
          </button>
          <button
            className={view === 'liste' ? 'active' : ''}
            onClick={() => setView('liste')}
            title="Vue liste"
            aria-label="Vue liste"
          >
            <IconLayoutList size={17} stroke={1.8} />
          </button>
        </div>
      </div>

      {view === 'tableau' ? (
        <div className="tb-tableau">
          {groupes.map((groupe) => (
            <div key={groupe.groupe} className={`tb-groupe tb-groupe--${groupe.groupe}`}>
              <div className="tb-groupe-titre">{groupe.titre}</div>
              <div className="tb-colonnes">
                {groupe.colonnes.map((colonne) => (
                  <div key={colonne.titre} className="tb-colonne">
                    <div className="tb-colonne-titre">{colonne.titre}</div>
                    <div className="tb-colonne-corps">
                      {colonne.noeuds.map((match) => (
                        <Noeud key={match.id} match={match} onOpen={onOpen} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="tb-liste">
          {groupes.flatMap((groupe) =>
            groupe.colonnes.map((colonne) => (
              <div key={`${groupe.groupe}-${colonne.titre}`} className="tb-tour">
                <div className="tb-tour-head">{colonne.titre}</div>
                <div className="tb-tour-card">
                  {colonne.noeuds.map((match) => (
                    <LigneNoeud key={match.id} match={match} onOpen={onOpen} />
                  ))}
                </div>
              </div>
            )),
          )}
        </div>
      )}
    </section>
  )
}
