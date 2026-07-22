import { useState } from "react";
import { playerInitials } from "../lib/avatar";
import { teamColor } from "../lib/teams";

interface Props {
	name: string;
	team: string | null;
	url: string | null;
	className?: string;
	/**
	 * How the initials fallback is filled. The celebration screens sit on a dark
	 * gradient where the default tint loses its contrast, so they use `solid`;
	 * `hero` is the winner's own circle, which matches its gold-bordered treatment.
	 */
	fill?: "tint" | "solid" | "hero";
}

/**
 * Player avatar: the uploaded photo when available, otherwise the colored
 * two-letter initials. A photo that fails to load silently falls back to the
 * initials (brokenUrl resets by itself when the url changes).
 */
export default function Avatar({ name, team, url, className, fill = "tint" }: Props) {
	const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
	const color = teamColor(team ?? "");
	const showPhoto = url !== null && url !== brokenUrl;
	const initials = playerInitials(name);
	const FILLS = {
		tint: { background: `${color}24`, color },
		solid: { background: color, color: "#fff" },
		hero: { background: "#fff", color: "#4a2aa4" },
	};
	const fallbackFill = FILLS[fill];
	return (
		<span
			className={`avatar${className ? ` ${className}` : ""}`}
			style={showPhoto ? undefined : fallbackFill}
		>
			{showPhoto ? (
				<img src={url} alt="" onError={() => setBrokenUrl(url)} />
			) : (
				initials
			)}
		</span>
	);
}
