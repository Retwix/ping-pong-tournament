import { useEffect, useState } from "react";
import Board from "./components/Board";
import CurrentView from "./components/CurrentView";
import Home from "./components/Home";
import Leaderboard from "./components/Leaderboard";
import LiveView from "./components/LiveView";
import Players from "./components/Players";
import Ratings from "./components/Ratings";
import Setup from "./components/Setup";
import Stats from "./components/Stats";
import { currentPath, navigate } from "./lib/router";
import { hasSupabaseConfig } from "./lib/supabase";

type Route =
	| { name: "home" }
	| { name: "new" }
	| { name: "game" }
	| { name: "players" }
	| { name: "stats" }
	| { name: "classement" }
	| { name: "pronos" }
	| { name: "board"; id: string }
	| { name: "live"; id: string }
	| { name: "live-current" }
	| { name: "ref-current" };

function parseRoute(): Route {
	const p = currentPath();
	if (p === "/new") return { name: "new" };
	if (p === "/game") return { name: "game" };
	if (p === "/players") return { name: "players" };
	if (p === "/stats") return { name: "stats" };
	if (p === "/classement") return { name: "classement" };
	if (p === "/pronos") return { name: "pronos" };
	// Stable, shareable views that follow the current tournament (no id needed).
	if (p === "/live") return { name: "live-current" };
	if (p === "/ref") return { name: "ref-current" };
	const live = p.match(/^\/t\/(.+)\/live$/);
	if (live) return { name: "live", id: decodeURIComponent(live[1]) };
	const m = p.match(/^\/t\/(.+)$/);
	if (m) return { name: "board", id: decodeURIComponent(m[1]) };
	return { name: "home" };
}

function ConfigError() {
	return (
		<div className="wrap">
			<header>
				<div className="kicker">Configuration requise</div>
				<h1>
					Ping-Pong <span className="em">Recovr</span>
				</h1>
			</header>
			<div className="error-banner">
				Les clés Supabase sont manquantes. Copie <code>.env.example</code> vers{" "}
				<code>.env</code> et renseigne <code>VITE_SUPABASE_URL</code> et{" "}
				<code>VITE_SUPABASE_ANON_KEY</code>, puis relance{" "}
				<code>npm run dev</code>. Vois le README pour les étapes détaillées.
			</div>
		</div>
	);
}

function renderRoute(route: Route) {
	if (!hasSupabaseConfig) return <ConfigError />;
	switch (route.name) {
		case "new":
			return (
				<Setup
					onCreated={(id) => navigate(`/t/${id}`)}
					onCancel={() => navigate("/")}
				/>
			);
		case "game":
			return (
				<Setup
					mode="game"
					onCreated={(id) => navigate(`/t/${id}`)}
					onCancel={() => navigate("/")}
				/>
			);
		case "players":
			return <Players onBack={() => navigate("/")} />;
		case "stats":
			return <Stats onBack={() => navigate("/")} />;
		case "classement":
			return <Ratings onBack={() => navigate("/")} />;
		case "pronos":
			return <Leaderboard onBack={() => navigate("/")} />;
		case "board":
			return (
				<Board
					id={route.id}
					onBack={() => navigate("/")}
					onNew={() => navigate("/new")}
					onOpen={(id) => navigate(`/t/${id}`)}
				/>
			);
		case "live":
			return (
				<LiveView
					id={route.id}
					onBack={() => navigate(`/t/${route.id}`)}
				/>
			);
		case "live-current":
			return (
				<CurrentView
					readOnly
					onHome={() => navigate("/")}
					onRef={() => navigate("/ref")}
				/>
			);
		case "ref-current":
			return <CurrentView readOnly={false} onHome={() => navigate("/")} />;
		default:
			return (
				<Home
					onOpen={(id) => navigate(`/t/${id}`)}
					onNew={() => navigate("/new")}
					onNewGame={() => navigate("/game")}
					onPlayers={() => navigate("/players")}
					onStats={() => navigate("/stats")}
					onClassement={() => navigate("/classement")}
					onPronos={() => navigate("/pronos")}
					onLive={() => navigate("/live")}
					onRef={() => navigate("/ref")}
				/>
			);
	}
}

export default function App() {
	const [route, setRoute] = useState<Route>(parseRoute());

	useEffect(() => {
		const onNavigate = () => setRoute(parseRoute());
		window.addEventListener("popstate", onNavigate);
		return () => window.removeEventListener("popstate", onNavigate);
	}, []);

	return renderRoute(route);
}
