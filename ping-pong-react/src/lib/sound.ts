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

/**
 * The "6-7" cue. Unlike the ding above this one is a real asset, dropped into
 * `public/sounds/` — see the README there. Missing file, unsupported format or
 * a browser that has not unlocked audio yet all fail the same way: silently.
 * The scoreboard never depends on the sound having played.
 */
const SIX_SEVEN_SRC = '/sounds/six-seven.mp3'

let sixSeven: HTMLAudioElement | null = null

export function playSixSeven(): void {
  if (typeof Audio === 'undefined') return
  if (!sixSeven) {
    sixSeven = new Audio(SIX_SEVEN_SRC)
    sixSeven.preload = 'auto'
    sixSeven.volume = 0.7
  }
  try {
    // Rewind so a re-score (undo → re-tap) plays it again from the start.
    sixSeven.currentTime = 0
  } catch {
    /* not seekable yet — play from wherever it is */
  }
  void sixSeven.play().catch(() => {
    /* no file, or autoplay still blocked */
  })
}
