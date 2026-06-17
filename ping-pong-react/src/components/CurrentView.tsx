import { useCurrentTournament } from "../hooks/useCurrentTournament";
import LiveView from "./LiveView";
import ThemeToggle from "./ThemeToggle";

interface Props {
	/** false = referee mode (scorable), true = spectator mode. */
	readOnly: boolean;
	onHome: () => void;
	/** Spectator view only: jump into referee mode for the same live match. */
	onRef?: () => void;
}

/**
 * Backs the stable /live and /ref URLs. It resolves whatever tournament is on the
 * table and hands it to LiveView, swapping automatically when a new one starts.
 * No per-tournament id in the URL, so a projector or referee tablet can be pointed
 * at it once and left alone. Shows a placeholder when nothing is live.
 */
export default function CurrentView({ readOnly, onHome, onRef }: Props) {
	const { id, loading } = useCurrentTournament();

	if (loading) {
		return (
			<div className="wrap">
				<p className="empty">Chargement…</p>
			</div>
		);
	}

	if (!id) {
		return (
			<div className="wrap">
				<header>
					<ThemeToggle className="header-toggle" />
					<div className="kicker">{readOnly ? "Mode live" : "Mode arbitre"}</div>
					<h1>
						🏓 Aucun match <span className="em">en cours</span>
					</h1>
					<p className="subtitle">
						Dès qu'une partie démarre, elle s'affiche ici automatiquement. Pas
						besoin de rafraîchir.
					</p>
				</header>
				<section>
					<div className="footer-row">
						<button className="link-btn" onClick={onHome}>
							← Accueil
						</button>
					</div>
				</section>
			</div>
		);
	}

	// `key={id}` remounts cleanly when the active tournament changes, so the
	// followed-match state never carries over from the previous tournament.
	return (
		<LiveView key={id} id={id} readOnly={readOnly} onBack={onHome} onRef={onRef} />
	);
}
