import {
	IconArrowBackUp,
	IconArrowsLeftRight,
	IconCheck,
	IconChevronLeft,
	IconPingPong,
} from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import {
	decrementPatch,
	firstPointPatch,
	formatDuration,
	isMatchPoint,
	isWon,
	matchDuration,
	matchPointKind,
	serverIsA,
} from "../lib/pingpong";
import { playDing } from "../lib/sound";
import {
	activeChaosAt,
	applyScoreMutation,
	chaosWho,
	isScoreMutating,
	type ChaosSettings,
} from "../lib/chaos";
import type { Match, MatchSide } from "../types";
import type { SideElos } from "../lib/scorerElo";

interface Props {
	match: Match;
	target: number;
	onPatch?: (patch: Partial<Match>) => void;
	onClose?: () => void;
	onFinish?: () => void;
	/** Error from the last persistence attempt, surfaced so the referee sees it. */
	error?: string | null;
	/** Chaos Mode settings for this tournament; when enabled, drives the banner. */
	chaos?: ChaosSettings;
	/** Referee chrome: tournament title (desktop top bar / mobile meta bar). */
	tournamentName?: string;
	/** Referee chrome: subline under the title (e.g. "Round-robin"). */
	subtitle?: string;
	/** Current ladder Elo per side, for the pills next to the player names. */
	elos?: SideElos;
	/** Referee desktop: switch to the spectator/presentation view. */
	onPresent?: () => void;
}

const FLIP_KEY = "rv-score-flip";

export default function LiveScorer({
	match,
	target,
	onPatch,
	onClose,
	onFinish,
	error,
	chaos,
	tournamentName,
	subtitle,
	elos,
	onPresent,
}: Props) {
	// Per-session undo stack of [score_a, score_b, mb_saved_a, mb_saved_b] snapshots.
	const historyRef = useRef<[number, number, number, number][]>([]);
	// Last known serving side, to ding when the service switches.
	const prevServeRef = useRef<boolean | null>(null);
	// Last chaos interval-block seen, to cue when a fresh modifier rolls.
	const prevChaosBlockRef = useRef<number | null>(null);
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
	// Which chaos block's score-mutating legendary has already been applied, so
	// the "Appliquer" action fires at most once per roll.
	const [appliedChaosBlock, setAppliedChaosBlock] = useState<number | null>(null);

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

	// Chaos Mode — the active modifier is derived from the score, so it needs no
	// storage and is identical here, on /live, and after a refresh.
	const combined = match.score_a + match.score_b;
	const chaosOn = !!chaos && chaos.enabled && chaos.interval >= 1;
	const chaosActive = chaosOn && !won ? activeChaosAt(match.id, combined, chaos!) : null;
	const chaosBlock = chaosOn ? Math.floor(combined / chaos!.interval) : 0;
	const chaosWhoLabel =
		chaosActive && chaos
			? chaosWho(chaosActive, {
					matchId: match.id,
					combined,
					interval: chaos.interval,
					nameA: match.player_a,
					nameB: match.player_b,
					scoreA: match.score_a,
					scoreB: match.score_b,
				})
			: "";
	const chaosTierLabel: Record<string, string> = {
		malus: "Malus",
		bonus: "Bonus",
		neutral: "Chaos",
		legendary: "Légendaire",
	};

	const addPoint = (side: MatchSide) => {
		if (!onPatch) return;
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
		// The first point starts the chrono — and the match itself when it was
		// scored without ever being opened in referee mode.
		onPatch({ ...patch, ...firstPointPatch(match, new Date().toISOString()) });
	};
	const removePoint = (side: MatchSide) => {
		if (!onPatch) return;
		const patch = decrementPatch(match, side);
		if (!patch) return;
		historyRef.current.push([
			match.score_a,
			match.score_b,
			match.mb_saved_a ?? 0,
			match.mb_saved_b ?? 0,
		]);
		onPatch(patch);
	};
	const undo = () => {
		if (!onPatch) return;
		const prev = historyRef.current.pop();
		if (prev)
			onPatch({
				score_a: prev[0],
				score_b: prev[1],
				mb_saved_a: prev[2],
				mb_saved_b: prev[3],
			});
	};

	// Apply a score-mutating legendary (Heist / Wipeout / Mirror). Snapshots the
	// score first so it is undoable, and guards to once per interval-block.
	const applyChaosMutation = () => {
		if (!onPatch || !chaosActive) return;
		if (!isScoreMutating(chaosActive.modifier)) return;
		if (appliedChaosBlock === chaosBlock) return;
		const next = applyScoreMutation(chaosActive.modifier.id, {
			a: match.score_a,
			b: match.score_b,
		});
		if (!next) return;
		historyRef.current.push([
			match.score_a,
			match.score_b,
			match.mb_saved_a ?? 0,
			match.mb_saved_b ?? 0,
		]);
		setAppliedChaosBlock(chaosBlock);
		onPatch({ score_a: next.a, score_b: next.b });
	};
	const finish = () => {
		if (!onPatch) return;
		if (match.done) return;
		if (!isWon(match.score_a, match.score_b, target)) return;
		onPatch({ done: true, ended_at: new Date().toISOString() });
		onFinish?.();
	};
	const swapServe = () => {
		if (!onPatch) return;
		if (match.score_a + match.score_b === 0) {
			onPatch({ serve_start: match.serve_start === "a" ? "b" : "a" });
		}
	};

	// Visual order of the two panels (left → right / top → bottom).
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

	// Cue a fresh chaos roll (a new interval-block) with a double ding.
	useEffect(() => {
		if (!chaosOn || won || match.done) {
			prevChaosBlockRef.current = chaosBlock;
			return;
		}
		if (
			prevChaosBlockRef.current !== null &&
			chaosBlock > prevChaosBlockRef.current &&
			chaosBlock >= 1
		) {
			playDing();
			window.setTimeout(() => playDing(), 110);
		}
		prevChaosBlockRef.current = chaosBlock;
	}, [chaosBlock, chaosOn, won, match.done]);

	// Keyboard shortcuts. Left/Right follow the VISUAL order, not the player index.
	useEffect(() => {
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
				case "f":
				case "F":
					e.preventDefault();
					toggleFlip();
					break;
				case "s":
				case "S":
					e.preventDefault();
					swapServe();
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
		}
	> = {
		a: {
			name: match.player_a,
			score: match.score_a,
			serving: aServe,
			isWinner: aWon,
		},
		b: {
			name: match.player_b,
			score: match.score_b,
			serving: !won && !aServe,
			isWinner: bWon,
		},
	};

	const banners = (
		<>
			{error && <div className="error-banner ov-error">⚠️ {error}</div>}

			{chaosActive && (
				<div className={`chaos-banner chaos-${chaosActive.modifier.tier}`}>
					<span className="chaos-emoji">{chaosActive.modifier.emoji}</span>
					<span className="chaos-body">
						<span className="chaos-label">{chaosActive.modifier.label}</span>
						<span className="chaos-who">{chaosWhoLabel}</span>
					</span>
					<span className="chaos-tier">
						{chaosTierLabel[chaosActive.modifier.tier] ?? "Chaos"}
					</span>
					{isScoreMutating(chaosActive.modifier) &&
						appliedChaosBlock !== chaosBlock && (
							<button
								type="button"
								className="chaos-apply"
								onClick={applyChaosMutation}
							>
								Appliquer
							</button>
						)}
				</div>
			)}
		</>
	);

	// ===== Referee scorer (/ref, board modal): redesigned zones =====

	const clock = formatDuration(matchDuration(match));
	const canSwapServe = !match.done && match.score_a + match.score_b === 0;

	const renderZone = (side: MatchSide) => {
		const d = sideData[side];
		const oppScore = sideData[side === "a" ? "b" : "a"].score;
		const mpKind = matchPointKind(d.score, oppScore, target);
		const elo = elos?.[side] ?? null;
		return (
			<div
				key={side}
				className={`refzone refzone--${side}${d.serving ? " is-serving" : ""}${
					mpKind === "match" ? " is-matchpoint" : ""
				}${mpKind === "capot" ? " is-capot" : ""}${d.isWinner ? " is-winner" : ""}`}
				onClick={() => addPoint(side)}
			>
				{mpKind && (
					<div className="ref-mp-pill">
						● {mpKind === "capot" ? "BALLE DE CAPOT" : "BALLE DE MATCH"}
					</div>
				)}
				<div className="refzone-head">
					<span className="refzone-name">{d.name}</span>
					{elo !== null && (
						<span className="refzone-elo">
							{elo}
							<span className="refzone-elo-unit"> Elo</span>
						</span>
					)}
				</div>
				{d.serving && (
					<button
						className="refzone-serve"
						onClick={(e) => {
							e.stopPropagation();
							swapServe();
						}}
						disabled={!canSwapServe}
						aria-label={
							canSwapServe
								? "Au service — toucher pour échanger le service"
								: "Au service"
						}
						title={canSwapServe ? "Échanger le service (0–0)" : undefined}
					>
						<span className="refzone-serve-dot" />
						AU SERVICE
					</button>
				)}
				<div className="refzone-score">{d.score}</div>
				{mpKind && (
					<div className="refzone-caption">
						{mpKind === "capot"
							? "1 point pour le capot !"
							: "1 point pour gagner le match"}
					</div>
				)}
				{d.isWinner && (
					<div className="refzone-caption refzone-caption--win">Vainqueur 🏆</div>
				)}
				<button
					className="refzone-minus"
					disabled={d.score === 0 || match.done}
					onClick={(e) => {
						e.stopPropagation();
						removePoint(side);
					}}
					aria-label={`Retirer un point à ${d.name}`}
					title={`Retirer un point à ${d.name}`}
				>
					<span className="refzone-minus-sign">−</span>
					<span className="refzone-minus-short">1 point</span>
					<span className="refzone-minus-long">Retirer un point</span>
				</button>
			</div>
		);
	};

	return (
		<div className="refscorer">
			<div className="ref-topbar">
				<div className="ref-topbar-side">
					{onClose && (
						<button
							className="ref-back ref-back--bar"
							onClick={onClose}
							aria-label="Fermer"
							title="Fermer"
						>
							<IconChevronLeft size={22} stroke={2.2} />
						</button>
					)}
					<span className="ref-live-pill">
						<span className="ref-live-dot" />
						EN DIRECT
					</span>
					<div className="ref-topbar-title">
						<div className="ref-title">{tournamentName ?? "Tournoi ping-pong"}</div>
						<div className="ref-subtitle">
							{subtitle ? `${subtitle} · ` : ""}Jeu en {target}
						</div>
					</div>
				</div>
				<div className="ref-topbar-side">
					<div className="ref-chrono">
						<span className="ref-chrono-time">{clock}</span>
						<span className="ref-chrono-label">CHRONO</span>
					</div>
					{onPresent && (
						<button className="ref-present" onClick={onPresent}>
							Mode présentation
						</button>
					)}
				</div>
			</div>

			{onClose && (
				<button
					className="ref-back ref-back--float"
					onClick={onClose}
					aria-label="Fermer"
					title="Fermer"
				>
					<IconChevronLeft size={22} stroke={2.2} />
				</button>
			)}

			{(error || chaosActive) && <div className="ref-banners">{banners}</div>}

			<div className="ref-zones">
				{renderZone(order[0])}
				<div className="ref-meta">
					<div className="ref-chrono">
						<span className="ref-chrono-time">{clock}</span>
						<span className="ref-chrono-label">CHRONO</span>
					</div>
					<div className="ref-meta-center">
						<div className="ref-meta-title">Jeu en {target}</div>
						{tournamentName && (
							<div className="ref-meta-sub">{tournamentName}</div>
						)}
					</div>
				</div>
				<div className="ref-vs">VS</div>
				{renderZone(order[1])}
			</div>

			<div className="ref-dock">
				<button className="ref-dock-btn" onClick={undo}>
					<IconArrowBackUp size={20} stroke={2.2} />
					<span className="ref-dock-label">Annuler</span>
					<kbd>Z</kbd>
				</button>
				<button
					className={`ref-dock-btn${flipped ? " is-active" : ""}`}
					onClick={toggleFlip}
				>
					<IconArrowsLeftRight size={19} stroke={2.2} />
					<span className="ref-dock-label">
						Inverser<span className="ref-dock-label-ext"> les côtés</span>
					</span>
					<kbd>F</kbd>
				</button>
				{canSwapServe && (
					<button
						className="ref-dock-btn"
						onClick={swapServe}
						title="Changer le serveur (avant le premier point)"
					>
						<IconPingPong size={20} stroke={2.2} />
						<span className="ref-dock-label">Service</span>
						<kbd>S</kbd>
					</button>
				)}
				<button
					className="ref-dock-btn ref-dock-btn--primary"
					disabled={!won || match.done}
					onClick={finish}
				>
					<IconCheck size={20} stroke={2.6} />
					<span className="ref-dock-label">
						{match.done ? "Validé" : "Valider"}
						{!match.done && <span className="ref-dock-label-ext"> la partie</span>}
					</span>
					<kbd>Entrée</kbd>
				</button>
			</div>
		</div>
	);
}
