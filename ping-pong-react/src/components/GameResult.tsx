import type { Match } from "../types";
import type { MatchRatings, SideRating } from "../hooks/useRatingDeltas";
import { isCapot } from "../lib/stats";
import CapotScreen from "./CapotScreen";
import Celebration from "./Celebration";

interface Props {
	match: Match;
	onReplay: () => void;
	onHome: () => void;
	/** Per-side rating move for this match (from the global ladder). */
	ratings?: MatchRatings;
}

/** A compact "name +12" tag for one side's Élo change. */
function EloTag({ side }: { side: SideRating }) {
	const v = Math.round(side.delta);
	const dir = v > 0 ? "up" : v < 0 ? "down" : "flat";
	const txt = v === 0 ? "±0" : `${v > 0 ? "+" : "−"}${Math.abs(v)}`;
	return (
		<span className={`ce-item ${dir}`}>
			<span className="ce-name">{side.name}</span>
			<span className="ce-delta">{txt}</span>
		</span>
	);
}

export default function GameResult({ match, onReplay, onHome, ratings }: Props) {
	const aWin = match.score_a > match.score_b;
	const winner = aWin ? match.player_a : match.player_b;
	const loser = aWin ? match.player_b : match.player_a;
	const ws = aWin ? match.score_a : match.score_b;

	// Winner first, loser second — null until the rating replay has caught up.
	const rd = ratings ?? { a: null, b: null };
	const rdWinner = rd.a?.won ? rd.a : rd.b?.won ? rd.b : null;
	const rdLoser = rd.a && !rd.a.won ? rd.a : rd.b && !rd.b.won ? rd.b : null;
	const elo =
		rdWinner || rdLoser ? (
			<div className="champ-elo">
				{rdWinner && <EloTag side={rdWinner} />}
				{rdLoser && <EloTag side={rdLoser} />}
			</div>
		) : undefined;

	// 0-point loss → the office "sous la table" humiliation.
	if (isCapot(match)) {
		return (
			<CapotScreen winner={winner} loser={loser} winnerScore={ws}>
				<button className="ghost" onClick={onReplay}>
					Rejouer
				</button>
				<button className="solid" onClick={onHome}>
					Accueil
				</button>
			</CapotScreen>
		);
	}

	return (
		<Celebration
			headline="Partie terminée"
			winnerName={winner}
			subtitle={
				<>
					{match.player_a} <b>{match.score_a}</b> &ndash; <b>{match.score_b}</b>{" "}
					{match.player_b}
				</>
			}
			actions={
				<>
					<button className="ghost" onClick={onReplay}>
						Rejouer
					</button>
					<button className="solid" onClick={onHome}>
						Accueil
					</button>
				</>
			}
		>
			{elo}
		</Celebration>
	);
}
