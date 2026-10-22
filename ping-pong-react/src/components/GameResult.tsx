import type { Match } from "../types";
import type { MatchRatings, SideRating } from "../hooks/useRatingDeltas";
import { winnerLoserRatings } from "../lib/ratingSides";
import type { LookUpPlayer } from "../lib/playerLookup";
import { signed } from "../lib/format";
import { setsByWinner } from "../lib/sets";
import { isCapot, winnerLoser } from "../lib/stats";
import Avatar from "./Avatar";
import CapotScreen from "./CapotScreen";
import Confetti from "./Confetti";

interface Props {
	match: Match;
	/** Sets in the match; above 1 the score reads as a set-by-set scoreboard. */
	bestOf: number;
	onReplay: () => void;
	onHome: () => void;
	/** Per-side rating move for this match (from the global ladder). */
	ratings?: MatchRatings;
	look: LookUpPlayer;
}

function EloStat({ side, tone }: { side: SideRating; tone: "up" | "down" }) {
	return (
		<div className="tk-stat">
			<div className={`tk-stat-value tk-stat-value--${tone}`}>{signed(side.delta)}</div>
			<div className="tk-stat-label">
				{side.name} · Élo {Math.round(side.ratingAfter)}
			</div>
		</div>
	);
}

/**
 * The end of a standalone 1v1 — now the only 1v1 result screen, on every surface.
 * A shutout hands over to the capot screen instead.
 */
export default function GameResult({ match, bestOf, onReplay, onHome, ratings, look }: Props) {
	const { winner, loser, ws: winnerScore, ls: loserScore } = winnerLoser(match);

	// 0-point loss → the office "sous la table" humiliation. Not for a match of
	// sets yet: capots in sets come with S5 (plans/2026-10-21-game-sets.md).
	if (bestOf === 1 && isCapot(match)) {
		return (
			<CapotScreen winner={winner} loser={loser} winnerScore={winnerScore} look={look}>
				<button className="tk-btn tk-btn--primary" onClick={onReplay}>
					Rejouer
				</button>
				<button className="tk-btn tk-btn--ghost" onClick={onHome}>
					Accueil
				</button>
			</CapotScreen>
		);
	}

	const { winner: rdWinner, loser: rdLoser } = winnerLoserRatings(ratings ?? { a: null, b: null });
	const board = setsByWinner(match);
	const winnerLook = look(winner);
	const loserLook = look(loser);

	return (
		<div className="takeover takeover--purple">
			<Confetti />
			<div className="tk-inner tk-inner--solo">
				<div className="tk-eyebrow">Partie terminée</div>
				<Avatar
					name={winner}
					team={winnerLook.team}
					url={winnerLook.url}
					className="tk-winner-av"
					fill="hero"
				/>
				<div className="tk-winner-name">{winner} gagne</div>

				{bestOf > 1 ? (
					<table className="tk-sets">
						<tbody>
							{[
								{ name: winner, points: board.winner },
								{ name: loser, points: board.loser },
							].map(({ name, points }) => (
								<tr key={name}>
									<th scope="row">{name}</th>
									{points.map((p, i) => (
										<td key={i}>{p}</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				) : (
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
							<span className="tk-score-dash">—</span>
							{loserScore}
						</div>
						<div className="tk-face-col tk-face-col--loser">
							<Avatar
								name={loser}
								team={loserLook.team}
								url={loserLook.url}
								className="tk-face"
								fill="solid"
							/>
							<div className="tk-face-name">{loser}</div>
						</div>
					</div>
				)}

				{(rdWinner || rdLoser) && (
					<div className="tk-pill">
						{rdWinner && <EloStat side={rdWinner} tone="up" />}
						{rdWinner && rdLoser && <div className="tk-pill-sep" />}
						{rdLoser && <EloStat side={rdLoser} tone="down" />}
					</div>
				)}

				<div className="tk-actions">
					<button className="tk-btn tk-btn--primary" onClick={onReplay}>
						Rejouer
					</button>
					<button className="tk-btn tk-btn--ghost" onClick={onHome}>
						Accueil
					</button>
				</div>
			</div>
		</div>
	);
}
