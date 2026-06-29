import { useEffect, useRef, useState } from "react";
import { useTournament } from "../hooks/useTournament";
import { computeStandings } from "../lib/pingpong";
import { isPlayable } from "../lib/doubleElim";
import type { Match } from "../types";
import LiveScorer from "./LiveScorer";
import Standings from "./Standings";
import ThemeToggle from "./ThemeToggle";

interface Props {
	id: string;
	onBack: () => void;
	/**
	 * Spectator view (default) is read-only. Pass `readOnly={false}` for referee
	 * mode: the same auto-following scoreboard, but tappable and with controls.
	 */
	readOnly?: boolean;
	/** Spectator-only: jump from the live view straight into referee mode. */
	onRef?: () => void;
}

// How long a finished match stays on screen before the view advances to the next.
const HOLD_MS = 6000;

/** A match is "live" once it has been started or has at least one point. */
function isLive(m: Match): boolean {
	return !m.done && (m.score_a + m.score_b > 0 || !!m.started_at);
}

/**
 * Auto-follows whatever match is currently being played — no tapping required —
 * so a projector (or the referee on /ref) stays in sync. When a match is validated
 * it lingers briefly on the result, then advances to the next match. Once every
 * match is done it shows the final standings and champion.
 *
 * In spectator mode (default) it is read-only. In referee mode (`readOnly={false}`)
 * the same followed match is scorable.
 */
export default function LiveView({ id, onBack, readOnly = true, onRef }: Props) {
	// Only offer the "jump to ref" shortcut from the spectator view.
	const showRef = readOnly && !!onRef;
	// Referee mode is interactive; spectator mode auto-advances on a timer.
	const isRef = !readOnly;
	const { tournament, matches, loading, error, patchMatch } = useTournament(id);
	const [shownId, setShownId] = useState<string | null>(null);
	// Referee-only: after a match is validated we stop on an explicit "up next"
	// screen instead of auto-advancing, so the ref starts the next game when the
	// players are actually ready.
	const [awaitingNext, setAwaitingNext] = useState(false);

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
			if (awaitingNext) setAwaitingNext(false);
			setShownId(live.id);
			return;
		}
		const shown = matches.find((m) => m.id === shownId);
		if (shown && shown.done) {
			if (isRef) {
				// Referee mode: hold on the "up next" screen until the ref starts
				// the next game. No timer — the referee is in control.
				if (!awaitingNext) setAwaitingNext(true);
				return;
			}
			// Spectator mode: linger on the result, then auto-advance.
			if (holdRef.current) return;
			holdRef.current = setTimeout(() => {
				holdRef.current = null;
				const next = matchesRef.current.find(isPlayable);
				setShownId(next ? next.id : shown.id);
			}, HOLD_MS);
			return;
		}
		// Nothing live and nothing freshly finished: show the next playable match
		// (skips bracket matches still waiting on their players), or the last one.
		if (holdRef.current) return;
		const next = matches.find(isPlayable);
		setShownId(next ? next.id : matches[matches.length - 1].id);
	}, [matches, shownId, isRef, awaitingNext]);

	// Referee taps "Commencer": jump straight into the next playable match.
	const startNext = () => {
		const next = matchesRef.current.find(isPlayable);
		if (!next) return;
		if (holdRef.current) {
			clearTimeout(holdRef.current);
			holdRef.current = null;
		}
		setAwaitingNext(false);
		setShownId(next.id);
	};

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
						{showRef && (
							<button className="link-btn" onClick={onRef}>
								🧑‍⚖️ Mode arbitre
							</button>
						)}
						<button className="link-btn" onClick={onBack}>
							← Quitter le mode live
						</button>
					</div>
				</section>
			</div>
		);
	}

	// Referee "up next" interstitial: shown right after a match is validated, as
	// unmistakable confirmation, and to let the ref start the next game on cue.
	if (awaitingNext) {
		const finished = matches.find((m) => m.id === shownId) ?? null;
		const next = matches.find(isPlayable) ?? null;
		const winner = finished
			? finished.score_a > finished.score_b
				? finished.player_a
				: finished.player_b
			: null;
		return (
			<div className="wrap up-next">
				<header>
					<ThemeToggle className="header-toggle" />
					<div className="kicker">Mode arbitre</div>
					{winner && finished && (
						<p className="up-next-result">
							✅ <span className="em">{winner}</span> l'emporte{" "}
							{Math.max(finished.score_a, finished.score_b)}–
							{Math.min(finished.score_a, finished.score_b)}
						</p>
					)}
					<div className="up-next-label">À suivre</div>
					{next ? (
						<h1 className="up-next-match">
							<span className="em">{next.player_a}</span>
							<span className="vs"> vs </span>
							<span className="em">{next.player_b}</span>
						</h1>
					) : (
						<h1 className="up-next-match">En attente du prochain match…</h1>
					)}
				</header>
				{error && <div className="error-banner">⚠️ {error}</div>}
				<section>
					<button
						className="btn-primary up-next-start"
						disabled={!next}
						onClick={startNext}
					>
						▶ Commencer le match
					</button>
					<div className="footer-row">
						<button className="link-btn" onClick={onBack}>
							← Quitter le mode arbitre
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
				<div className="footer-row">
					{showRef && (
						<button className="link-btn" onClick={onRef}>
							🧑‍⚖️ Mode arbitre
						</button>
					)}
					<button className="link-btn" onClick={onBack}>
						← Quitter le mode live
					</button>
				</div>
			</div>
		);
	}

	return (
		<LiveScorer
			key={shownMatch.id}
			match={shownMatch}
			target={tournament.target}
			readOnly={readOnly}
			onPatch={
				readOnly ? undefined : (patch) => patchMatch(shownMatch.id, patch)
			}
			onClose={onBack}
			onRef={onRef}
			error={isRef ? error : null}
		/>
	);
}
