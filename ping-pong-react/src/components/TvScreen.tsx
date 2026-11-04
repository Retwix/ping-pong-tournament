import { useEffect, useState, type ReactNode } from 'react'
import type { RaceLine, RaceScene, TvScene } from '../lib/tvScenes'
import './tv.css'

const STAGE_WIDTH = 1920
const STAGE_HEIGHT = 1080

const fitStage = () =>
  Math.min(window.innerWidth / STAGE_WIDTH, window.innerHeight / STAGE_HEIGHT)

function useStageScale(): number {
  const [scale, setScale] = useState(fitStage)
  useEffect(() => {
    const onResize = () => setScale(fitStage())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return scale
}

function Clock({ now }: { now: Date }) {
  const [hours, minutes] = now
    .toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    .split(':')
  return (
    <span className="tvs-clock">
      {hours}
      <span className="tvs-tick">:</span>
      {minutes}
    </span>
  )
}

function Table({ children }: { children: ReactNode }) {
  return (
    <div className="tvs-table-frame">
      <div className="tvs-table">
        <div className="tvs-table-line" aria-hidden="true" />
        <div className="tvs-table-net" aria-hidden="true" />
        <div className="tvs-rally" aria-hidden="true">
          <div className="tvs-ball-shadow" />
          <div className="tvs-ball tvs-hop" />
        </div>
        {children}
      </div>
    </div>
  )
}

function Ambient({ now }: { now: Date }) {
  return (
    <Table>
      <div className="tvs-ambient-logo">Ping-Pong Recovr</div>
      <div className="tvs-ambient-clock">
        <Clock now={now} />
      </div>
    </Table>
  )
}

function Progress() {
  return <div className="tvs-progress" aria-hidden="true" />
}

const RACE_MARKS = ['tvs-mark-leader', 'tvs-mark-chaser']
const RACE_NAMES_FIT = 30

function RaceRow({ line, index }: { line: RaceLine; index: number }) {
  const { rank, name, rating, trend } = line
  const tone = trend < 0 ? 'tvs-trend-down' : 'tvs-trend-up'
  return (
    <div className="tvs-in tvs-race-line" style={{ animationDelay: `${0.8 + 0.15 * index}s` }}>
      <div className={`tvs-race-mark ${RACE_MARKS[index] ?? ''}`} aria-hidden="true" />
      <div className="tvs-race-row">
        <span className="tvs-race-rank">{rank}</span>
        <span className="tvs-race-name">{name}</span>
        <span className="tvs-race-rating">{rating}</span>
        <span className={`tvs-race-trend ${tone}`}>
          {trend !== 0 && `${trend < 0 ? '▼' : '▲'} ${Math.abs(trend)}`}
        </span>
      </div>
    </div>
  )
}

function Race({ scene, now }: { scene: RaceScene; now: Date }) {
  const { season, daysLeft, leader, chaser, gap, ladder } = scene
  const plural = gap >= 2
  const longNames = chaser.length + leader.length > RACE_NAMES_FIT
  return (
    <Table>
      <div className="tvs-race-story">
        <div className="tvs-in tvs-race-kicker">
          {season} · J-{daysLeft}
        </div>
        <div className="tvs-race-headline">
          <div className="tvs-in tvs-after-1">
            <div className={`tvs-pulse tvs-race-gap${gap >= 100 ? ' tvs-race-gap-wide' : ''}`}>
              <span className="tvs-race-gap-number">{gap}</span>
              <span className="tvs-race-gap-unit">{plural ? 'points' : 'point'}</span>
            </div>
          </div>
          <div className={`tvs-in tvs-after-2 tvs-race-names${longNames ? ' tvs-race-names-long' : ''}`}>
            {plural ? 'séparent' : 'sépare'} {chaser} de {leader}.
          </div>
        </div>
        <div className="tvs-race-logo">Ping-Pong Recovr</div>
      </div>
      <div className="tvs-race-side">
        <div className="tvs-race-clock">
          <Clock now={now} />
        </div>
        <div className="tvs-race-ladder">
          {ladder.map((line, index) => (
            <RaceRow key={line.rank} line={line} index={index} />
          ))}
        </div>
      </div>
      <Progress />
    </Table>
  )
}

function Scene({ scene, now }: Props) {
  if (scene?.kind === 'race') return <Race scene={scene} now={now} />
  return <Ambient now={now} />
}

interface Props {
  scene: TvScene | null
  now: Date
}

/** The 1920×1080 stage, scaled to whatever screen it lands on. */
export default function TvScreen({ scene, now }: Props) {
  const scale = useStageScale()
  return (
    <div className="tvs-root">
      <div className="tvs-stage" style={{ transform: `scale(${scale})` }}>
        <Scene scene={scene} now={now} />
      </div>
    </div>
  )
}
