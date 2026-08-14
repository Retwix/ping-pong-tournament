import { useState, type ReactNode } from "react";
import { deltaTone, type FinalStandingRow } from "../lib/finalStandings";
import { signed } from "../lib/format";
import type { LookUpPlayer } from "../lib/playerLookup";
import type { TournamentFormat } from "../types";
import Avatar from "./Avatar";

interface Props {
	rows: FinalStandingRow[];
	format: TournamentFormat;
	look: LookUpPlayer;
	actions: ReactNode;
}

/** Beyond this many players the tail folds behind a "+N" row rather than scrolling. */
const COLLAPSE_AFTER = 9;

const FOOTNOTE: Record<TournamentFormat, string> = {
	double_elim:
		"Places 1–3 issues du bracket. Places 4+ classées par tour d'élimination, puis victoires, différence de points et Élo net.",
	round_robin: "Classement par victoires, puis différence de points, puis Élo net.",
};

const FORMAT_LABEL: Record<TournamentFormat, string> = {
	double_elim: "Double élim.",
	round_robin: "Round robin",
};

/**
 * Where a row sits in a run of tied rows. Only the ends of the run are rounded,
 * so three-way ties read as one joined block rather than stacked pills.
 */
function tiePosition(
	rows: FinalStandingRow[],
	i: number,
): "top" | "middle" | "bottom" | null {
	if (rows[i]?.exAequo !== true) return null;
	const first = rows[i - 1]?.exAequo !== true;
	const last = rows[i + 1]?.exAequo !== true;
	if (first) return "top";
	return last ? "bottom" : "middle";
}

interface RowProps {
	row: FinalStandingRow;
	look: LookUpPlayer;
	/** Position within a run of tied rows, so the shared background can join them. */
	joined: "top" | "middle" | "bottom" | null;
}

function StandingsRow({ row, look, joined }: RowProps) {
	const { team, url } = look(row.name);
	const tied = joined === null ? "" : ` fs-tied fs-tied--${joined}`;
	const delta = row.eloDelta;
	return (
		<div className={`fs-row${row.place === 1 ? " fs-row--champ" : ""}${tied}`}>
			<div className="fs-place">{row.place}</div>
			<div className="fs-who">
				<Avatar name={row.name} team={team} url={url} className="fs-av" fill="solid" />
				<span className="fs-name">{row.name}</span>
				{row.exAequo && <span className="fs-exaequo">ex æquo</span>}
			</div>
			<div className="fs-wl">
				{row.wins}–{row.losses}
			</div>
			<div className="fs-diff">{signed(row.diff)}</div>
			<div className="fs-elo">
				{row.elo === null ? "—" : Math.round(row.elo)}
				{row.provisional && <span className="fs-prov">*</span>}
			</div>
			<div className={`fs-delta fs-delta--${deltaTone(delta)}`}>
				{delta === null ? "—" : signed(delta)}
			</div>
		</div>
	);
}

/**
 * The final classement: every player, their record, and what the tournament did to
 * their rating. Names truncate rather than wrap so the row grid stays aligned
 * however long they are, and the narrow layout drops the two least essential
 * columns rather than squeezing all six onto a phone.
 */
export default function FinalStandingsCard({ rows, format, look, actions }: Props) {
	const [expanded, setExpanded] = useState(false);
	const hidden = rows.length - COLLAPSE_AFTER;
	const collapsed = hidden > 0 && !expanded;
	const visible = collapsed ? rows.slice(0, COLLAPSE_AFTER) : rows;
	const anyProvisional = rows.some((r) => r.provisional);

	return (
		<div className="fs-card">
			<div className="fs-head">
				<div className="fs-title">Classement final</div>
				<div className="fs-meta">
					<span className={`fs-format fs-format--${format}`}>{FORMAT_LABEL[format]}</span>
					<span className="fs-count">
						{rows.length} joueur{rows.length > 1 ? "s" : ""}
					</span>
				</div>
			</div>

			<div className="fs-row fs-row--head">
				<div className="fs-place">#</div>
				<div>Joueur</div>
				<div className="fs-wl">V–D</div>
				<div className="fs-diff">Diff</div>
				<div className="fs-elo">Élo</div>
				<div className="fs-delta">Δ</div>
			</div>

			<div className="fs-rows">
				{visible.map((row, i) => (
					<StandingsRow
						key={row.name}
						row={row}
						look={look}
						joined={tiePosition(visible, i)}
					/>
				))}
				{collapsed && (
					<button className="fs-more" onClick={() => setExpanded(true)}>
						+ {hidden} autre{hidden > 1 ? "s" : ""} joueur{hidden > 1 ? "s" : ""}
					</button>
				)}
			</div>

			<p className="fs-note">
				{FOOTNOTE[format]}
				{anyProvisional && "  * Élo provisoire (moins de 10 parties)."}
			</p>
			<div className="fs-actions">{actions}</div>
		</div>
	);
}
