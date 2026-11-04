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
    <span className="tv-clock">
      {hours}
      <span className="tv-tick">:</span>
      {minutes}
    </span>
  )
}

function Table({ children }: { children: ReactNode }) {
  return (
    <div className="tv-table-frame">
      <div className="tv-table">
        <div className="tv-table-line" aria-hidden="true" />
        <div className="tv-table-net" aria-hidden="true" />
        <div className="tv-rally" aria-hidden="true">
          <div className="tv-ball-shadow" />
          <div className="tv-ball tv-hop" />
        </div>
        {children}
      </div>
    </div>
  )
}

function Ambient({ now }: { now: Date }) {
  return (
    <Table>
      <div className="tv-ambient-logo">Ping-Pong Recovr</div>
      <div className="tv-ambient-clock">
        <Clock now={now} />
      </div>
    </Table>
  )
}

function Progress() {
  return <div className="tv-progress" aria-hidden="true" />
}

const RACE_MARKS = ['tv-mark-leader', 'tv-mark-chaser']
const RACE_NAMES_FIT = 30

function RaceRow({ line, index }: { line: RaceLine; index: number }) {
  const { rank, name, rating, trend } = line
  const tone = trend < 0 ? 'tv-trend-down' : 'tv-trend-up'
  return (
    <div className="tv-in tv-race-line" style={{ animationDelay: `${0.8 + 0.15 * index}s` }}>
      <div className={`tv-race-mark ${RACE_MARKS[index] ?? ''}`} aria-hidden="true" />
      <div className="tv-race-row">
        <span className="tv-race-rank">{rank}</span>
        <span className="tv-race-name">{name}</span>
        <span className="tv-race-rating">{rating}</span>
        <span className={`tv-race-trend ${tone}`}>
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
      <div className="tv-race-story">
        <div className="tv-in tv-race-kicker">
          {season} · J-{daysLeft}
        </div>
        <div className="tv-race-headline">
          <div className="tv-in tv-after-1">
            <div className={`tv-pulse tv-race-gap${gap >= 100 ? ' tv-race-gap-wide' : ''}`}>
              <span className="tv-race-gap-number">{gap}</span>
              <span className="tv-race-gap-unit">{plural ? 'points' : 'point'}</span>
            </div>
          </div>
          <div className={`tv-in tv-after-2 tv-race-names${longNames ? ' tv-race-names-long' : ''}`}>
            {plural ? 'séparent' : 'sépare'} {chaser} de {leader}.
          </div>
        </div>
        <div className="tv-race-logo">Ping-Pong Recovr</div>
      </div>
      <div className="tv-race-side">
        <div className="tv-race-clock">
          <Clock now={now} />
        </div>
        <div className="tv-race-ladder">
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
    <div className="tv-root">
      <div className="tv-stage" style={{ transform: `scale(${scale})` }}>
        <Scene scene={scene} now={now} />
      </div>
    </div>
  )
}
