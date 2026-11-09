import { useEffect, useMemo, useState } from 'react'
import { useCurrentTournament } from '../hooks/useCurrentTournament'
import { useRatings } from '../hooks/useRatings'
import { useReloadOnNewBuild } from '../hooks/useReloadOnNewBuild'
import { useTournament } from '../hooks/useTournament'
import { navigate } from '../lib/router'
import { pickScene, SCENE_MS } from '../lib/tvRotation'
import { tvScenes } from '../lib/tvScenes'
import { tvMode, watchScores, type ScoreWatch } from '../lib/tvTakeover'
import LiveView from './LiveView'
import TvScreen from './TvScreen'

const CLOCK_MS = 1000
const ACTIVE_GAME_POLL_MS = 30_000
const SCENE_DATA_REFRESH_MS = 5 * 60_000

/** The scene rotation, from its first scene, on data loaded only while it shows. */
function Screensaver({ now }: { now: number }) {
  const [startedAt] = useState(now)
  const { matches, players, tournaments, reload } = useRatings()
  useEffect(() => {
    const refresh = setInterval(reload, SCENE_DATA_REFRESH_MS)
    return () => clearInterval(refresh)
  }, [reload])

  const elapsed = now - startedAt
  const turn = Math.floor(elapsed / SCENE_MS)
  const scenes = useMemo(
    () => tvScenes({ matches, players, tournaments }, new Date()),
    [matches, players, tournaments, turn],
  )

  return <TvScreen key={turn} scene={pickScene(scenes, elapsed, startedAt)} now={new Date(now)} />
}

/** Backs /tv: the scenes between games, the live view while one is on. */
export default function TvView() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), CLOCK_MS)
    return () => clearInterval(clock)
  }, [])

  const { id } = useCurrentTournament(ACTIVE_GAME_POLL_MS)
  const { tournament, matches } = useTournament(id)

  const [watch, setWatch] = useState<ScoreWatch>({ scores: null, changedAt: null })
  useEffect(() => setWatch((w) => watchScores(w, matches, Date.now())), [matches])

  const mode = tvMode({ game: tournament, matches, scoresChangedAt: watch.changedAt, now })
  useReloadOnNewBuild(mode === 'screensaver')
  if (mode === 'live' && id) return <LiveView id={id} onBack={() => navigate('/')} />
  return <Screensaver now={now} />
}
