import {
	IconChevronDown,
	IconChevronRight,
	IconUsers,
} from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import LiveBanner from "./LiveBanner";
import RankingHero from "./RankingHero";
import RecentMatches from "./RecentMatches";
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
	onClassement: () => void;
	onPronos: () => void;
	onLive: () => void;
	onRef: () => void;
	onHistory: () => void;
}

export default function Home({
	onOpen,
	onNew,
	onNewGame,
	onPlayers,
	onStats,
	onClassement,
	onPronos,
	onLive,
	onRef,
	onHistory,
}: Props) {
	return (
		<div className="wrap dash">
			<div className="dash-head">
				<div className="titles">
					<div className="kicker">Round-robin · live</div>
					<h1>
						Tournoi <span className="em">ping-pong</span>
					</h1>
				</div>
				<div className="dash-actions">
					<ThemeToggle />
					<NewMenu onNew={onNew} onNewGame={onNewGame} />
				</div>
			</div>

			<LiveBanner onWatch={onLive} onRef={onRef} />

			<div className="dash-grid">
				<div className="dash-main">
					<RankingHero onFull={onClassement} />

					<div className="teaser-row">
						<button className="teaser" onClick={onPronos}>
							<div className="teaser-top">
								<span className="t">Pronos</span>
								<span className="more">Voir →</span>
							</div>
							<div className="desc">
								Qui lit le mieux le jeu ? Parie sur les matchs —{" "}
								<b>sans argent, juste l'honneur</b>.
							</div>
						</button>
						<button className="teaser" onClick={onStats}>
							<div className="teaser-top">
								<span className="t">Stats</span>
								<span className="more">Voir →</span>
							</div>
							<div className="desc">
								Face-à-face, rivalités, séries et <b>superlatifs</b> de la saison.
							</div>
						</button>
					</div>
				</div>

				<aside className="dash-rail">
					<RecentMatches onOpen={onOpen} onHistory={onHistory} />

					<div>
						<div className="rail-div" />
						<div className="rail-label">Gérer</div>
						<button className="manage-card" onClick={onPlayers}>
							<span className="manage-ico">
								<IconUsers size={18} stroke={1.8} />
							</span>
							<div className="mc-body">
								<div className="mc-title">Joueurs</div>
								<div className="mc-sub">Gérer la liste</div>
							</div>
							<IconChevronRight className="mc-arrow" size={18} stroke={1.8} />
						</button>
					</div>
				</aside>
			</div>
		</div>
	);
}
