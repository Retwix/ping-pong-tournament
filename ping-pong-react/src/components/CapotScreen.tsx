import type { ReactNode } from "react";
import type { LookUpPlayer } from "../lib/playerLookup";
import Avatar from "./Avatar";
import Confetti from "./Confetti";

const CAPOT_EMOJIS = ["💀", "😭", "🔥", "🏓"];

interface Props {
	winner: string;
	loser: string;
	winnerScore: number;
	look: LookUpPlayer;
	/** Action buttons rendered in the footer (varies by context). */
	children: ReactNode;
}

/**
 * The 0-point humiliation, shared by games and tournament matches. Deliberately
 * louder than the other takeovers — coral instead of purple, a shaking skull and
 * emoji rain — and the loser's avatar wears a dashed border as a "zéro pointé"
 * marker.
 */
export default function CapotScreen({ winner, loser, winnerScore, look, children }: Props) {
	const winnerLook = look(winner);
	const loserLook = look(loser);
	return (
		<div className="takeover takeover--coral">
			<Confetti emojis={CAPOT_EMOJIS} />
			<div className="tk-inner tk-inner--solo">
				<div className="tk-skull">💀</div>
				<div className="tk-capot-title">Balla di capot</div>

				<div className="tk-scoreline">
					<div className="tk-face-col">
						<Avatar
							name={winner}
							team={winnerLook.team}
							url={winnerLook.url}
							className="tk-face"
							fill="solid"
						/>
						<div className="tk-face-name">{winner}</div>
					</div>
					<div className="tk-score">
						{winnerScore}
						<span className="tk-score-dash">—</span>0
					</div>
					<div className="tk-face-col tk-face-col--loser">
						<Avatar
							name={loser}
							team={loserLook.team}
							url={loserLook.url}
							className="tk-face tk-face--zero"
							fill="solid"
						/>
						<div className="tk-face-name">{loser}</div>
					</div>
				</div>

				<p className="tk-capot-line">
					<b>{loser}</b> n'a pas marqué un seul point et passe sous la table. La honte est
					totale, le débrief sera long.
				</p>

				<div className="tk-actions">{children}</div>
			</div>
		</div>
	);
}
