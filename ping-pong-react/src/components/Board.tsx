import { useMemo, useState } from "react";
import { useBettorName } from "../hooks/useBettorName";
import { usePlayers } from "../hooks/usePlayers";
import { useRatingDeltas } from "../hooks/useRatingDeltas";
import { useTournament } from "../hooks/useTournament";
import { createTournament } from "../lib/db";
import { chaosSettingsFromTournament } from "../lib/chaos";
import { playerLookup } from "../lib/playerLookup";
import { navigate } from "../lib/router";
import { isCapot, winnerLoser } from "../lib/stats";
import type { Match } from "../types";
import CapotScreen from "./CapotScreen";
import Champion from "./Champion";
import GameResult from "./GameResult";
import LiveScorer from "./LiveScorer";
import MatchList from "./MatchList";
import BracketView from "./BracketView";
import Predictions from "./Predictions";
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
	const { name: bettorName, setName: setBettorName } = useBettorName();
	const { players: registry } = usePlayers();
	const {
		forMatch: ratingsForMatch,
		forTournament: ratingsForTournament,
		elosFor,
	} = useRatingDeltas();
	const look = useMemo(() => playerLookup(registry), [registry]);
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
			return (
				<GameResult
					match={match}
					onReplay={rematch}
					onHome={onBack}
					ratings={ratingsForMatch(match)}
					look={look}
				/>
			);
		}
		return (
			<LiveScorer
				match={match}
				target={tournament.target}
				chaos={chaosSettingsFromTournament(tournament)}
				onPatch={(patch) => patchMatch(match.id, patch)}
				onClose={onBack}
				onFinish={() => {
					/* match.done flips via the patch above, which renders GameResult */
				}}
				tournamentName={tournament.name}
				subtitle="Partie rapide"
				elos={elosFor(match)}
				onPresent={() => navigate(`/t/${id}/live`)}
			/>
		);
	}

	const isDouble = tournament.format === "double_elim";
	const openMatch = matches.find((m) => m.id === openId) ?? null;
	const capot = capotMatch ? winnerLoser(capotMatch) : null;
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
					{isDouble ? "Élimination directe" : "Round-robin"} ·{" "}
					{tournament.players.length} joueurs · jeu en {tournament.target}
				</div>
				<h1>{tournament.name}</h1>
				<p className="subtitle">
					{isDouble
						? "Le gagnant avance, le perdant tombe dans le tableau des perdants. Tape un match prêt pour le marquer."
						: "Tape un match pour ouvrir le marqueur. Tout se synchronise en direct."}
				</p>
				<div className="share-bar">
					<span className="url">{window.location.href}</span>
					<button className="link-btn" onClick={copyLink}>
						Copier le lien
					</button>
					<button
						className="link-btn"
						onClick={() => navigate("/live")}
						title="Affichage spectateur (lien fixe) : suit automatiquement le match en cours"
					>
						📺 Mode live
					</button>
					<button
						className="link-btn"
						onClick={() => navigate("/ref")}
						title="Mode arbitre (lien fixe) : marque le match en cours"
					>
						🧑‍⚖️ Mode arbitre
					</button>
				</div>
			</header>

			{error && <div className="error-banner">{error}</div>}

			{isDouble ? (
				<>
					<BracketView matches={matches} onOpen={setOpenId} />
					<div className="footer-row">
						<span className="hint">
							Tableau à double élimination : il faut perdre 2 fois pour être
							éliminé.
						</span>
						<button className="link-btn" onClick={onBack}>
							← Tous les tournois
						</button>
					</div>
				</>
			) : (
				<>
					<MatchList
						tournament={tournament}
						matches={matches}
						onOpen={setOpenId}
					/>

					<Predictions
						tournament={tournament}
						matches={matches}
						bettorName={bettorName}
						onNameChange={setBettorName}
					/>

					<section>
						<div className="section-title">Classement</div>
						<Standings
							players={tournament.players}
							matches={matches}
							ratings={ratingsForTournament(matches)}
						/>
						<div className="footer-row">
							<span className="hint">
								Départage : victoires, puis différence de points.
							</span>
							<button className="link-btn" onClick={onBack}>
								← Tous les tournois
							</button>
						</div>
					</section>
				</>
			)}

			{openMatch && (
				<LiveScorer
					match={openMatch}
					target={tournament.target}
					chaos={chaosSettingsFromTournament(tournament)}
					onPatch={(patch) => patchMatch(openMatch.id, patch)}
					onClose={() => setOpenId(null)}
					onFinish={() => {
						if (openMatch && isCapot(openMatch)) setCapotMatch(openMatch);
						setOpenId(null);
					}}
					tournamentName={tournament.name}
					subtitle={isDouble ? "Élimination directe" : "Round-robin"}
					elos={elosFor(openMatch)}
					onPresent={() => navigate(`/t/${id}/live`)}
				/>
			)}

			{capot && (
				<CapotScreen
					winner={capot.winner}
					loser={capot.loser}
					winnerScore={capot.ws}
					look={look}
				>
					<button className="tk-btn tk-btn--primary" onClick={() => setCapotMatch(null)}>
						Continuer
					</button>
				</CapotScreen>
			)}

			{showChampion && (
				<Champion
					tournament={tournament}
					matches={matches}
					ratings={ratingsForTournament(matches)}
					look={look}
					onClose={() => setDismissedChampion(true)}
					onNew={onNew}
				/>
			)}
		</div>
	);
}
