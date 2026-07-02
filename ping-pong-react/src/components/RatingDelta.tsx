import type { SideRating } from "../hooks/useRatingDeltas";

const STAKES_BADGE: Record<SideRating["stakes"], string | null> = {
	normal: null,
	final: "Finale",
	grand_final: "Grande finale 🏆",
};

/** The signed ▲/▼ delta chip, reusing the Classement trend styling. */
function Trend({ delta }: { delta: number }) {
	const v = Math.round(delta);
	if (v === 0) return <span className="rt-trend flat">–</span>;
	const up = v > 0;
	return (
		<span className={`rt-trend ${up ? "up" : "down"}`}>
			{up ? "▲" : "▼"} {Math.abs(v)}
		</span>
	);
}

/**
 * Detailed rating move for the referee "up next" screen: name, before → after,
 * the signed delta, plus stakes / provisional context. There's no time pressure
 * here, so it can afford the "why".
 */
export function RatingMoveRow({ side }: { side: SideRating }) {
	return (
		<div className={`rd-row${side.won ? " win" : ""}`}>
			<span className="rd-name">{side.name}</span>
			<span className="rd-move">
				{Math.round(side.ratingBefore)} → <b>{Math.round(side.ratingAfter)}</b>
			</span>
			<Trend delta={side.delta} />
			<span className="rd-tags">
				{STAKES_BADGE[side.stakes] && (
					<span className="rd-badge stakes">{STAKES_BADGE[side.stakes]}</span>
				)}
				{side.provisional ? (
					<span className="rd-badge prov">provisoire</span>
				) : (
					side.rank != null && <span className="rd-badge rank">#{side.rank}</span>
				)}
			</span>
		</div>
	);
}

/**
 * Compact chip for the spectator scoreboard, shown under a finished side while
 * the result lingers. Kept glanceable for a projector: just the signed delta and
 * the new rating.
 */
export function RatingChip({ side }: { side: SideRating }) {
	const v = Math.round(side.delta);
	const up = v > 0;
	const dir = v === 0 ? "flat" : up ? "up" : "down";
	return (
		<span className={`rd-chip ${dir}`}>
			<span className="rd-chip-delta">
				{v === 0 ? "±0" : `${up ? "+" : "−"}${Math.abs(v)}`}
			</span>
			<span className="rd-chip-rating">{Math.round(side.ratingAfter)}</span>
		</span>
	);
}
