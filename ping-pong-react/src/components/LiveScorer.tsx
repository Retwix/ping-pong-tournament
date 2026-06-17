import { IconArrowsLeftRight } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import {
	formatDuration,
	isMatchPoint,
	isWon,
	matchDuration,
	serverIsA,
} from "../lib/pingpong";
import { playDing } from "../lib/sound";
import type { Match, MatchSide } from "../types";

interface Props {
	match: Match;
	target: number;
	onPatch?: (patch: Partial<Match>) => void;
	onClose?: () => void;
	onFinish?: () => void;
	/** Spectator display: no tapping/keyboard/controls, just the live scoreboard. */
	readOnly?: boolean;
	/** Spectator-only: jump straight into referee mode for the same live match. */
	onRef?: () => void;
}

const FLIP_KEY = "rv-score-flip";

export default function LiveScorer({
	match,
	target,
	onPatch,
	onClose,
	onFinish,
	readOnly = false,
	onRef,
}: Props) {
	// Per-session undo stack of [score_a, score_b, mb_saved_a, mb_saved_b] snapshots.
	const historyRef = useRef<[number, number, number, number][]>([]);
	// Last known serving side, to ding when the service switches.
	const prevServeRef = useRef<boolean | null>(null);
	// Tick state purely to re-render the running clock.
	const [, forceTick] = useState(0);
	// Visual left/right swap (persisted) so the layout matches the physical table.
	const [flipped, setFlipped] = useState<boolean>(() => {
		try {
			return localStorage.getItem(FLIP_KEY) === "1";
		} catch {
			return false;
		}
	});

	const toggleFlip = () =>
		setFlipped((f) => {
			const next = !f;
			try {
				localStorage.setItem(FLIP_KEY, next ? "1" : "0");
			} catch {
				/* storage unavailable */
			}
			return next;
		});

	const won = isWon(match.score_a, match.score_b, target);
	const aWon = won && match.score_a > match.score_b;
	const bWon = won && match.score_b > match.score_a;
	const aServe = !won && serverIsA(match, target);
	const aMp = !won && isMatchPoint(true, match.score_a, match.score_b, target);
	const bMp = !won && isMatchPoint(false, match.score_a, match.score_b, target);

	const addPoint = (side: MatchSide) => {
		if (readOnly || !onPatch) return;
		if (isWon(match.score_a, match.score_b, target)) return;
		const savedA = match.mb_saved_a ?? 0;
		const savedB = match.mb_saved_b ?? 0;
		historyRef.current.push([match.score_a, match.score_b, savedA, savedB]);
		// Was the side that did NOT score one point away from winning? If so, the
		// scoring side just saved a match ball (and the opponent wasted one).
		const aWasMp = isMatchPoint(true, match.score_a, match.score_b, target);
		const bWasMp = isMatchPoint(false, match.score_a, match.score_b, target);
		const patch: Partial<Match> =
			side === "a"
				? { score_a: match.score_a + 1 }
				: { score_b: match.score_b + 1 };
		if (side === "a" && bWasMp) patch.mb_saved_a = savedA + 1;
		if (side === "b" && aWasMp) patch.mb_saved_b = savedB + 1;
		if (!match.started_at && match.score_a + match.score_b === 0) {
			patch.started_at = new Date().toISOString();
		}
		onPatch(patch);
	};
	const undo = () => {
		if (readOnly || !onPatch) return;
		const prev = historyRef.current.pop();
		if (prev)
			onPatch({
				score_a: prev[0],
				score_b: prev[1],
				mb_saved_a: prev[2],
				mb_saved_b: prev[3],
			});
	};
	const finish = () => {
		if (readOnly || !onPatch) return;
		if (!isWon(match.score_a, match.score_b, target)) return;
		onPatch({ done: true, ended_at: new Date().toISOString() });
		onFinish?.();
	};
	const swapServe = () => {
		if (readOnly || !onPatch) return;
		if (match.score_a + match.score_b === 0) {
			onPatch({ serve_start: match.serve_start === "a" ? "b" : "a" });
		}
	};

	// Visual order of the two panels (left → right).
	const order: MatchSide[] = flipped ? ["b", "a"] : ["a", "b"];

	// Running clock while the match is live.
	useEffect(() => {
		if (match.done) return;
		const id = setInterval(() => forceTick((n) => n + 1), 500);
		return () => clearInterval(id);
	}, [match.done]);

	// Small "ding" when the service switches between players.
	useEffect(() => {
		if (won || match.done) {
			prevServeRef.current = aServe;
			return;
		}
		if (prevServeRef.current !== null && prevServeRef.current !== aServe) {
			playDing();
		}
		prevServeRef.current = aServe;
	}, [aServe, won, match.done]);

	// Keyboard shortcuts. Left/Right follow the VISUAL order, not the player index.
	useEffect(() => {
		if (readOnly) return;
		const onKey = (e: KeyboardEvent) => {
			switch (e.key) {
				case "ArrowLeft":
					e.preventDefault();
					addPoint(order[0]);
					break;
				case "ArrowRight":
					e.preventDefault();
					addPoint(order[1]);
					break;
				case "z":
				case "Z":
				case "Backspace":
					e.preventDefault();
					undo();
					break;
				case "Enter":
					e.preventDefault();
					finish();
					break;
				case "Escape":
					e.preventDefault();
					onClose?.();
					break;
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

	const sideData: Record<
		MatchSide,
		{
			name: string;
			score: number;
			serving: boolean;
			isWinner: boolean;
			mpoint: boolean;
		}
	> = {
		a: {
			name: match.player_a,
			score: match.score_a,
			serving: aServe,
			isWinner: aWon,
			mpoint: aMp,
		},
		b: {
			name: match.player_b,
			score: match.score_b,
			serving: !won && !aServe,
			isWinner: bWon,
			mpoint: bMp,
		},
	};

	const renderSide = (side: MatchSide) => {
		const d = sideData[side];
		// A "capot" is a shutout: if this side is on match point while the
		// opponent is still on 0, the next point ends the game as a capot.
		const oppScore = sideData[side === "a" ? "b" : "a"].score;
		const flagText = d.mpoint && oppScore === 0 ? "Balla di capot" : "Balla di maccio";
		return (
			<div
				key={side}
				className={`side${d.serving ? " serving" : ""}${d.isWinner ? " winner" : ""}${d.mpoint ? " mpoint" : ""}`}
				onClick={() => addPoint(side)}
			>
				<span className="matchpoint-flag">{flagText}</span>
				<span className="side-name">
					<span className="serve-pip" />
					<span className="nm">{d.name}</span>
				</span>
				<span className="side-score">{d.score}</span>
				<span className="tap-hint">
					{d.isWinner ? "Vainqueur 🏆" : readOnly ? "" : "Tape pour +1"}
				</span>
			</div>
		);
	};

	return (
		<div className="overlay">
			<div className="ov-top">
				<div className="ov-left">
					{onClose && (
						<button
							className="ov-close"
							onClick={onClose}
							aria-label="Fermer"
							title="Fermer"
						>
							✕
						</button>
					)}
					<button
						className={`ov-close${flipped ? " active" : ""}`}
						onClick={toggleFlip}
						aria-label="Inverser les côtés"
						title="Inverser les côtés"
					>
						<IconArrowsLeftRight size={20} stroke={1.9} />
					</button>
					{readOnly && onRef && (
						<button
							className="ov-close ov-ref"
							onClick={onRef}
							aria-label="Passer en mode arbitre"
							title="Passer en mode arbitre"
						>
							🧑‍⚖️
						</button>
					)}
				</div>
				<span className="ov-timer">{formatDuration(matchDuration(match))}</span>
				<span className="ov-target">
					Jeu en {target} · {match.player_a} vs {match.player_b}
				</span>
			</div>

			<div className="scoreboard">{order.map(renderSide)}</div>

			{!readOnly && (
				<>
					<div className="ov-controls">
						<button onClick={undo}>↶ Annuler</button>
						<button onClick={swapServe}>🏓 Service</button>
						<button className="primary" disabled={!won} onClick={finish}>
							Valider le match
						</button>
					</div>
					<div className="kbd-hint">
						<kbd>←</kbd> point gauche · <kbd>→</kbd> point droite · <kbd>Z</kbd>{" "}
						annuler · <kbd>Entrée</kbd> valider · <kbd>Échap</kbd> fermer
					</div>
				</>
			)}
		</div>
	);
}
