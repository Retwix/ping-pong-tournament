import { useEffect, useState, type ReactNode } from 'react'
import type { RaceScene, TvScene } from '../lib/tvScenes'
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

function Race({ scene, now }: { scene: RaceScene; now: Date }) {
  const { season, daysLeft, leader, chaser, gap } = scene
  const plural = gap >= 2
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
          <div className="tv-in tv-after-2 tv-race-names">
            {plural ? 'séparent' : 'sépare'} {chaser} de {leader}.
          </div>
        </div>
        <div className="tv-race-logo">Ping-Pong Recovr</div>
      </div>
      <div className="tv-race-side">
        <div className="tv-race-clock">
          <Clock now={now} />
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
