import type { Match } from "../types";
import type { MatchRatings, SideRating } from "../hooks/useRatingDeltas";
import type { LookUpPlayer } from "../lib/playerLookup";
import { isCapot } from "../lib/stats";
import Avatar from "./Avatar";
import CapotScreen from "./CapotScreen";
import Confetti from "./Confetti";

interface Props {
	match: Match;
	onReplay: () => void;
	onHome: () => void;
	/** Per-side rating move for this match (from the global ladder). */
	ratings?: MatchRatings;
	look: LookUpPlayer;
}

function EloStat({ side, tone }: { side: SideRating; tone: "up" | "down" }) {
	const v = Math.round(side.delta);
	return (
		<div className="tk-stat">
			<div className={`tk-stat-value tk-stat-value--${tone}`}>
				{v === 0 ? "±0" : `${v > 0 ? "+" : "−"}${Math.abs(v)}`}
			</div>
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
export default function GameResult({ match, onReplay, onHome, ratings, look }: Props) {
	const aWin = match.score_a > match.score_b;
	const winner = aWin ? match.player_a : match.player_b;
	const loser = aWin ? match.player_b : match.player_a;
	const winnerScore = aWin ? match.score_a : match.score_b;
	const loserScore = aWin ? match.score_b : match.score_a;

	// 0-point loss → the office "sous la table" humiliation.
	if (isCapot(match)) {
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

	const rd = ratings ?? { a: null, b: null };
	const rdWinner = rd.a?.won ? rd.a : rd.b?.won ? rd.b : null;
	const rdLoser = rd.a && !rd.a.won ? rd.a : rd.b && !rd.b.won ? rd.b : null;
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
