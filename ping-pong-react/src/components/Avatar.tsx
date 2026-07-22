import { useState } from "react";
import { teamColor } from "../lib/teams";

interface Props {
	name: string;
	team: string;
	url: string | null;
	className?: string;
}

/**
 * Player avatar: the uploaded photo when available, otherwise the colored
 * initial. A photo that fails to load silently falls back to the initial
 * (brokenUrl resets by itself when the url changes).
 */
export default function Avatar({ name, team, url, className }: Props) {
	const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
	const color = teamColor(team);
	const showPhoto = url !== null && url !== brokenUrl;
	const initial = (name.trim()[0] ?? "?").toUpperCase();
	return (
		<span
			className={`avatar${className ? ` ${className}` : ""}`}
			style={showPhoto ? undefined : { background: `${color}24`, color }}
		>
			{showPhoto ? (
				<img src={url} alt="" onError={() => setBrokenUrl(url)} />
			) : (
				initial
			)}
		</span>
	);
}
