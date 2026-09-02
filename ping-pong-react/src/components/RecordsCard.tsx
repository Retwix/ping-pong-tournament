import { useMemo, useState } from 'react'
import { IconFlame, IconTrendingUp } from '@tabler/icons-react'
import { useRatings } from '../hooks/useRatings'
import { capotList, dashboardRecords } from '../lib/dashboardRecords'
import { individualMatches } from '../lib/doubles'
import { signed } from '../lib/format'
import { defaultLadderScope } from '../lib/seasons'
import { computePlayerStats } from '../lib/stats'
import CapotsModal from './CapotsModal'

/**
 * Dashboard "Séries & records" — flavor chips for the current win streak,
 * biggest upset, capots count, and most active player. Each field is
 * independently nullable so the card degrades gracefully when data is thin.
 */
export default function RecordsCard() {
  const { matches, players, historyEvents, tournaments } = useRatings(
    defaultLadderScope(new Date()),
  )
  const [capotsOpen, setCapotsOpen] = useState(false)
  const individuels = individualMatches(matches, tournaments)
  const stats = computePlayerStats(individuels, players)
  const rec = dashboardRecords(stats, individuels, historyEvents)
  const capots = useMemo(
    () => capotList(individuels, tournaments, new Date()),
    [matches, tournaments],
  )

  const isEmpty = !rec.topStreak && !rec.biggestUpset && !rec.mostActive && rec.capots === 0

  return (
    <div className="rv-card">
      <div className="rv-card-title">Séries &amp; records</div>
      {isEmpty ? (
        <div className="empty">Les records arrivent après quelques matchs.</div>
      ) : (
        <div className="rv-records-list">
          {rec.topStreak && (
            <div className="rv-record-chip rv-record-chip-flame">
              <IconFlame size={18} stroke={1.75} />
              <span>
                {rec.topStreak.name} · {rec.topStreak.streak} victoires d'affilée
              </span>
            </div>
          )}
          {rec.biggestUpset && (
            <div className="rv-record-chip rv-record-chip-trend">
              <IconTrendingUp size={18} stroke={1.75} />
              <span>
                {rec.biggestUpset.winner} a battu {rec.biggestUpset.loser} ·{' '}
                {signed(rec.biggestUpset.gain)} Elo
              </span>
            </div>
          )}
          {(rec.capots > 0 || rec.mostActive) && (
            <div className="rv-record-tiles">
              {rec.capots > 0 && (
                <button
                  type="button"
                  className="rv-record-tile rv-record-tile--action"
                  onClick={() => setCapotsOpen(true)}
                  title="Voir les capots"
                >
                  <span className="rv-record-tile-value">{rec.capots}</span>
                  <span className="rv-record-tile-label">capots</span>
                </button>
              )}
              {rec.mostActive && (
                <div className="rv-record-tile">
                  <span className="rv-record-tile-value">{rec.mostActive.name}</span>
                  <span className="rv-record-tile-label">{rec.mostActive.played} matchs</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {capotsOpen && <CapotsModal capots={capots} onClose={() => setCapotsOpen(false)} />}
    </div>
  )
}
