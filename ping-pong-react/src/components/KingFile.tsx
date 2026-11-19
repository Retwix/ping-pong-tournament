import { useId } from 'react'
import { joinFile, leaveFile, type Rotation } from '../lib/king'

interface Props {
  rotation: Rotation
  players: ReadonlyArray<string>
  onRotation: (rotation: Rotation) => void
}

/** The File of a King of the Ping session, editable: « ✕ » to step out, a picker to join at the back. */
export default function KingFile({ rotation, players, onRotation }: Props) {
  const labelId = useId()
  const file = rotation.slice(2)
  const arrivals = players.filter((name) => !rotation.includes(name))

  return (
    <>
      {file.length > 0 && (
        <div className="ks-file">
          <div className="ks-label" id={labelId}>
            File
          </div>
          <ol aria-labelledby={labelId}>
            {file.map((name) => (
              <li key={name}>
                {name}
                <button
                  className="ks-file-leave"
                  aria-label={`Retirer ${name}`}
                  onClick={() => onRotation(leaveFile(rotation, name))}
                >
                  ✕
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}

      <select
        className="ks-join"
        aria-label="Ajouter à la File"
        value=""
        onChange={(e) => onRotation(joinFile(rotation, e.target.value))}
      >
        <option value="">+ Ajouter à la File</option>
        {arrivals.map((name) => (
          <option key={name}>{name}</option>
        ))}
      </select>
    </>
  )
}
