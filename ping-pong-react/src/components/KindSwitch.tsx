import { IconBolt, IconCrown, IconTrophy } from '@tabler/icons-react'
import type { TournamentKind } from '../types'

interface Props {
  variant: TournamentKind
  onNew: () => void
  onNewGame: () => void
  onNewKing: () => void
}

export default function KindSwitch({ variant, onNew, onNewGame, onNewKing }: Props) {
  const segment = (kind: TournamentKind, go: () => void) => ({
    className: `np-seg-btn${variant === kind ? ' active' : ''}`,
    'aria-pressed': variant === kind,
    onClick: variant === kind ? undefined : go,
  })
  return (
    <div className="np-seg">
      <button {...segment('game', onNewGame)}>
        <IconBolt size={15} stroke={2} />
        Partie rapide
      </button>
      <button {...segment('tournament', onNew)}>
        <IconTrophy size={15} stroke={2} />
        Tournoi
      </button>
      <button {...segment('king', onNewKing)}>
        <IconCrown size={15} stroke={2} />
        King of the Ping
      </button>
    </div>
  )
}
