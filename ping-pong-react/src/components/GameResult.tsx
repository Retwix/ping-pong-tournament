import type { Match } from "../types";
import { isCapot } from "../lib/stats";
import CapotScreen from "./CapotScreen";
import Confetti from "./Confetti";

interface Props {
	match: Match;
	onReplay: () => void;
	onHome: () => void;
}

export default function GameResult({ match, onReplay, onHome }: Props) {
	const aWin = match.score_a > match.score_b;
	const winner = aWin ? match.player_a : match.player_b;
	const loser = aWin ? match.player_b : match.player_a;
	const ws = aWin ? match.score_a : match.score_b;

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
		<div className="champion">
			<Confetti />
			<div className="champ-inner">
				<div className="champ-kicker">Partie terminée</div>
				<div className="champ-trophy">🏆</div>
				<div className="champ-name">{winner}</div>
				<div className="champ-sub">
					{match.player_a} <b>{match.score_a}</b> &ndash; <b>{match.score_b}</b>{" "}
					{match.player_b}
				</div>
				<div className="champ-actions">
					<button className="ghost" onClick={onReplay}>
						Rejouer
					</button>
					<button className="solid" onClick={onHome}>
						Accueil
					</button>
				</div>
			</div>
		</div>
	);
}
