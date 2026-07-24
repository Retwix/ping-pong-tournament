import { IconCrown, IconX } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import type { MatchRatings } from "../hooks/useRatingDeltas";
import { useTournamentPredictions } from "../hooks/useTournamentPredictions";
import { isPlayable } from "../lib/doubleElim";
import {
	computeStandings,
	formatDuration,
	isWon,
	matchDuration,
	matchPointKind,
	serverIsA,
} from "../lib/pingpong";
import type { RatingRow } from "../lib/rating";
import { sideElos } from "../lib/scorerElo";
import { playerInitials } from "../lib/avatar";
import { crowdSplit, ladderAvatar, matchStakes, showsLiveBoard } from "../lib/spectator";
import type { Match, MatchSide, Tournament } from "../types";
import ThemeToggle from "./ThemeToggle";

interface Props {
	tournament: Tournament;
	matches: Match[];
	/** The match the auto-follow logic points at — may not have started yet. */
	match: Match | null;
	/** Global ladder rows, for Elo pills, stakes projections and the podium. */
	rows: RatingRow[];
	/** Real rating moves for a finished match (replaces the live projection). */
	ratingsFor: (m: Match | null | undefined) => MatchRatings;
	onBack: () => void;
	onRef?: () => void;
	error?: string | null;
}

// How long the "next up" card is shown before the board is revealed anyway.
const REVEAL_SECONDS = 5;

/** Signed Elo with a real minus sign, e.g. +18 / −15. */
function signed(n: number): string {
	return n < 0 ? `−${Math.abs(n)}` : `+${n}`;
}

/**
 * TV avatar: the player's photo when the ladder has one, otherwise the
 * monogram — keeping the side's gradient look. Broken images fall back to
 * the monogram (brokenUrl resets by itself when the url changes).
 */
function TvAvatar({
	className,
	name,
	url,
}: {
	className: string;
	name: string;
	url: string | null;
}) {
	const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
	const showPhoto = url !== null && url !== brokenUrl;
	return (
		<div className={className}>
			{showPhoto ? (
				<img src={url} alt="" onError={() => setBrokenUrl(url)} />
			) : (
				playerInitials(name)
			)}
		</div>
	);
}

/**
 * TV spectator view (/live): giant auto-following scoreboard for a projector,
 * restacking to a portrait layout on phones. Shows the match in progress with
 * serving emphasis, Elo stakes and the crowd's bets; a "next match" card
 * between matches; the podium once the tournament is over.
 */
export default function SpectatorView({
	tournament,
	matches,
	match,
	rows,
	ratingsFor,
	onBack,
	onRef,
	error,
}: Props) {
	const { predictions } = useTournamentPredictions(tournament.id);
	// Tick state purely to re-render the running clock.
	const [, forceTick] = useState(0);
	// The board is a passive mirror, so a fresh 0–0 match would otherwise sit on
	// the "next up" card forever. After a short countdown we reveal its board
	// anyway — the house always opens with a serve-deciding point regardless.
	const [revealedId, setRevealedId] = useState<string | null>(null);
	const [secondsLeft, setSecondsLeft] = useState(REVEAL_SECONDS);

	const target = tournament.target;
	const over = tournament.status === "done";
	const showLive = showsLiveBoard(match, revealedId);
	// Arm the reveal only while a followed match is still waiting to be shown.
	const armId = !showLive && !over && match ? match.id : null;

	useEffect(() => {
		if (armId === null) return;
		setSecondsLeft(REVEAL_SECONDS);
		const start = Date.now();
		const timer = setInterval(() => {
			const left = REVEAL_SECONDS - Math.floor((Date.now() - start) / 1000);
			if (left <= 0) {
				setRevealedId(armId);
				clearInterval(timer);
			} else {
				setSecondsLeft(left);
			}
		}, 250);
		return () => clearInterval(timer);
	}, [armId]);

	useEffect(() => {
		if (!showLive || match?.done) return;
		const id = setInterval(() => forceTick((n) => n + 1), 500);
		return () => clearInterval(id);
	}, [showLive, match?.done, match?.id]);

	const formatLabel =
		tournament.format === "double_elim"
			? "Élimination directe"
			: tournament.kind === "game"
				? "Partie rapide"
				: "Round-robin";
	const eloByName = new Map(rows.map((r) => [r.name, Math.round(r.rating)]));

	const chrome = (
		<div className="tv-chrome">
			<ThemeToggle />
			{onRef && (
				<button className="tv-chrome-btn" onClick={onRef}>
					Arbitre
				</button>
			)}
			<button
				className="tv-chrome-btn tv-chrome-btn--icon"
				onClick={onBack}
				aria-label="Quitter le mode live"
				title="Quitter le mode live"
			>
				<IconX size={16} stroke={2.2} />
			</button>
		</div>
	);

	const banner = error ? <div className="error-banner tv-error">⚠️ {error}</div> : null;

	const podiumCard = (label: string) => {
		const top = computeStandings(tournament.players, matches)
			.slice(0, 3)
			.map((s, i) => ({ ...s, rank: i + 1, elo: eloByName.get(s.name) ?? null }));
		// Visual order: 2nd — 1st — 3rd.
		const columns = [top[1], top[0], top[2]].filter(Boolean);
		return (
			<div className="tv-podium">
				<div className="tv-podium-label">{label}</div>
				<div className="tv-podium-title">Le podium</div>
				<div className="tv-podium-steps">
					{columns.map((p) => (
						<div key={p.name} className={`tv-step tv-step--${p.rank}`}>
							{p.rank === 1 && (
								<IconCrown className="tv-step-crown" size={30} stroke={1.6} />
							)}
							<TvAvatar
								className="tv-step-avatar"
								name={p.name}
								url={ladderAvatar(rows, null, p.name)}
							/>
							<div className="tv-step-name">{p.name}</div>
							{p.elo !== null && <div className="tv-step-elo">{p.elo} Elo</div>}
							<div className="tv-step-bar">{p.rank}</div>
						</div>
					))}
				</div>
			</div>
		);
	};

	// ===== Tournament over: the podium =====

	if (over) {
		return (
			<div className="tv tv--panels">
				{chrome}
				{banner}
				<div className="tv-panels">{podiumCard(`${tournament.name} — terminé`)}</div>
			</div>
		);
	}

	// ===== Between matches: next match interstitial =====

	if (!showLive) {
		const next = match ?? matches.find(isPlayable) ?? null;
		const nextElos = next ? sideElos(rows, next) : null;
		const nextStakes = next ? matchStakes(rows, next, target) : null;
		const stakeLine = nextStakes
			? `${signed(Math.max(nextStakes.a, nextStakes.b))} / ${signed(Math.min(nextStakes.a, nextStakes.b))}`
			: null;
		const hasResults = matches.some((m) => m.done && !m.bye);
		return (
			<div className="tv tv--panels">
				{chrome}
				{banner}
				<div className="tv-panels">
					<div className="tv-next">
						{next ? (
							<>
								<div className="tv-next-label">Prochain match · À suivre</div>
								<div className="tv-next-players">
									<div className="tv-next-player">
										<TvAvatar
											className="tv-avatar tv-avatar--a"
											name={next.player_a}
											url={ladderAvatar(rows, next.player_a_id, next.player_a)}
										/>
										<div className="tv-next-name">{next.player_a}</div>
										{nextElos?.a != null && (
											<div className="tv-next-elo">{nextElos.a} Elo</div>
										)}
									</div>
									<div className="tv-next-vs">VS</div>
									<div className="tv-next-player">
										<TvAvatar
											className="tv-avatar tv-avatar--b"
											name={next.player_b}
											url={ladderAvatar(rows, next.player_b_id, next.player_b)}
										/>
										<div className="tv-next-name">{next.player_b}</div>
										{nextElos?.b != null && (
											<div className="tv-next-elo">{nextElos.b} Elo</div>
										)}
									</div>
								</div>
								<div className="tv-next-chip">
									{stakeLine && (
										<div className="tv-next-stat">
											<div className="tv-next-stat-value tv-next-stat-value--gain">
												{stakeLine}
											</div>
											<div className="tv-next-stat-label">Enjeu Elo</div>
										</div>
									)}
									<div className="tv-next-stat">
										<div className="tv-next-stat-value">Jeu en {target}</div>
										<div className="tv-next-stat-label">Format</div>
									</div>
								</div>
								{armId && (
									<div className="tv-next-countdown">
										Le match commence dans <span className="tv-next-count">{secondsLeft}</span> s
									</div>
								)}
								<div className="tv-next-foot">
									{tournament.name} · {formatLabel}
								</div>
							</>
						) : (
							<div className="tv-next-label">En attente du prochain match…</div>
						)}
					</div>
					{hasResults && podiumCard("Classement du tournoi")}
				</div>
			</div>
		);
	}

	// ===== Live match =====

	const m = match!;
	const won = isWon(m.score_a, m.score_b, target);
	const aServe = !won && !m.done && serverIsA(m, target);
	const elos = sideElos(rows, m);
	const stakes = matchStakes(rows, m, target);
	const real = m.done ? ratingsFor(m) : { a: null, b: null };
	const split = crowdSplit(predictions, m);
	const clock = formatDuration(matchDuration(m));

	const sides: Record<
		MatchSide,
		{ name: string; score: number; serving: boolean; winner: boolean }
	> = {
		a: {
			name: m.player_a,
			score: m.score_a,
			serving: aServe,
			winner: won && m.score_a > m.score_b,
		},
		b: {
			name: m.player_b,
			score: m.score_b,
			serving: !won && !m.done && !aServe,
			winner: won && m.score_b > m.score_a,
		},
	};

	const renderPlayer = (side: MatchSide) => {
		const d = sides[side];
		const elo = elos[side];
		const realSide = real[side];
		const stake = stakes?.[side] ?? null;
		const delta = realSide ? Math.round(realSide.delta) : stake;
		const opp = sides[side === "a" ? "b" : "a"];
		// House terms: one point from winning = "Balla di maccio"; one point
		// from a shutout win = "Balla di capot".
		const mp = matchPointKind(d.score, opp.score, target);
		return (
			<div
				className={`tv-player tv-player--${side}${d.serving ? " is-serving" : ""}${
					d.winner ? " is-winner" : ""
				}`}
			>
				{mp && (
					<div className={`tv-mp-flag${mp === "capot" ? " tv-mp-flag--capot" : ""}`}>
						{mp === "capot" ? "Balla di capot" : "Balla di maccio"}
					</div>
				)}
				{d.serving ? (
					<div className="tv-serve-pill">
						<span className="tv-serve-ball" />
						Au service
					</div>
				) : d.winner ? (
					<div className="tv-win-pill">Vainqueur</div>
				) : (
					<div className="tv-pill-spacer" />
				)}
				<TvAvatar
					className={`tv-avatar tv-avatar--${side}`}
					name={d.name}
					url={ladderAvatar(
						rows,
						side === "a" ? m.player_a_id : m.player_b_id,
						d.name,
					)}
				/>
				<div className="tv-name">{d.name}</div>
				<div className="tv-meta">
					{elo !== null && <span>{elo} Elo</span>}
					{elo !== null && delta !== null && <span> · </span>}
					{delta !== null && (
						<span className={delta >= 0 ? "tv-gain" : "tv-loss"}>
							{signed(delta)}
							{realSide ? "" : " en jeu"}
						</span>
					)}
				</div>
				<div className="tv-score">{d.score}</div>
			</div>
		);
	};

	return (
		<div className="tv tv--live">
			{chrome}
			{banner}
			<div className="tv-top">
				<div className="tv-top-left">
					<span className="tv-live-pill">
						<span className="tv-live-dot" />
						En direct
					</span>
					<span className="tv-top-title">
						{tournament.name} · {formatLabel}
					</span>
				</div>
				<div className="tv-clock">
					<div className="tv-clock-time">{clock}</div>
					<div className="tv-clock-label">Jeu en {target} points</div>
				</div>
			</div>
			<div className="tv-match">
				{renderPlayer("a")}
				<div className="tv-divider" />
				{renderPlayer("b")}
			</div>
			<div className="tv-poll">
				{split && (
					<>
						<div className="tv-poll-row">
							<span>Le public parie</span>
						</div>
						<div className="tv-poll-bar">
							{split.aPercent > 0 && (
								<div className="tv-poll-a" style={{ width: `${split.aPercent}%` }}>
									{split.aPercent >= 15 && (
										<span>
											{split.aPercent}%
											<span className="tv-poll-name"> {sides.a.name}</span>
										</span>
									)}
								</div>
							)}
							{split.bPercent > 0 && (
								<div className="tv-poll-b" style={{ width: `${split.bPercent}%` }}>
									{split.bPercent >= 15 && (
										<span>
											{split.bPercent}%
											<span className="tv-poll-name"> {sides.b.name}</span>
										</span>
									)}
								</div>
							)}
						</div>
					</>
				)}
			</div>
		</div>
	);
}
