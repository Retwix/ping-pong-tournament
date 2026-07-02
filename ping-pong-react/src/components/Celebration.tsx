import type { ReactNode } from "react";
import Confetti from "./Confetti";

interface Props {
	headline: string;
	winnerName: ReactNode;
	subtitle?: ReactNode;
	actions: ReactNode;
	children?: ReactNode;
}

/**
 * The shared victory card used by both the single-game result and the tournament
 * champion screen, so the celebratory layout lives in one place. Callers supply
 * what differs (copy, actions, and any extra content such as a podium); the capot
 * shutout keeps its own dedicated screen.
 */
export default function Celebration({
	headline,
	winnerName,
	subtitle,
	actions,
	children,
}: Props) {
	return (
		<div className="champion">
			<Confetti />
			<div className="champ-inner">
				<div className="champ-kicker">{headline}</div>
				<div className="champ-trophy">🏆</div>
				<div className="champ-name">{winnerName}</div>
				{subtitle != null && <div className="champ-sub">{subtitle}</div>}
				{children}
				<div className="champ-actions">{actions}</div>
			</div>
		</div>
	);
}
