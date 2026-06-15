// Tiny Web Audio "ding" — no asset files, synthesized on the fly.

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext }

let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext || (window as WebkitWindow).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** Short, soft bell-like "ding". Safe to call rapidly. */
export function playDing(): void {
  const c = getCtx()
  if (!c) return
  const now = c.currentTime

  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(1318.5, now) // E6
  osc.frequency.exponentialRampToValueAtTime(1244.5, now + 0.18)

  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.16, now + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.33)

  osc.connect(gain).connect(c.destination)
  osc.start(now)
  osc.stop(now + 0.36)
}
