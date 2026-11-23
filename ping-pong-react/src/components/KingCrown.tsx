import { deltaTone } from '../lib/finalStandings'
import { signed } from '../lib/format'
import type { SessionResult, sessionCrown } from '../lib/king'
import type { LookUpPlayer } from '../lib/playerLookup'
import Avatar from './Avatar'
import Confetti from './Confetti'

interface Props {
  crown: ReturnType<typeof sessionCrown>
  results: ReadonlyArray<SessionResult>
  look: LookUpPlayer
  onClose: () => void
}

/** The end of a King of the Ping session: the longest reign, crowned, or nobody when no game was validated. */
export default function KingCrown({ crown, results, look, onClose }: Props) {
  return (
    <div className="takeover takeover--purple">
      {crown && <Confetti />}
      <div className="tk-inner tk-inner--solo">
        <div className="tk-eyebrow">King of the Ping · terminé</div>
        {crown && <Champion {...crown} look={look} />}
        {results.length > 0 && <SessionElo results={results} />}
        <div className="tk-actions">
          <button className="tk-btn tk-btn--ghost" onClick={onClose}>
            Accueil
          </button>
        </div>
      </div>
    </div>
  )
}

function Champion({ champion, games, look }: NonNullable<Props['crown']> & { look: LookUpPlayer }) {
  const { team, url } = look(champion.player)
  return (
    <section aria-label="le champion">
      <div className="tk-trophy">👑</div>
      <Avatar name={champion.player} team={team} url={url} className="tk-winner-av" fill="hero" />
      <div className="tk-winner-name">{champion.player}</div>
      <div className="tk-subline">
        {champion.wins} {champion.wins > 1 ? 'victoires' : 'victoire'} d’affilée · {games}{' '}
        {games > 1 ? 'parties' : 'partie'}
      </div>
    </section>
  )
}

function SessionElo({ results }: { results: ReadonlyArray<SessionResult> }) {
  return (
    <table className="kc-elo" aria-label="Élo de la session">
      <thead>
        <tr>
          <th scope="col">Joueur</th>
          <th scope="col">V–D</th>
          <th scope="col">Élo</th>
          <th scope="col">Δ</th>
        </tr>
      </thead>
      <tbody>
        {results.map((r) => (
          <tr key={r.name}>
            <th scope="row">{r.name}</th>
            <td>
              {r.wins}–{r.losses}
            </td>
            <td>{r.elo === null ? '—' : Math.round(r.elo)}</td>
            <td className={`kc-delta kc-delta--${deltaTone(r.eloDelta)}`}>
              {r.eloDelta === null ? '—' : signed(r.eloDelta)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
