import { IconBolt, IconTrophy } from '@tabler/icons-react'
import type { TournamentKind } from '../types'

interface Props {
  variant: TournamentKind
  onNew: () => void
  onNewGame: () => void
}

export default function KindSwitch({ variant, onNew, onNewGame }: Props) {
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
    </div>
  )
}
