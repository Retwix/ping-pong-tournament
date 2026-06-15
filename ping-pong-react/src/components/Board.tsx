import { useState } from "react";
import { useTournament } from "../hooks/useTournament";
import { createTournament } from "../lib/db";
import { isCapot } from "../lib/stats";
import type { Match } from "../types";
import CapotScreen from "./CapotScreen";
import Champion from "./Champion";
import GameResult from "./GameResult";
import LiveScorer from "./LiveScorer";
import MatchList from "./MatchList";
import Standings from "./Standings";
import ThemeToggle from "./ThemeToggle";
import TopBack from "./TopBack";

interface Props {
	id: string;
	onBack: () => void;
	onNew: () => void;
	onOpen: (id: string) => void;
}

export default function Board({ id, onBack, onNew, onOpen }: Props) {
	const { tournament, matches, loading, error, patchMatch } = useTournament(id);
	const [openId, setOpenId] = useState<string | null>(null);
	const [dismissedChampion, setDismissedChampion] = useState(false);
	const [capotMatch, setCapotMatch] = useState<Match | null>(null);

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

	// A "game" is a single match: skip standings/champion. Show the scorer while it's
	// being played, then a result screen once the match is validated.
	if (tournament.kind === "game") {
		const match = matches[0];
		if (!match) {
			return (
				<div className="wrap">
					<p className="empty">Chargement…</p>
				</div>
			);
		}
		if (match.done) {
			// Rematch = a brand-new game with the same players, so the finished one
			// stays in history/stats instead of being overwritten.
			const rematch = async () => {
				const newId = await createTournament(
					tournament.name,
					tournament.players,
					tournament.target,
					"game"
				);
				onOpen(newId);
			};
			return <GameResult match={match} onReplay={rematch} onHome={onBack} />;
		}
		return (
			<LiveScorer
				match={match}
				target={tournament.target}
				onPatch={(patch) => patchMatch(match.id, patch)}
				onClose={onBack}
				onFinish={() => {
					/* match.done flips via the patch above, which renders GameResult */
				}}
			/>
		);
	}

	const openMatch = matches.find((m) => m.id === openId) ?? null;
	// Capot celebration takes precedence over the champion screen, so they don't stack.
	const showChampion =
		tournament.status === "done" && !dismissedChampion && !capotMatch;

	const copyLink = async () => {
		try {
			await navigator.clipboard.writeText(window.location.href);
		} catch {
			/* clipboard unavailable */
		}
	};
	return (
		<div className="wrap">
			<TopBack onClick={onBack} label="Tous les tournois" />
			<header>
				<ThemeToggle className="header-toggle" />
				<div className="kicker">
					Round-robin · {tournament.players.length} joueurs · {matches.length}{" "}
					matchs · jeu en {tournament.target}
				</div>
				<h1>{tournament.name}</h1>
				<p className="subtitle">
					Tape un match pour ouvrir le marqueur. Tout se synchronise en direct.
				</p>
				<div className="share-bar">
					<span className="url">{window.location.href}</span>
					<button className="link-btn" onClick={copyLink}>
						Copier le lien
					</button>
				</div>
			</header>

			{error && <div className="error-banner">{error}</div>}

			<MatchList tournament={tournament} matches={matches} onOpen={setOpenId} />

			<section>
				<div className="section-title">Classement</div>
				<Standings players={tournament.players} matches={matches} />
				<div className="footer-row">
					<span className="hint">
						Départage : victoires, puis différence de points.
					</span>
					<button className="link-btn" onClick={onBack}>
						← Tous les tournois
					</button>
				</div>
			</section>

			{openMatch && (
				<LiveScorer
					match={openMatch}
					target={tournament.target}
					onPatch={(patch) => patchMatch(openMatch.id, patch)}
					onClose={() => setOpenId(null)}
					onFinish={() => {
						if (openMatch && isCapot(openMatch)) setCapotMatch(openMatch);
						setOpenId(null);
					}}
				/>
			)}

			{capotMatch && (
				<CapotScreen
					winner={
						capotMatch.score_a > capotMatch.score_b
							? capotMatch.player_a
							: capotMatch.player_b
					}
					loser={
						capotMatch.score_a > capotMatch.score_b
							? capotMatch.player_b
							: capotMatch.player_a
					}
					winnerScore={Math.max(capotMatch.score_a, capotMatch.score_b)}
				>
					<button className="solid" onClick={() => setCapotMatch(null)}>
						Continuer
					</button>
				</CapotScreen>
			)}

			{showChampion && (
				<Champion
					tournament={tournament}
					matches={matches}
					onClose={() => setDismissedChampion(true)}
					onNew={onNew}
				/>
			)}
		</div>
	);
}
