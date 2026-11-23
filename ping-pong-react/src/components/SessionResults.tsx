import { deltaTone } from '../lib/finalStandings'
import { signed } from '../lib/format'
import type { SessionResult } from '../lib/king'

/** Each player's record over a King of the Ping session and, when it was ranked, the Élo it moved. */
export default function SessionResults({
  className,
  results,
  unranked,
}: {
  className: string
  results: ReadonlyArray<SessionResult>
  unranked: boolean
}) {
  return (
    <table className={className} aria-label="Résultats de la session">
      {unranked && <caption>Non classée : aucun Élo n’a bougé.</caption>}
      <thead>
        <tr>
          <th scope="col">Joueur</th>
          <th scope="col">V–D</th>
          {!unranked && (
            <>
              <th scope="col">Élo</th>
              <th scope="col">Δ</th>
            </>
          )}
        </tr>
      </thead>
      <tbody>
        {results.map((r) => (
          <tr key={r.name}>
            <th scope="row">{r.name}</th>
            <td>
              {r.wins}–{r.losses}
            </td>
            {!unranked && (
              <>
                <td>{r.elo === null ? '—' : Math.round(r.elo)}</td>
                <td className={`kc-delta kc-delta--${deltaTone(r.eloDelta)}`}>
                  {r.eloDelta === null ? '—' : signed(r.eloDelta)}
                </td>
              </>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
