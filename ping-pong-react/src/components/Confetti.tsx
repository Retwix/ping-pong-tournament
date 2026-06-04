import { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  w: number
  h: number
  color: string
  vx: number
  vy: number
  rot: number
  vr: number
  sway: number
}

const CONF_COLORS = ['#ff5a3c', '#2ee6a6', '#ffcf4d', '#f4f1ea', '#5aa9ff']

/** Self-contained canvas confetti burst (no dependencies). */
export default function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let particles: Particle[] = []
    const start = performance.now()

    const sizeCanvas = () => {
      canvas.width = canvas.clientWidth
      canvas.height = canvas.clientHeight
    }
    const spawn = (count: number) => {
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: -20 - Math.random() * canvas.height * 0.4,
          w: 6 + Math.random() * 7,
          h: 8 + Math.random() * 9,
          color: CONF_COLORS[(Math.random() * CONF_COLORS.length) | 0],
          vx: (Math.random() - 0.5) * 1.6,
          vy: 2 + Math.random() * 3.2,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.3,
          sway: Math.random() * Math.PI * 2,
        })
      }
    }

    sizeCanvas()
    spawn(140)

    const tick = (now: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const elapsed = now - start
      if (elapsed < 2500 && Math.random() < 0.3) spawn(8)

      for (const p of particles) {
        p.sway += 0.05
        p.x += p.vx + Math.sin(p.sway) * 0.6
        p.y += p.vy
        p.rot += p.vr
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
      }
      particles = particles.filter((p) => p.y < canvas.height + 30)

      if (particles.length || elapsed < 2500) {
        raf = requestAnimationFrame(tick)
      }
    }
    raf = requestAnimationFrame(tick)

    const onResize = () => sizeCanvas()
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return <canvas ref={canvasRef} className="confetti-canvas" />
}
