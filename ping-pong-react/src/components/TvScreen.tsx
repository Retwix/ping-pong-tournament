import { useEffect, useState, type ReactNode } from 'react'
import type { FormScene, RaceLine, RaceScene, ResultsScene, TvScene } from '../lib/tvScenes'
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

function Masthead({ now }: { now: Date }) {
  return (
    <div className="tvs-masthead">
      <span className="tvs-masthead-logo">Ping-Pong Recovr</span>
      <Clock now={now} />
    </div>
  )
}

const FORM_NAME_FITS = 18
const STAIR_STEPS = 5
const STEP_WIDTH = 212
const STEP_RISE = 150
const STAIR_LEFT = 860
const BALL_SIZE = 44
const STAGE_BALL_FLOOR = STAGE_HEIGHT - BALL_SIZE
const LANDING_PERCENT = 12
const LAST_BOUNCE_PERCENT = 80

const stepLeft = (position: number) => STAIR_LEFT + STEP_WIDTH * position
const stepHeight = (position: number) => STEP_RISE * (position + 1)
const ballAt = (position: number) => ({
  x: stepLeft(position) + (STEP_WIDTH - BALL_SIZE) / 2,
  y: STAGE_BALL_FLOOR - stepHeight(position),
})

const frame = (percent: number, x: number, y: number, easing: string) =>
  `${percent}% { transform: translate(${x}px, ${y}px); animation-timing-function: ${easing}; }`

/** The ball's path over however many steps were won; the board only drew five. */
function climbKeyframes(firstPosition: number): string {
  const positions = Array.from(
    { length: STAIR_STEPS - firstPosition },
    (_, i) => firstPosition + i,
  )
  const start = ballAt(firstPosition)
  const top = ballAt(STAIR_STEPS - 1)
  const landings = positions.slice(1).flatMap((position, i) => {
    const from = ballAt(position - 1)
    const to = ballAt(position)
    const landed = 8 + LANDING_PERCENT * (i + 1)
    return [
      frame(landed - 6, (from.x + to.x) / 2, from.y - 246, 'ease-in'),
      frame(landed, to.x, to.y, 'ease-out'),
    ]
  })
  const lastLanding = 8 + LANDING_PERCENT * (positions.length - 1)
  const bounces = Array.from(
    { length: Math.floor((LAST_BOUNCE_PERCENT - lastLanding) / LANDING_PERCENT) },
    (_, i) => lastLanding + LANDING_PERCENT * (i + 1),
  ).flatMap((landed) => [
    frame(landed - 6, top.x, top.y - 70, 'ease-in'),
    frame(landed, top.x, top.y, 'ease-out'),
  ])
  return `@keyframes tvs-climb {
    ${frame(0, start.x, -80, 'ease-in')}
    ${frame(8, start.x, start.y, 'ease-out')}
    ${landings.join(' ')}
    ${bounces.join(' ')}
    ${frame(88, 1960, 200, 'ease-in')}
    96%, 100% { transform: translate(2000px, 1150px); }
  }`
}

function Stair({ beaten }: { beaten: string[] }) {
  const firstPosition = STAIR_STEPS - beaten.length
  return (
    <>
      <style>{climbKeyframes(firstPosition)}</style>
      {beaten.map((name, i) => (
        <div
          key={i}
          className={`tvs-step tvs-step-${firstPosition + i}`}
          style={{ left: stepLeft(firstPosition + i), height: stepHeight(firstPosition + i) }}
        >
          <div className="tvs-step-lit" style={{ animationDelay: `${2.4 * i}s` }} aria-hidden="true" />
          <div className="tvs-step-name">{name}</div>
        </div>
      ))}
      <div className="tvs-climb" aria-hidden="true" />
    </>
  )
}

function Form({ scene, now }: { scene: FormScene; now: Date }) {
  const { name, streak, beaten, risers, upset } = scene
  return (
    <div className="tvs-form">
      <Stair beaten={beaten} />
      <div className="tvs-in tvs-kicker tvs-form-kicker">En forme · cette semaine</div>
      <Masthead now={now} />
      <div className="tvs-form-story">
        <div className="tvs-in tvs-after-1 tvs-form-streak">
          <span className="tvs-form-count">{streak}</span>
          <span className="tvs-form-unit">
            victoires
            <br />
            de suite
          </span>
        </div>
        <div className={`tvs-in tvs-after-2 tvs-form-name${name.length > FORM_NAME_FITS ? ' tvs-form-name-long' : ''}`}>
          pour {name}.
        </div>
        {risers.length > 0 && (
          <div className="tvs-in tvs-after-3 tvs-form-fact">
            <div className="tvs-form-label">Plus fortes hausses</div>
            <div className="tvs-form-line">
              {risers.map(({ name, delta }) => `${name} ▲ ${delta}`).join(' · ')}
            </div>
          </div>
        )}
        {upset && (
          <div className="tvs-in tvs-after-4 tvs-form-fact">
            <div className="tvs-form-label">Exploit de la semaine</div>
            <div className="tvs-form-line">
              {upset.winner} bat {upset.loser} <span className="tvs-form-gain">+{upset.gain}</span>
            </div>
          </div>
        )}
      </div>
      <Progress />
    </div>
  )
}

function Results({ scene, now }: { scene: ResultsScene; now: Date }) {
  const { headline, stamped } = scene
  const { winner, loser, score } = headline
  return (
    <div className="tvs-results">
      <div className="tvs-in tvs-kicker tvs-results-kicker">Derniers résultats</div>
      <Masthead now={now} />
      <div className={`tvs-results-story${stamped ? ' tvs-shake' : ''}`}>
        <div className="tvs-in tvs-after-1 tvs-results-score">{score}</div>
        {stamped && <div className="tvs-in tvs-after-2 tvs-results-title">Balla di capot</div>}
        <div className={`tvs-in tvs-after-3 ${stamped ? 'tvs-results-names' : 'tvs-results-title'}`}>
          {winner} sur {loser}.
        </div>
        {stamped && (
          <div className="tvs-stamp-tilt">
            <div className="tvs-stamp">CAPOT</div>
          </div>
        )}
      </div>
      <Progress />
    </div>
  )
}

function Scene({ scene, now }: Props) {
  if (scene?.kind === 'race') return <Race scene={scene} now={now} />
  if (scene?.kind === 'form') return <Form scene={scene} now={now} />
  if (scene?.kind === 'results') return <Results scene={scene} now={now} />
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
