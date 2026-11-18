import type { Match } from '../types'
import { leaveTable, reignOf, type Rotation } from '../lib/king'
import type { LookUpPlayer } from '../lib/playerLookup'
import Avatar from './Avatar'
import KingFile from './KingFile'

interface Props {
  rotation: Rotation
  players: ReadonlyArray<string>
  matches: ReadonlyArray<Match>
  look: LookUpPlayer
  onNext: () => void
  onEnd: () => void
  onRotation: (rotation: Rotation) => void
}

/** Between two King of the Ping games: who holds the table, who challenges, who waits. */
export default function AuSuivant({
  rotation,
  players,
  matches,
  look,
  onNext,
  onEnd,
  onRotation,
}: Props) {
  const [king, prochain] = rotation
  const reign = reignOf(matches, king)
  const kingLook = look(king)
  const prochainLook = look(prochain)

  return (
    <div className="takeover takeover--purple">
      <div className="tk-inner tk-inner--solo">
        <div className="tk-eyebrow">Au suivant</div>

        <section className="ks-king" aria-label="le King">
          <Avatar
            name={king}
            team={kingLook.team}
            url={kingLook.url}
            className="tk-winner-av"
            fill="hero"
          />
          <div className="tk-winner-name">{king} 👑</div>
          <div className="ks-reign">
            Règne · {reign} {reign > 1 ? 'victoires' : 'victoire'} d’affilée
          </div>
        </section>

        <section className="ks-prochain" aria-label="Prochain">
          <div className="ks-label">Prochain</div>
          <Avatar
            name={prochain}
            team={prochainLook.team}
            url={prochainLook.url}
            className="tk-face"
            fill="solid"
          />
          <div className="tk-face-name">
            {prochain}
            <button
              className="ks-file-leave"
              aria-label={`Retirer ${prochain}`}
              onClick={() => onRotation(leaveTable(rotation, prochain))}
            >
              ✕
            </button>
          </div>
        </section>

        <KingFile rotation={rotation} players={players} onRotation={onRotation} />

        <div className="tk-actions">
          <button className="tk-btn tk-btn--primary" onClick={onNext}>
            Lancer la partie
          </button>
          <button className="tk-btn tk-btn--ghost" onClick={onEnd}>
            Terminer
          </button>
        </div>
      </div>
    </div>
  )
}
