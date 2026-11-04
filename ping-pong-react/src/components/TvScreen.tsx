import { useEffect, useState } from 'react'
import type { TvScene } from '../lib/tvScenes'
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

function Ambient({ now }: { now: Date }) {
  return (
    <div className="tv-table-frame">
      <div className="tv-table">
        <div className="tv-table-line" aria-hidden="true" />
        <div className="tv-table-net" aria-hidden="true" />
        <div className="tv-rally" aria-hidden="true">
          <div className="tv-ball-shadow" />
          <div className="tv-ball tv-hop" />
        </div>
        <div className="tv-ambient-logo">Ping-Pong Recovr</div>
        <div className="tv-ambient-clock">
          <Clock now={now} />
        </div>
      </div>
    </div>
  )
}

interface Props {
  scene: TvScene | null
  now: Date
}

/** The 1920×1080 stage, scaled to whatever screen it lands on. */
export default function TvScreen({ now }: Props) {
  const scale = useStageScale()
  return (
    <div className="tv-root">
      <div className="tv-stage" style={{ transform: `scale(${scale})` }}>
        <Ambient now={now} />
      </div>
    </div>
  )
}
