/** Signed rating delta as a coloured up/down arrow (flat dash when zero). */
export default function Trend({ delta }: { delta: number }) {
  const v = Math.round(delta)
  if (v === 0) return <span className="rt-trend flat">–</span>
  const up = v > 0
  return (
    <span className={`rt-trend ${up ? 'up' : 'down'}`}>
      {up ? '▲' : '▼'} {Math.abs(v)}
    </span>
  )
}
