import type { ReactNode } from 'react'
import Confetti from './Confetti'

const CAPOT_EMOJIS = ['🪑', '🏓', '0️⃣', '🙈', '😵']

interface Props {
  winner: string
  loser: string
  winnerScore: number
  /** Action buttons rendered in the footer (varies by context). */
  children: ReactNode
}

/** The cheesy 0-point "sous la table" celebration, shared by games and tournaments. */
export default function CapotScreen({ winner, loser, winnerScore, children }: Props) {
  return (
    <div className="champion capot">
      <Confetti emojis={CAPOT_EMOJIS} />
      <div className="champ-inner">
        <div className="champ-kicker capot-kick">Capot · humiliation totale</div>
        <div className="champ-trophy">🪑</div>
        <div className="champ-name capot-title">Sous la table&nbsp;!</div>
        <div className="capot-loser">
          <span className="under">{loser}</span> passe sous la table
        </div>
        <div className="champ-sub">
          {winner} <b>{winnerScore}</b> &ndash; <b>0</b> · capot infligé 🫣
        </div>
        <div className="champ-actions">{children}</div>
      </div>
    </div>
  )
}
