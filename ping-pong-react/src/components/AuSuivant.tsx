import type { Match } from '../types'
import { leaveFile, reignOf, type Rotation } from '../lib/king'
import type { LookUpPlayer } from '../lib/playerLookup'
import Avatar from './Avatar'

interface Props {
  rotation: Rotation
  matches: ReadonlyArray<Match>
  look: LookUpPlayer
  onNext: () => void
  onEnd: () => void
  onRotation: (rotation: Rotation) => void
}

/** Between two King of the Ping games: who holds the table, who challenges, who waits. */
export default function AuSuivant({ rotation, matches, look, onNext, onEnd, onRotation }: Props) {
  const [king, prochain, ...file] = rotation
  const reign = reignOf(matches, king)
  const kingLook = look(king)
  const prochainLook = look(prochain)

  return (
    <div className="takeover takeover--purple">
      <div className="tk-inner tk-inner--solo">
        <div className="tk-eyebrow">Au suivant</div>

        <section className="ks-king" aria-label="le King">
          <Avatar name={king} team={kingLook.team} url={kingLook.url} className="tk-winner-av" fill="hero" />
          <div className="tk-winner-name">{king} 👑</div>
          <div className="ks-reign">
            Règne · {reign} {reign > 1 ? 'victoires' : 'victoire'} d’affilée
          </div>
        </section>

        <section className="ks-prochain" aria-label="Prochain">
          <div className="ks-label">Prochain</div>
          <Avatar name={prochain} team={prochainLook.team} url={prochainLook.url} className="tk-face" fill="solid" />
          <div className="tk-face-name">{prochain}</div>
        </section>

        {file.length > 0 && (
          <div className="ks-file">
            <div className="ks-label" id="ks-file-label">
              File
            </div>
            <ol aria-labelledby="ks-file-label">
              {file.map((name) => (
                <li key={name}>
                  {name}
                  <button
                    className="ks-file-leave"
                    aria-label={`Retirer ${name}`}
                    onClick={() => onRotation(leaveFile(rotation, name))}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ol>
          </div>
        )}

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
