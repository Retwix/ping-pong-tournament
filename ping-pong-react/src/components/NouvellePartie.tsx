import {
  IconAlertCircle,
  IconArrowsShuffle,
  IconBolt,
  IconCheck,
  IconCirclePlus,
  IconClock,
  IconDownload,
  IconInfoCircle,
  IconLock,
  IconPlus,
  IconSearch,
  IconSparkles,
  IconTournament,
  IconTrophy,
  IconX,
} from '@tabler/icons-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRatings } from '../hooks/useRatings'
import { DEFAULT_CHAOS_SETTINGS, type ChaosSettings } from '../lib/chaos'
import { createPlayer, createTournament } from '../lib/db'
import { downloadBlob, getEmbeddedFontCss, svgToPngBlob } from '../lib/exportPng'
import { joueurRows, type JoueurRow } from '../lib/joueurs'
import { melangerEquipes, nomPaire, tirerEquipes } from '../lib/doubles'
import {
  aideCamp,
  choisirJoueurDouble,
  contientAncien,
  enjeuEffectif,
  estDoublon,
  filterJoueurs,
  noteEnjeu,
  pointsCible,
  recapitulatif,
  recapitulatifDouble,
  recapitulatifHasard,
  retirerJoueurDouble,
  type SelectionDouble,
} from '../lib/nouvellePartie'
import { inviteToSlack } from '../lib/slack'
import { TEAMS, teamBadgeStyle, teamColor, teamLabel, type TeamKey } from '../lib/teams'
import { buildChallengePosterSvg, buildTournamentPosterSvg } from '../lib/tournamentPoster'
import type { TournamentFormat } from '../types'
import Avatar from './Avatar'
import DashboardNav from './DashboardNav'
import DashboardTabBar from './DashboardTabBar'

function slugify(s: string, fallback: string): string {
  return (
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || fallback
  )
}

const PRESETS = [11, 21, 15]
const SELECTION_DOUBLE_VIDE: SelectionDouble = { a: [], b: [], camp: 'A' }

const rowsPour = (annuaire: JoueurRow[], ids: string[]): JoueurRow[] =>
  ids.map((id) => annuaire.find((r) => r.id === id)).filter((r): r is JoueurRow => r !== undefined)

interface Props {
  variant: 'game' | 'tournament'
  onCreated: (id: string) => void
  onHome: () => void
  onClassement: () => void
  onStats: () => void
  onPlayers: () => void
  onNew: () => void
  onNewGame: () => void
}

export default function NouvellePartie({
  variant,
  onCreated,
  onHome,
  onClassement,
  onStats,
  onPlayers,
  onNew,
  onNewGame,
}: Props) {
  const isGame = variant === 'game'
  const { rows, events, players, loading, error, reload } = useRatings()

  const [name, setName] = useState('')
  const [format, setFormat] = useState<TournamentFormat>('round_robin')
  const [selected, setSelected] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [preset, setPreset] = useState(11)
  const [autre, setAutre] = useState('')
  const [time, setTime] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [posterBusy, setPosterBusy] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newTeam, setNewTeam] = useState<TeamKey>('guests')
  const [dup, setDup] = useState(false)
  const [savingPlayer, setSavingPlayer] = useState(false)
  const [chaos, setChaos] = useState<ChaosSettings>(DEFAULT_CHAOS_SETTINGS)
  const [chaosOpen, setChaosOpen] = useState(false)
  const [unranked, setUnranked] = useState(false)
  const [dbl, setDbl] = useState(false)
  const [selDouble, setSelDouble] = useState<SelectionDouble>(SELECTION_DOUBLE_VIDE)
  const [hasard, setHasard] = useState(false)
  const [showAnciens, setShowAnciens] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const isDouble = isGame && dbl
  // « Équipes au hasard » : the 4 players live in the flat pool, duos drawn at creation.
  const isHasard = isDouble && hasard

  // The « Nouveau tournoi » variant has no doubles yet: drop the mode when leaving /game.
  useEffect(() => {
    if (!isGame) {
      setDbl(false)
      setHasard(false)
      setSelDouble(SELECTION_DOUBLE_VIDE)
    }
  }, [isGame])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const annuaire = useMemo(() => joueurRows(players, rows, events), [players, rows, events])
  const selRows = useMemo(() => rowsPour(annuaire, selected), [selected, annuaire])
  const teamRows = useMemo(
    () => ({
      a: rowsPour(annuaire, selDouble.a),
      b: rowsPour(annuaire, selDouble.b),
    }),
    [selDouble, annuaire],
  )
  const alumniCount = useMemo(() => annuaire.filter((r) => r.status === 'alumni').length, [annuaire])
  const available = useMemo(
    () =>
      annuaire.filter((r) => {
        if (!showAnciens && r.status === 'alumni') return false
        return isDouble && !hasard
          ? !selDouble.a.includes(r.id) && !selDouble.b.includes(r.id)
          : !selected.includes(r.id)
      }),
    [annuaire, isDouble, hasard, selDouble, selected, showAnciens],
  )
  const visible = useMemo(() => filterJoueurs(available, query), [available, query])

  const nDouble = selDouble.a.length + selDouble.b.length
  const gameFull =
    isGame && (isDouble ? (hasard ? selRows.length >= 4 : nDouble >= 4) : selRows.length >= 2)
  const target = pointsCible(preset, autre)
  const selDoubleNoms: SelectionDouble = {
    a: teamRows.a.map((r) => r.name),
    b: teamRows.b.map((r) => r.name),
    camp: selDouble.camp,
  }
  const recap = isHasard
    ? recapitulatifHasard(selRows.length, target)
    : isDouble
      ? recapitulatifDouble(selDoubleNoms, target)
      : recapitulatif({
          variant,
          format,
          selected: selRows.map((r) => r.name),
          name,
          target,
        })
  // Whichever rows are actually selected right now, matching the add/remove branching below.
  const selectedRows = isDouble && !hasard ? [...teamRows.a, ...teamRows.b] : selRows
  const ancienSelectionne = contientAncien(selectedRows)
  // Doubles have no pair Elo in v1, and an ancien must never move a rating in a
  // ladder they no longer appear in — both lock the enjeu on « Non classée ».
  const unrankedEffectif = enjeuEffectif(unranked, isDouble, ancienSelectionne)

  const basculerMode = (double: boolean) => {
    if (double === dbl) return
    setDbl(double)
    setHasard(false)
    setSelected([])
    setSelDouble(SELECTION_DOUBLE_VIDE)
  }

  // Toggling the draw mode keeps everyone picked: pool ↔ camps (A first, then B).
  const basculerHasard = (on: boolean) => {
    if (on === hasard) return
    if (on) {
      setSelected([...selDouble.a, ...selDouble.b])
      setSelDouble(SELECTION_DOUBLE_VIDE)
    } else {
      setSelDouble({
        a: selected.slice(0, 2),
        b: selected.slice(2, 4),
        camp: selected.length >= 2 ? 'B' : 'A',
      })
      setSelected([])
    }
    setHasard(on)
  }

  const add = (id: string) => {
    if (gameFull) return
    if (isDouble && !hasard) setSelDouble((s) => choisirJoueurDouble(s, id))
    else setSelected((s) => [...s, id])
  }
  const remove = (id: string) => {
    if (isDouble && !hasard) setSelDouble((s) => retirerJoueurDouble(s, id))
    else setSelected((s) => s.filter((x) => x !== id))
  }

  const addNewPlayer = async () => {
    const nm = newName.trim()
    if (!nm || savingPlayer) return
    if (estDoublon(players, nm)) {
      setDup(true)
      return
    }
    setSavingPlayer(true)
    try {
      const p = await createPlayer(nm, newTeam)
      await reload()
      add(p.id)
      setNewOpen(false)
      setNewName('')
      setNewTeam('guests')
      setDup(false)
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : String(e))
    } finally {
      setSavingPlayer(false)
    }
  }

  const create = async () => {
    if (!recap.valid || creating) return
    setCreating(true)
    setCreateError(null)
    try {
      // Doubles: manual camps as picked, or drawn here — the surprise revealed on the scorer.
      const [equipeA, equipeB] = isHasard
        ? tirerEquipes(selected, Math.random)
        : [selDouble.a, selDouble.b]
      const paireA = nomPaire(rowsPour(annuaire, equipeA).map((r) => r.name))
      const paireB = nomPaire(rowsPour(annuaire, equipeB).map((r) => r.name))
      const id = await createTournament(
        isDouble ? `${paireA} vs ${paireB}` : recap.autoName,
        isDouble ? [paireA, paireB] : selRows.map((r) => r.name),
        target,
        isGame ? 'game' : 'tournament',
        isGame ? 'round_robin' : format,
        chaos,
        unrankedEffectif,
        isDouble ? [equipeA, equipeB] : null,
      )
      // Fire the Slack invitation (no-op unless configured); never blocks navigation.
      void inviteToSlack(id)
      onCreated(id)
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : String(e))
      setCreating(false)
    }
  }

  // No poster in draw mode: the duos don't exist until « Lancer la partie ».
  const canPoster = isGame ? recap.valid && !isHasard : true

  const downloadPoster = async () => {
    if (!canPoster || posterBusy) return
    setPosterBusy(true)
    try {
      const fontCss = await getEmbeddedFontCss()
      const paireA = isDouble ? nomPaire(selDoubleNoms.a) : selRows[0].name
      const paireB = isDouble ? nomPaire(selDoubleNoms.b) : selRows[1].name
      const { svg, width, height, filename } = isGame
        ? {
            ...buildChallengePosterSvg({ playerA: paireA, playerB: paireB, target, time }, fontCss),
            filename: `challenge-${slugify(`${paireA}-vs-${paireB}`, 'challenge')}.png`,
          }
        : {
            ...buildTournamentPosterSvg({ name: name.trim(), target, time }, fontCss),
            filename: `tournament-${slugify(name, 'poster')}-poster.png`,
          }
      const blob = await svgToPngBlob(svg, width, height, 2)
      downloadBlob(blob, filename)
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : String(e))
    } finally {
      setPosterBusy(false)
    }
  }

  const kicker = isGame
    ? 'Partie rapide'
    : format === 'round_robin'
      ? 'Round-robin · nouveau tournoi'
      : 'Élimination directe · nouveau tournoi'
  const countPill = isGame
    ? isDouble
      ? `${hasard ? selRows.length : nDouble} / 4`
      : `${selRows.length} / 2`
    : selRows.length === 1
      ? '1 joueur'
      : `${selRows.length} joueurs`
  const ruleHint = isGame
    ? 'Premier à atteindre le score, avec 2 points d’écart.'
    : format === 'round_robin'
      ? 'Départage : victoires, puis différence de points.'
      : 'Tableau à double élimination : il faut perdre 2 fois pour être éliminé.'

  const carteEquipe = (camp: 'A' | 'B') => {
    const rows = camp === 'A' ? teamRows.a : teamRows.b
    const active = selDouble.camp === camp && !gameFull
    const activer = () => setSelDouble((s) => ({ ...s, camp }))
    return (
      <div
        role="button"
        tabIndex={0}
        aria-pressed={selDouble.camp === camp}
        className={`np-team${active ? ' active' : ''}`}
        onClick={activer}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            activer()
          }
        }}
      >
        <div className="np-team-head">
          <span className="np-team-title">Équipe {camp}</span>
          <span className="np-team-count">{rows.length} / 2</span>
        </div>
        <div className="np-team-list">
          {rows.map((r) => (
            <div className="np-team-row" key={r.id}>
              <Avatar className="np-av" name={r.name} team={r.team} url={r.avatarUrl} />
              <span className="np-team-txt">
                <span className="np-team-name">{r.name}</span>
                <span className="np-team-pole">{teamLabel(r.team)}</span>
              </span>
              <button
                className="np-x"
                onClick={(e) => {
                  e.stopPropagation()
                  remove(r.id)
                }}
                title="Retirer"
              >
                <IconX size={15} stroke={2.2} />
              </button>
            </div>
          ))}
          {Array.from({ length: Math.max(0, 2 - rows.length) }, (_, i) => (
            <div className="np-team-slot" key={i}>
              <span className="np-slot-plus">+</span>
              <span>Ajouter un joueur</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const nav = (
    <DashboardNav
      onHome={onHome}
      onClassement={onClassement}
      onStats={onStats}
      onPlayers={onPlayers}
      onNew={onNew}
      onNewGame={onNewGame}
    />
  )
  const tabbar = (
    <DashboardTabBar
      onHome={onHome}
      onClassement={onClassement}
      onStats={onStats}
      onPlayers={onPlayers}
      onNew={onNew}
      onNewGame={onNewGame}
    />
  )

  return (
    <div className="rv-page">
      {nav}

      {error && <div className="error-banner">Erreur : {error}</div>}

      <div className="np-in">
        <button className="np-crumb" onClick={onHome}>
          ‹ Accueil
        </button>
        <div className="np-head">
          <div className="np-head-text">
            <div className="np-kicker">{kicker}</div>
            <h1 className="np-title">{isGame ? 'Nouvelle partie' : 'Nouveau tournoi'}</h1>
            <p className="np-sub">
              {isGame
                ? 'Deux joueurs, un score, et le bureau est prévenu sur Slack.'
                : 'Choisis un format, ajoute les joueurs, le tableau se génère.'}
            </p>
          </div>
          <div className="np-seg">
            <button
              className={`np-seg-btn${isGame ? ' active' : ''}`}
              onClick={isGame ? undefined : onNewGame}
            >
              <IconBolt size={15} stroke={2} />
              Partie rapide
            </button>
            <button
              className={`np-seg-btn${isGame ? '' : ' active'}`}
              onClick={isGame ? onNew : undefined}
            >
              <IconTrophy size={15} stroke={2} />
              Tournoi
            </button>
          </div>
        </div>
      </div>

      {createError && (
        <div className="np-error">
          <IconAlertCircle size={19} stroke={2.1} className="np-error-icon" />
          <div className="np-error-text">
            <div className="np-error-title">La création a échoué</div>
            <div className="np-error-desc">{createError}</div>
          </div>
          <button className="np-retry" onClick={create}>
            Réessayer
          </button>
        </div>
      )}

      <div className="np-grid np-in">
        <div className="np-form">
          {!isGame && (
            <>
              <section className="np-card">
                <div className="np-label">Nom du tournoi</div>
                <label className="np-field">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Tournoi du bureau"
                    maxLength={40}
                  />
                  <span className="np-count">{name.length}/40</span>
                </label>
                <p className="np-note">Laisse vide et il s’appellera « Tournoi ».</p>
              </section>

              <section>
                <h2 className="np-sec-title">Format</h2>
                <div className="np-format">
                  <button
                    className={`np-format-card${format === 'round_robin' ? ' active' : ''}`}
                    onClick={() => setFormat('round_robin')}
                  >
                    <span className="np-fc-top">
                      <span className="np-icon-tile">
                        <IconCirclePlus size={18} stroke={2} />
                      </span>
                      <span className="np-radio">
                        <span className="np-radio-dot" />
                      </span>
                    </span>
                    <span className="np-fc-title">Round-robin</span>
                    <span className="np-fc-desc">
                      Chacun affronte tout le monde. Le plus équitable.
                    </span>
                  </button>
                  <button
                    className={`np-format-card${format === 'double_elim' ? ' active' : ''}`}
                    onClick={() => setFormat('double_elim')}
                  >
                    <span className="np-fc-top">
                      <span className="np-icon-tile">
                        <IconTournament size={18} stroke={2} />
                      </span>
                      <span className="np-radio">
                        <span className="np-radio-dot" />
                      </span>
                    </span>
                    <span className="np-fc-title">Élimination directe</span>
                    <span className="np-fc-desc">
                      Tableau à double élimination. 2 défaites = éliminé. Plus rapide.
                    </span>
                  </button>
                </div>
              </section>
            </>
          )}

          <section className="np-card">
            <div className="np-players-head">
              <h2 className="np-sec-title">Joueurs</h2>
              <span className="np-count-pill">{countPill}</span>
              {isGame && (
                <div className="np-mode-seg">
                  <button
                    className={`np-mode-btn${dbl ? '' : ' active'}`}
                    onClick={() => basculerMode(false)}
                  >
                    Simple · 1v1
                  </button>
                  <button
                    className={`np-mode-btn${dbl ? ' active' : ''}`}
                    onClick={() => basculerMode(true)}
                  >
                    Double · 2v2
                  </button>
                </div>
              )}
            </div>

            {isDouble && (
              <button
                className="np-legend np-hasard"
                aria-pressed={hasard}
                onClick={() => basculerHasard(!hasard)}
              >
                <span className="np-legend-text">
                  <span className="np-legend-title">Équipes au hasard</span>
                  <span className="np-legend-desc">
                    Les duos seront tirés au sort au lancement.
                  </span>
                </span>
                <span className={`np-sw np-sw-sm${hasard ? ' on' : ''}`}>
                  <span className="np-sw-knob" />
                </span>
              </button>
            )}

            {isDouble && !hasard ? (
              <>
                <div className="np-teams">
                  {carteEquipe('A')}
                  <div className="np-vs">vs</div>
                  {carteEquipe('B')}
                </div>
                <div className="np-camp-row">
                  <span className="np-camp-hint">{aideCamp(selDouble)}</span>
                  <button
                    className="np-melanger"
                    disabled={!gameFull}
                    title={gameFull ? undefined : 'Choisis d’abord les 4 joueurs'}
                    onClick={() => setSelDouble((s) => melangerEquipes(s, Math.random))}
                  >
                    <IconArrowsShuffle size={15} stroke={2.1} />
                    Mélanger
                  </button>
                </div>
              </>
            ) : (
              <div className="np-sel">
                {selRows.map((r, i) => (
                  <div className="np-sel-row" key={r.id}>
                    <span className="np-idx">{i + 1}</span>
                    <Avatar className="np-av" name={r.name} team={r.team} url={r.avatarUrl} />
                    <span className="np-sel-name">{r.name}</span>
                    <span className="np-poletag" style={teamBadgeStyle(r.team)}>
                      {teamLabel(r.team)}
                    </span>
                    <span className="np-elo">{r.elo}</span>
                    <button className="np-x" onClick={() => remove(r.id)} title="Retirer">
                      <IconX size={16} stroke={2.2} />
                    </button>
                  </div>
                ))}
                {selRows.length === 0 && (
                  <div className="np-empty-sel">
                    {isDouble
                      ? 'Aucun joueur — choisis-en 4 ci-dessous.'
                      : isGame
                        ? 'Aucun joueur — choisis-en 2 ci-dessous.'
                        : 'Aucun joueur — choisis-les ci-dessous.'}
                  </div>
                )}
              </div>
            )}

            {gameFull ? (
              <div className="np-full">
                <IconCheck size={17} stroke={2.2} className="np-full-check" />
                <span className="np-full-text">
                  {isDouble
                    ? '4 joueurs sélectionnés — la sélection est complète.'
                    : '2 joueurs sélectionnés — la sélection est complète.'}
                </span>
                <button
                  className="np-clear"
                  onClick={() =>
                    isDouble && !hasard ? setSelDouble(SELECTION_DOUBLE_VIDE) : setSelected([])
                  }
                >
                  Tout retirer
                </button>
              </div>
            ) : (
              <div className="np-picker">
                <div className="np-picker-top">
                  <label className="np-search">
                    <IconSearch size={17} stroke={2.1} />
                    <input
                      ref={searchRef}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Chercher un joueur ou un pôle…"
                      aria-label="Chercher un joueur ou un pôle"
                    />
                  </label>
                  <button
                    className="np-new-btn"
                    onClick={() => {
                      setNewOpen((o) => !o)
                      setNewName('')
                      setDup(false)
                    }}
                  >
                    <IconPlus size={16} stroke={2.4} />
                    Nouveau joueur
                  </button>
                </div>

                {alumniCount > 0 && (
                  <button
                    className={`np-anciens-toggle${showAnciens ? ' active' : ''}`}
                    onClick={() => setShowAnciens((v) => !v)}
                  >
                    Voir les anciens · {alumniCount}
                  </button>
                )}

                {newOpen && (
                  <div className="np-new">
                    <div className="np-label">Nouveau joueur</div>
                    <div className="np-new-row">
                      <label className="np-field">
                        <input
                          value={newName}
                          autoFocus
                          maxLength={20}
                          placeholder="Prénom ou pseudo"
                          onChange={(e) => {
                            setNewName(e.target.value)
                            setDup(false)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void addNewPlayer()
                          }}
                          aria-label="Nom du nouveau joueur"
                        />
                      </label>
                      <button
                        className="np-add-btn"
                        disabled={!newName.trim() || savingPlayer}
                        onClick={() => void addNewPlayer()}
                      >
                        {savingPlayer ? 'Ajout…' : 'Ajouter'}
                      </button>
                      <button className="np-cancel-btn" onClick={() => setNewOpen(false)}>
                        Annuler
                      </button>
                    </div>
                    <div className="np-new-chips">
                      {TEAMS.map((t) => (
                        <button
                          key={t.key}
                          className={`np-new-chip${newTeam === t.key ? ' active' : ''}`}
                          style={
                            newTeam === t.key
                              ? { ...teamBadgeStyle(t.key), borderColor: teamColor(t.key) }
                              : undefined
                          }
                          onClick={() => setNewTeam(t.key)}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                    {dup && (
                      <div className="np-dup">
                        <IconAlertCircle size={15} stroke={2.2} />
                        Ce joueur existe déjà — choisis-le dans la liste.
                      </div>
                    )}
                  </div>
                )}

                {loading ? (
                  <div className="np-skel">
                    {[120, 86, 104].map((w) => (
                      <div className="np-skel-row" key={w}>
                        <span className="np-skel-av" />
                        <span className="np-skel-line" style={{ width: w }} />
                      </div>
                    ))}
                    <div className="np-skel-note">Chargement…</div>
                  </div>
                ) : annuaire.length === 0 ? (
                  <div className="np-reg-empty">
                    <div className="np-reg-empty-title">Aucun joueur disponible</div>
                    <div className="np-reg-empty-sub">ajoute-en un pour commencer.</div>
                  </div>
                ) : (
                  <div className="np-reg">
                    {visible.map((r) => (
                      <button
                        className={`np-reg-row${r.status === 'alumni' ? ' ancien' : ''}`}
                        key={r.id}
                        onClick={() => add(r.id)}
                      >
                        <Avatar
                          className="np-av"
                          name={r.name}
                          team={r.team}
                          url={r.avatarUrl}
                          muted={r.status === 'alumni'}
                        />
                        <span className="np-reg-name">{r.name}</span>
                        <span className="np-poletag" style={teamBadgeStyle(r.team)}>
                          {teamLabel(r.team)}
                        </span>
                        <span className="np-elo">{r.elo}</span>
                        <span className="np-reg-add">
                          <IconPlus size={15} stroke={2.4} />
                        </span>
                      </button>
                    ))}
                    {visible.length === 0 && (
                      <div className="np-noresults">
                        <div className="np-noresults-title">Aucun joueur trouvé</div>
                        <div className="np-noresults-sub">
                          Essaie un autre nom, ou crée le joueur.
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="np-card">
            <div className="np-points">
              <div>
                <h2 className="np-card-title">Points par jeu</h2>
                <p className="np-card-desc">Le score à atteindre pour gagner un jeu.</p>
              </div>
              <div className="np-pts-controls">
                {PRESETS.map((v) => (
                  <button
                    key={v}
                    className={`np-pts-chip${autre === '' && preset === v ? ' active' : ''}`}
                    onClick={() => {
                      setPreset(v)
                      setAutre('')
                    }}
                  >
                    {v}
                  </button>
                ))}
                <label className={`np-autre${autre !== '' ? ' active' : ''}`}>
                  <span>autre</span>
                  <input
                    value={autre}
                    inputMode="numeric"
                    placeholder="—"
                    onChange={(e) => setAutre(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
                    aria-label="Autre score cible"
                  />
                </label>
              </div>
            </div>
          </section>

          <section className="np-card">
            <div className="np-chaos-head">
              <span className="np-icon-tile">
                <IconSparkles size={18} stroke={2} />
              </span>
              <div className="np-chaos-text">
                <h2 className="np-card-title">Mode chaos</h2>
                <p className="np-card-desc">
                  Des modificateurs tirés au sort pendant la partie — le fun avant la compétition.
                </p>
              </div>
              {chaos.enabled && (
                <button className="np-cfg" onClick={() => setChaosOpen((o) => !o)}>
                  {chaosOpen ? 'Masquer' : 'Configurer'}
                </button>
              )}
              <button
                role="switch"
                aria-checked={chaos.enabled}
                aria-label="Activer le mode chaos"
                className={`np-sw${chaos.enabled ? ' on' : ''}`}
                onClick={() => {
                  setChaosOpen(!chaos.enabled)
                  setChaos((c) => ({ ...c, enabled: !c.enabled }))
                }}
              >
                <span className="np-sw-knob" />
              </button>
            </div>

            {chaos.enabled && chaosOpen && (
              <div className="np-chaos-body">
                <div className="np-chaos-row">
                  <span className="np-chaos-lbl">Fréquence des tirages</span>
                  <div className="np-chaos-chips">
                    {(
                      [
                        [1, 'Chaque point'],
                        [2, 'Tous les 2'],
                        [3, 'Tous les 3'],
                      ] as const
                    ).map(([v, label]) => (
                      <button
                        key={v}
                        className={`np-chip-sm${chaos.interval === v ? ' active' : ''}`}
                        onClick={() => setChaos((c) => ({ ...c, interval: v }))}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="np-chaos-lbl">Intensité</span>
                  <div className="np-inten">
                    <button
                      className={`np-inten-card${chaos.intensity === 'mild' ? ' active' : ''}`}
                      onClick={() => setChaos((c) => ({ ...c, intensity: 'mild' }))}
                    >
                      <span className="np-inten-title">Modéré</span>
                      <span className="np-inten-desc">
                        Que des bonus. Rien de méchant, juste rigolo.
                      </span>
                    </button>
                    <button
                      className={`np-inten-card${chaos.intensity === 'full' ? ' active' : ''}`}
                      onClick={() => setChaos((c) => ({ ...c, intensity: 'full' }))}
                    >
                      <span className="np-inten-title">Chaos total</span>
                      <span className="np-inten-desc">Bonus et malus. Tout peut arriver.</span>
                    </button>
                  </div>
                </div>

                <button
                  className="np-legend"
                  aria-pressed={chaos.legendary}
                  onClick={() => setChaos((c) => ({ ...c, legendary: !c.legendary }))}
                >
                  <span className="np-legend-text">
                    <span className="np-legend-title">Modificateurs légendaires</span>
                    <span className="np-legend-desc">Rares, spectaculaires.</span>
                  </span>
                  <span className={`np-sw np-sw-sm${chaos.legendary ? ' on' : ''}`}>
                    <span className="np-sw-knob" />
                  </span>
                </button>
              </div>
            )}
          </section>

          <section className="np-card np-heure">
            <span className="np-icon-tile">
              <IconClock size={18} stroke={2} />
            </span>
            <div className="np-heure-text">
              <h2 className="np-card-title">
                Heure <span className="np-opt">optionnel · pour l’invitation</span>
              </h2>
              <p className="np-card-desc">
                L’invitation Slack part à la création ; l’heure s’affiche aussi sur l’affiche.
              </p>
            </div>
            <label className="np-field np-time">
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </label>
          </section>
        </div>

        <div className="np-rail">
          <div className="np-recap">
            <div className="np-label">Récapitulatif</div>
            <div className="np-recap-name">{recap.autoName}</div>
            <div className="np-hint-pill">
              {recap.valid ? (
                <IconCheck size={15} stroke={2.2} className="np-hint-ok" />
              ) : (
                <IconInfoCircle size={15} stroke={2.2} className="np-hint-info" />
              )}
              <span>{recap.hint}</span>
            </div>

            <div className="np-enjeu">
              <div className="np-enjeu-head">
                <div className="np-label">L’enjeu</div>
                {(isDouble || ancienSelectionne) && (
                  <span className="np-verrou">
                    <IconLock size={12} stroke={2.2} />
                    verrouillé
                  </span>
                )}
              </div>
              <div className="np-enjeu-seg">
                <button
                  className={`np-enjeu-btn${unrankedEffectif ? '' : ' active'}`}
                  disabled={isDouble || ancienSelectionne}
                  onClick={() => setUnranked(false)}
                >
                  Classée
                </button>
                <button
                  className={`np-enjeu-btn${unrankedEffectif ? ' active' : ''}`}
                  disabled={isDouble || ancienSelectionne}
                  onClick={() => setUnranked(true)}
                >
                  Non classée
                </button>
              </div>
              <div className="np-enjeu-note">
                {noteEnjeu(unrankedEffectif, isDouble, ancienSelectionne)}
              </div>
            </div>

            <div className="np-actions">
              <button
                className={`np-cta${creating ? ' busy' : recap.valid ? '' : ' off'}`}
                title={recap.valid ? undefined : recap.hint}
                onClick={create}
              >
                {creating ? 'Création…' : isGame ? 'Lancer la partie' : 'Générer le tournoi'}
              </button>
              <button
                className={`np-poster${posterBusy ? ' busy' : canPoster ? '' : ' off'}`}
                title={
                  canPoster
                    ? undefined
                    : isHasard
                      ? 'Les équipes sont tirées au sort au lancement.'
                      : 'Choisis d’abord les joueurs'
                }
                onClick={downloadPoster}
              >
                {!posterBusy && <IconDownload size={16} stroke={2.1} />}
                {posterBusy
                  ? 'Génération…'
                  : isGame
                    ? 'Télécharger le défi (PNG)'
                    : 'Télécharger l’affiche (PNG)'}
              </button>
            </div>

            <div className="np-rule">{ruleHint}</div>
          </div>
        </div>
      </div>

      <div className="np-mobile-bar">
        <div className="np-mobile-hint">{recap.hint}</div>
        <button
          className={`np-cta${creating ? ' busy' : recap.valid ? '' : ' off'}`}
          title={recap.valid ? undefined : recap.hint}
          onClick={create}
        >
          {creating ? 'Création…' : isGame ? 'Lancer la partie' : 'Générer le tournoi'}
        </button>
      </div>

      {tabbar}
    </div>
  )
}
