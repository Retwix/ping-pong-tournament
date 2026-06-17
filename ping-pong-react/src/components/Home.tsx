import { IconChevronDown, IconTrash } from "@tabler/icons-react";
import { type MouseEvent, useEffect, useRef, useState } from "react";
import { useTournaments } from "../hooks/useTournaments";
import { deleteTournament } from "../lib/db";
import ThemeToggle from "./ThemeToggle";

/** "Nouveau" split button: a dropdown to start a quick game or a full tournament. */
function NewMenu({
	onNew,
	onNewGame,
}: {
	onNew: () => void;
	onNewGame: () => void;
}) {
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		const onDoc = (e: globalThis.MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node))
				setOpen(false);
		};
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
		document.addEventListener("mousedown", onDoc);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onDoc);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);

	const pick = (fn: () => void) => () => {
		setOpen(false);
		fn();
	};

	const item: React.CSSProperties = {
		display: "flex",
		alignItems: "center",
		gap: 8,
		width: "100%",
		padding: "9px 12px",
		background: "none",
		border: "none",
		textAlign: "left",
		font: "inherit",
		color: "var(--ink)",
		cursor: "pointer",
		borderRadius: 8,
		whiteSpace: "nowrap",
	};

	return (
		<div ref={ref} style={{ position: "relative", display: "inline-flex" }}>
			<button
				className="btn-primary"
				onClick={() => setOpen((o) => !o)}
				aria-haspopup="menu"
				aria-expanded={open}
				style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
			>
				+ Nouveau
				<IconChevronDown
					size={16}
					stroke={2}
					style={{
						transition: "transform 150ms",
						transform: open ? "rotate(180deg)" : "none",
					}}
				/>
			</button>
			{open && (
				<div
					role="menu"
					style={{
						position: "absolute",
						top: "calc(100% + 6px)",
						right: 0,
						zIndex: 30,
						minWidth: 200,
						padding: 6,
						background: "var(--surface)",
						border: "1px solid var(--border-strong)",
						borderRadius: 12,
						boxShadow: "var(--shadow-pop)",
					}}
				>
					<button
						role="menuitem"
						style={item}
						onClick={pick(onNewGame)}
						onMouseEnter={(e) =>
							(e.currentTarget.style.background = "var(--ghost-hover)")
						}
						onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
					>
						⚡ Partie rapide
					</button>
					<button
						role="menuitem"
						style={item}
						onClick={pick(onNew)}
						onMouseEnter={(e) =>
							(e.currentTarget.style.background = "var(--ghost-hover)")
						}
						onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
					>
						🏆 Nouveau tournoi
					</button>
				</div>
			)}
		</div>
	);
}

interface Props {
	onOpen: (id: string) => void;
	onNew: () => void;
	onNewGame: () => void;
	onPlayers: () => void;
	onStats: () => void;
	onPronos: () => void;
	onLive: () => void;
	onRef: () => void;
}

export default function Home({
	onOpen,
	onNew,
	onNewGame,
	onPlayers,
	onStats,
	onPronos,
	onLive,
	onRef,
}: Props) {
	const { tournaments, loading, error } = useTournaments();

	const onDelete = async (e: MouseEvent, id: string, name: string) => {
		e.stopPropagation();
		if (confirm(`Supprimer « ${name} » ? Cette action est définitive.`)) {
			await deleteTournament(id);
		}
	};

	return (
		<div className="wrap">
			<header>
				<ThemeToggle className="header-toggle" />
				<div className="kicker">Round-robin · live</div>
				<h1>
					Tournoi <span className="em">ping-pong</span>
				</h1>
				<p className="subtitle">
					Crée un tournoi ou reprends-en un. Les scores se synchronisent en
					direct sur tous les écrans.
				</p>
			</header>

			{error && <div className="error-banner">Erreur : {error}</div>}

			<section>
				<div className="home-top">
					<span className="setup-label" style={{ margin: 0 }}>
						Tes parties &amp; tournois
					</span>
					<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
						<button
							className="link-btn"
							onClick={onLive}
							title="Affichage spectateur du match en cours (lien fixe à partager)"
						>
							📺 Live
						</button>
						<button
							className="link-btn"
							onClick={onRef}
							title="Mode arbitre du match en cours (lien fixe à partager)"
						>
							🧑‍⚖️ Arbitre
						</button>
						<button
							className="link-btn"
							onClick={onPronos}
							title="Classement des parieurs"
						>
							🔮 Pronos
						</button>
						<button className="link-btn" onClick={onStats}>
							Stats
						</button>
						<button className="link-btn" onClick={onPlayers}>
							Joueurs
						</button>
						<NewMenu onNew={onNew} onNewGame={onNewGame} />
					</div>
				</div>

				{loading ? (
					<div className="empty">Chargement…</div>
				) : tournaments.length === 0 ? (
					<div className="empty">
						Aucun tournoi pour l'instant. Crée le premier !
					</div>
				) : (
					tournaments.map((t) => (
						<div className="t-card" key={t.id} onClick={() => onOpen(t.id)}>
							<div>
								<div className="t-name">{t.name}</div>
								<div className="t-meta">
									{t.kind === "game"
										? "Partie"
										: `Tournoi · ${t.players.length} joueurs`}{" "}
									· jeu en {t.target} ·{" "}
									{new Date(t.created_at).toLocaleDateString("fr-FR")}
								</div>
							</div>
							<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
								<span
									className={`t-badge${t.status === "done" ? " done" : ""}`}
								>
									{t.status === "done" ? "Terminé" : "En cours"}
								</span>
								<button
									className="t-del"
									title="Supprimer"
									onClick={(e) => onDelete(e, t.id, t.name)}
								>
									<IconTrash size={18} stroke={1.75} />
								</button>
							</div>
						</div>
					))
				)}
			</section>
		</div>
	);
}
