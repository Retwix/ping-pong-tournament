import { useEffect, useRef, useState } from "react";
import { useTournament } from "../hooks/useTournament";
import { computeStandings } from "../lib/pingpong";
import type { Match } from "../types";
import LiveScorer from "./LiveScorer";
import Standings from "./Standings";
import ThemeToggle from "./ThemeToggle";

interface Props {
	id: string;
	onBack: () => void;
}

// How long a finished match stays on screen before the view advances to the next.
const HOLD_MS = 6000;

/** A match is "live" once it has been started or has at least one point. */
function isLive(m: Match): boolean {
	return !m.done && (m.score_a + m.score_b > 0 || !!m.started_at);
}

/**
 * Read-only spectator / TV view. It auto-follows whatever match is currently
 * being played — no tapping required — so a projector stays in sync with the
 * referee's device. When a match is validated it lingers briefly on the result,
 * then advances to the next match. Once every match is done it shows the final
 * standings and champion.
 */
export default function LiveView({ id, onBack }: Props) {
	const { tournament, matches, loading, error } = useTournament(id);
	const [shownId, setShownId] = useState<string | null>(null);

	// Always-current matches for use inside the deferred hold timer.
	const matchesRef = useRef<Match[]>([]);
	matchesRef.current = matches;
	const holdRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Decide which match to display whenever the synced data changes.
	useEffect(() => {
		if (!matches.length) return;
		// `matches` is kept sorted by idx in useTournament.
		const live = matches.find(isLive);
		if (live) {
			// A match is in progress: follow it and cancel any pending hold.
			if (holdRef.current) {
				clearTimeout(holdRef.current);
				holdRef.current = null;
			}
			setShownId(live.id);
			return;
		}
		// Nothing live. If a hold is already running, let its timer advance us.
		if (holdRef.current) return;
		const shown = matches.find((m) => m.id === shownId);
		if (shown && shown.done) {
			// We were showing a match that just finished — linger on the result.
			holdRef.current = setTimeout(() => {
				holdRef.current = null;
				const next = matchesRef.current.find((m) => !m.done);
				setShownId(next ? next.id : shown.id);
			}, HOLD_MS);
			return;
		}
		// Otherwise show the next unplayed match (or the last one if all done).
		const next = matches.find((m) => !m.done);
		setShownId(next ? next.id : matches[matches.length - 1].id);
	}, [matches, shownId]);

	// Clean up the hold timer on unmount.
	useEffect(
		() => () => {
			if (holdRef.current) clearTimeout(holdRef.current);
		},
		[]
	);

	if (loading) {
		return (
			<div className="wrap">
				<p className="empty">Chargement…</p>
			</div>
		);
	}
	if (!tournament) {
		return (
			<div className="wrap">
				<div className="error-banner">Tournoi introuvable.</div>
				<button className="link-btn" onClick={onBack}>
					← Tous les tournois
				</button>
			</div>
		);
	}

	// Tournament over: show the champion and final standings instead of a match.
	if (tournament.status === "done") {
		const champion =
			tournament.champion ??
			computeStandings(tournament.players, matches)[0]?.name ??
			"—";
		return (
			<div className="wrap">
				<header>
					<ThemeToggle className="header-toggle" />
					<div className="kicker">{tournament.name} · terminé</div>
					<h1>
						🏆 <span className="em">{champion}</span>
					</h1>
					<p className="subtitle">Classement final</p>
				</header>
				{error && <div className="error-banner">{error}</div>}
				<section>
					<Standings players={tournament.players} matches={matches} />
					<div className="footer-row">
						<button className="link-btn" onClick={onBack}>
							← Quitter le mode live
						</button>
					</div>
				</section>
			</div>
		);
	}

	const shownMatch = matches.find((m) => m.id === shownId) ?? null;

	if (!shownMatch) {
		return (
			<div className="wrap">
				<p className="empty">En attente du prochain match…</p>
				<button className="link-btn" onClick={onBack}>
					← Quitter le mode live
				</button>
			</div>
		);
	}

	return (
		<LiveScorer
			key={shownMatch.id}
			match={shownMatch}
			target={tournament.target}
			readOnly
			onClose={onBack}
		/>
	);
}
