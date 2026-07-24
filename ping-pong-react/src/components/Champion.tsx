import { finalStandings, type FinalStandingRow } from "../lib/finalStandings";
import { signed } from "../lib/format";
import type { LookUpPlayer } from "../lib/playerLookup";
import type { TournamentRating } from "../hooks/useRatingDeltas";
import type { Match, Tournament } from "../types";
import Avatar from "./Avatar";
import Confetti from "./Confetti";
import FinalStandingsCard from "./FinalStandingsCard";

interface Props {
	tournament: Tournament;
	matches: Match[];
	/** Net rating change per player over this tournament. */
	ratings?: TournamentRating[];
	look: LookUpPlayer;
	onClose: () => void;
	onNew: () => void;
}

/** Podium steps, tallest in the middle: silver, gold, bronze. */
const PODIUM_ORDER = [1, 0, 2];

function Podium({ rows, look }: { rows: FinalStandingRow[]; look: LookUpPlayer }) {
	// Only ever as many steps as there are players — never an empty placeholder.
	const steps = PODIUM_ORDER.filter((i) => i < rows.length);
	return (
		<div className="tk-podium">
			{steps.map((i) => {
				const row = rows[i];
				if (row === undefined) return null;
				const { team, url } = look(row.name);
				return (
					<div key={row.name} className={`pod pod--${row.place}`}>
						<Avatar
							name={row.name}
							team={team}
							url={url}
							className={`pod-av pod-av--${row.place}`}
							fill={row.place === 1 ? "hero" : "solid"}
						/>
						<div className="pod-bar">{row.place}</div>
					</div>
				);
			})}
		</div>
	);
}

/**
 * End of a tournament: the champion, the podium, and the full final classement so
 * everyone can see where they finished. Rendered as a fixed dark takeover in both
 * themes — a celebratory interruption rather than part of the themed UI.
 */
export default function Champion({ tournament, matches, ratings, look, onClose, onNew }: Props) {
	const rows = finalStandings({
		players: tournament.players,
		matches,
		format: tournament.format,
		ratings,
	});
	const champ = rows[0];
	if (champ === undefined) return null;

	const { team, url } = look(champ.name);
	const record = `${champ.wins} victoire${champ.wins > 1 ? "s" : ""}, ${champ.losses} défaite${
		champ.losses > 1 ? "s" : ""
	}`;
	const delta = champ.eloDelta;

	return (
		<div className="takeover takeover--purple">
			<Confetti />
			<div className="tk-inner tk-inner--split">
				<div className="tk-hero">
					<div className="tk-eyebrow">{tournament.name} · terminé</div>
					<div className="tk-trophy">🏆</div>
					<Avatar name={champ.name} team={team} url={url} className="tk-winner-av" fill="hero" />
					<div className="tk-winner-name">{champ.name}</div>
					<div className="tk-subline">
						{champ.losses === 0 ? "invaincu" : "remporte le tournoi"} · {record}
					</div>
					{champ.elo !== null && (
						<div className="tk-pill">
							<div className="tk-stat">
								<div className="tk-stat-value">{Math.round(champ.elo)}</div>
								<div className="tk-stat-label">Élo final</div>
							</div>
							<div className="tk-pill-sep" />
							<div className="tk-stat">
								<div className="tk-stat-value tk-stat-value--up">
									{signed(delta ?? 0)}
								</div>
								<div className="tk-stat-label">Sur le tournoi</div>
							</div>
						</div>
					)}
					<Podium rows={rows} look={look} />
				</div>

				<div className="tk-side">
					<FinalStandingsCard
						rows={rows}
						format={tournament.format}
						look={look}
						actions={
							<>
								<button className="tk-btn tk-btn--ghost" onClick={onClose}>
									Revoir les résultats
								</button>
								<button className="tk-btn tk-btn--primary" onClick={onNew}>
									Nouveau tournoi
								</button>
							</>
						}
					/>
				</div>
			</div>
		</div>
	);
}
