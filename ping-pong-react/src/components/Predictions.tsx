import { useTournamentPredictions } from '../hooks/useTournamentPredictions'
import {
  isChampionBettable,
  isMatchBettable,
  matchWinner,
  normalizeName,
} from '../lib/predictions'
import type { Match, Tournament } from '../types'

interface Props {
  tournament: Tournament
  matches: Match[]
  bettorName: string
  onNameChange: (name: string) => void
}

/** Horizontal A-vs-B crowd split bar. */
function CrowdBar({ a, b }: { a: number; b: number }) {
  const total = a + b
  const pctA = total ? Math.round((a / total) * 100) : 50
  return (
    <div className="prono-bar" title={`${a} vs ${b}`}>
      <div className="prono-fill a" style={{ width: `${total ? pctA : 50}%` }} />
      <div className="prono-fill b" style={{ width: `${total ? 100 - pctA : 50}%` }} />
    </div>
  )
}

/**
 * The pronostics (betting) panel for one tournament — the "no-currency streak" model.
 * Pick a name, then predict match winners and the eventual champion. No money, no
 * auth: a correct call just feeds your accuracy and win streak on the leaderboard.
 * You can't bet on a match you're playing in, and bets lock once a match starts.
 */
export default function Predictions({ tournament, matches, bettorName, onNameChange }: Props) {
  const { predictions, place, error } = useTournamentPredictions(tournament.id)
  const me = normalizeName(bettorName)

  const winnerBets = predictions.filter((p) => p.bet_type === 'winner')
  const champBets = predictions.filter((p) => p.bet_type === 'champion')

  const votesFor = (matchId: string, target: string) =>
    winnerBets.filter((p) => p.match_id === matchId && p.target === target).length
  const myWinnerPick = (matchId: string) =>
    winnerBets.find((p) => p.match_id === matchId && p.bettor_name === me)?.target ?? null
  const myChampPick = champBets.find((p) => p.bettor_name === me)?.target ?? null
  const champVotes = (name: string) => champBets.filter((p) => p.target === name).length

  const playingIn = (m: Match) => me !== '' && (m.player_a === me || m.player_b === me)

  const pick = async (
    matchId: string | null,
    betType: 'winner' | 'champion',
    target: string
  ) => {
    if (!me) return
    try {
      await place({
        bettorName: me,
        tournamentId: tournament.id,
        matchId,
        betType,
        target,
      })
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    }
  }

  // Show only matches worth a betting row: still bettable, in progress, or anything
  // people already bet on. Keeps this from duplicating the full schedule above.
  const isLive = (m: Match) => !m.done && (m.started_at || m.score_a > 0 || m.score_b > 0)
  const relevant = matches.filter(
    (m) => isMatchBettable(m) || isLive(m) || votesFor(m.id, m.player_a) + votesFor(m.id, m.player_b) > 0
  )

  const champOpen = isChampionBettable(tournament, matches)
  const totalBets = predictions.length

  return (
    <section>
      <div className="section-title">
        Pronostics
        {totalBets > 0 && <span className="count">{totalBets} paris</span>}
      </div>

      <div className="panel prono-panel">
        <div className="prono-id">
          <label className="prono-id-label" htmlFor="prono-name">
            Ton nom de parieur
          </label>
          <select
            id="prono-name"
            className="name-input"
            value={bettorName}
            onChange={(e) => onNameChange(e.target.value)}
          >
            <option value="">— Choisis ton nom —</option>
            {tournament.players.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <span className="hint">
            Pas de compte : choisis ton nom dans la liste, on te fait confiance. 🤝
          </span>
        </div>

        {error && <div className="error-banner">{error}</div>}
        {!me && (
          <p className="hint" style={{ marginTop: 4 }}>
            Entre un nom ci-dessus pour pouvoir parier.
          </p>
        )}

        {/* Champion futures */}
        {tournament.kind !== 'game' && (
          <div className="prono-block">
            <div className="prono-head">
              <span>🏆 Champion du tournoi</span>
              {!champOpen && <span className="prono-locked">verrouillé</span>}
            </div>
            {champOpen ? (
              <div className="chip-row">
                {tournament.players.map((name) => {
                  const mine = myChampPick === name
                  const v = champVotes(name)
                  return (
                    <button
                      key={name}
                      className={`chip${mine ? ' selected' : ''}`}
                      disabled={!me}
                      onClick={() => pick(null, 'champion', name)}
                    >
                      {name}
                      {v > 0 && <span className="prono-tally">{v}</span>}
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="hint">
                {myChampPick
                  ? `Ton champion : ${myChampPick}.`
                  : 'Le tournoi a commencé — trop tard pour parier sur le champion.'}
              </p>
            )}
          </div>
        )}

        {/* Match winners */}
        <div className="prono-block">
          <div className="prono-head">
            <span>🎯 Vainqueur des matchs</span>
          </div>
          {relevant.length === 0 ? (
            <p className="hint">Aucun match à pronostiquer pour l'instant.</p>
          ) : (
            relevant.map((m) => {
              const bettable = isMatchBettable(m)
              const mine = myWinnerPick(m.id)
              const va = votesFor(m.id, m.player_a)
              const vb = votesFor(m.id, m.player_b)
              const mePlays = playingIn(m)
              const winner = m.done ? matchWinner(m) : null

              const sideBtn = (player: string) => {
                const picked = mine === player
                const won = m.done && winner === player
                const lost = m.done && winner !== player
                return (
                  <button
                    key={player}
                    className={`chip prono-side${picked ? ' selected' : ''}${
                      won ? ' won' : ''
                    }${lost ? ' lost' : ''}`}
                    disabled={!me || !bettable || mePlays}
                    onClick={() => pick(m.id, 'winner', player)}
                  >
                    {player}
                    {picked && <span className="prono-you">toi</span>}
                  </button>
                )
              }

              return (
                <div className="prono-match" key={m.id}>
                  <div className="prono-match-top">
                    <span className="prono-round">T{m.round}</span>
                    {bettable ? (
                      mePlays ? (
                        <span className="prono-locked">tu joues ce match</span>
                      ) : (
                        <span className="prono-open">ouvert</span>
                      )
                    ) : m.done ? (
                      <span className="prono-result">
                        ✓ {winner} {m.score_a > m.score_b ? `${m.score_a}–${m.score_b}` : `${m.score_b}–${m.score_a}`}
                      </span>
                    ) : (
                      <span className="prono-locked">verrouillé</span>
                    )}
                  </div>
                  <div className="prono-sides">
                    {sideBtn(m.player_a)}
                    {sideBtn(m.player_b)}
                  </div>
                  {va + vb > 0 && (
                    <div className="prono-split">
                      <span className="prono-pct">{va}</span>
                      <CrowdBar a={va} b={vb} />
                      <span className="prono-pct">{vb}</span>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </section>
  )
}
