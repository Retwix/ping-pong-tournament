import { bracketPodium } from "../lib/doubleElim";
import { computeStandings } from "../lib/pingpong";
import type { TournamentRating } from "../hooks/useRatingDeltas";
import type { Match, Tournament } from "../types";
import Celebration from "./Celebration";

interface Props {
	tournament: Tournament;
	matches: Match[];
	/** Net rating change per player over this tournament. */
	ratings?: TournamentRating[];
	onClose: () => void;
	onNew: () => void;
}

const MEDALS = ["🥇", "🥈", "🥉"];

/** A compact "+34" net-Élo tag for a podium row. */
function PodiumElo({ net }: { net: number }) {
	const v = Math.round(net);
	const dir = v > 0 ? "up" : v < 0 ? "down" : "flat";
	const txt = v === 0 ? "±0" : `${v > 0 ? "+" : "−"}${Math.abs(v)}`;
	return <span className={`pelo ${dir}`}>{txt}</span>;
}

export default function Champion({
	tournament,
	matches,
	ratings,
	onClose,
	onNew,
}: Props) {
	const isDouble = tournament.format === "double_elim";
	const netByName = new Map((ratings ?? []).map((r) => [r.name, r.netDelta]));

	// Double elimination: rank from the bracket result. Round-robin: from standings.
	const podium = isDouble
		? bracketPodium(matches).map((r) => ({
				name: r.name,
				sub: r.rank === 1 ? "Vainqueur" : "",
			}))
		: computeStandings(tournament.players, matches)
				.slice(0, 3)
				.map((s) => ({ name: s.name, sub: `${s.wins} V` }));

	const champ =
		podium[0] ??
		(tournament.champion ? { name: tournament.champion, sub: "" } : null);
	if (!champ) return null;

	const standings = isDouble
		? null
		: computeStandings(tournament.players, matches)[0];

	return (
		<Celebration
			headline="Tournoi terminé"
			winnerName={champ.name}
			subtitle={
				isDouble ? (
					"Champion · double élimination"
				) : standings ? (
					<>
						<b>{standings.wins}</b> victoires · différence{" "}
						<b>
							{standings.diff >= 0 ? "+" : ""}
							{standings.diff}
						</b>
					</>
				) : null
			}
			actions={
				<>
					<button className="ghost" onClick={onClose}>
						Revoir les résultats
					</button>
					<button className="solid" onClick={onNew}>
						Nouveau tournoi
					</button>
				</>
			}
		>
			<div className="champ-podium">
				{podium.slice(0, 3).map((s, i) => {
					const net = netByName.get(s.name);
					return (
						<div key={s.name} className={`prow p${i + 1}`}>
							<span className="who">
								<span className="medal">{MEDALS[i]}</span>
								{s.name}
							</span>
							<span className="pwins">{s.sub}</span>
							{net != null && <PodiumElo net={net} />}
						</div>
					);
				})}
			</div>
		</Celebration>
	);
}
