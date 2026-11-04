import { useEffect, useMemo, useState } from 'react'
import { useCurrentTournament } from '../hooks/useCurrentTournament'
import { useRatings } from '../hooks/useRatings'
import { useTournament } from '../hooks/useTournament'
import { navigate } from '../lib/router'
import { pickScene, SCENE_MS } from '../lib/tvRotation'
import { tvScenes } from '../lib/tvScenes'
import { tvMode, watchScores, type ScoreWatch } from '../lib/tvTakeover'
import LiveView from './LiveView'
import TvScreen from './TvScreen'

const CLOCK_MS = 1000

/** Backs /tv: the scenes between games, the live view while one is on. */
export default function TvView() {
  const [startedAt] = useState(() => Date.now())
  const [now, setNow] = useState(startedAt)
  useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), CLOCK_MS)
    return () => clearInterval(clock)
  }, [])

  const { id } = useCurrentTournament()
  const { tournament, matches } = useTournament(id)
  const { matches: allMatches, players, tournaments } = useRatings()

  const [watch, setWatch] = useState<ScoreWatch>({ scores: null, changedAt: null })
  useEffect(() => setWatch((w) => watchScores(w, matches, Date.now())), [matches])

  const elapsed = now - startedAt
  const turn = Math.floor(elapsed / SCENE_MS)
  const scenes = useMemo(
    () => tvScenes({ matches: allMatches, players, tournaments }, new Date()),
    [allMatches, players, tournaments, turn],
  )

  const mode = tvMode({ game: tournament, matches, scoresChangedAt: watch.changedAt, now })
  if (mode === 'live' && id) return <LiveView id={id} onBack={() => navigate('/')} />
  return <TvScreen key={turn} scene={pickScene(scenes, elapsed)} now={new Date(now)} />
}
