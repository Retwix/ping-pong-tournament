// Builds branded, downloadable announcement cards (SVG) generated at creation
// time. Two variants: a tournament announcement and a quick-game challenge.
// Pure string builders — no DOM, no React — so they're easy to test/rasterise.

const SIZE = 1080
const CX = SIZE / 2
const FONT_DISPLAY = "Outfit, 'Segoe UI', system-ui, sans-serif"
const FONT_BODY = "'DM Sans', 'Segoe UI', system-ui, sans-serif"
const CORAL = '#ff8893'

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function estW(text: string, size: number, factor: number): number {
  return text.length * size * factor
}

function trunc(text: string, maxChars: number): string {
  return text.length > maxChars ? `${text.slice(0, maxChars - 1).trimEnd()}…` : text
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function enDate(date: Date): string {
  return cap(
    date.toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  )
}

/** Date badge text, optionally with an "HH:MM" time appended ("… · 14:30"). */
function whenBadge(date: Date, time?: string): string {
  const d = enDate(date)
  const t = time?.trim()
  return t ? `${d} · ${t}` : d
}

/** Greedy word wrap into at most `maxLines` lines that fit `maxW`. */
function wrap(text: string, maxW: number, size: number, factor: number, maxLines: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (estW(next, size, factor) > maxW && cur) {
      lines.push(cur)
      cur = w
    } else {
      cur = next
    }
  }
  if (cur) lines.push(cur)
  if (lines.length > maxLines) {
    lines[maxLines - 1] = trunc(lines.slice(maxLines - 1).join(' '), Math.floor(maxW / (size * factor)))
    lines.length = maxLines
  }
  return lines
}

export interface PosterResult {
  svg: string
  width: number
  height: number
}

interface CardLine {
  text: string
  size: number
  weight: number
  color: string
  italic?: boolean
  spacing?: number
}

interface CardSpec {
  eyebrow: string
  lines: CardLine[]
  badges: string[]
  tagline?: string
}

function pill(text: string, cy: number): { svg: string; width: number; render: (x: number) => string } {
  const size = 28
  const w = estW(text, size, 0.54) + 64
  const h = 64
  const render = (x: number) =>
    `<rect x="${x}" y="${cy - h / 2}" width="${Math.round(w)}" height="${h}" rx="${h / 2}" fill="#ffffff" fill-opacity="0.14" stroke="#ffffff" stroke-opacity="0.45"/>` +
    `<text x="${x + w / 2}" y="${cy + size / 2 - 4}" text-anchor="middle" font-family="${FONT_BODY}" font-size="${size}" font-weight="500" fill="#ffffff">${esc(text)}</text>`
  return { svg: '', width: w, render }
}

function buildCardSvg(spec: CardSpec, fontCss: string): PosterResult {
  // Measure the stacked content to vertically centre it.
  const ebSize = 28
  const ebGap = 50
  const lineGap = 12
  const beforeBadges = 78
  const badgeH = 64
  const taglineGap = 56
  const taglineSize = 30

  let contentH = ebSize + ebGap
  for (const ln of spec.lines) contentH += ln.size + lineGap
  contentH += beforeBadges + badgeH
  if (spec.tagline) contentH += taglineGap + taglineSize

  const parts: string[] = []
  let y = (SIZE - contentH) / 2 + ebSize

  // Eyebrow
  parts.push(
    `<text x="${CX}" y="${y}" text-anchor="middle" font-family="${FONT_DISPLAY}" font-size="${ebSize}" font-weight="600" letter-spacing="5" fill="${CORAL}">${esc(spec.eyebrow)}</text>`
  )
  y += ebGap

  // Headline lines
  for (const ln of spec.lines) {
    y += ln.size
    const style = ln.italic ? ' font-style="italic"' : ''
    const sp = ln.spacing ? ` letter-spacing="${ln.spacing}"` : ''
    parts.push(
      `<text x="${CX}" y="${y}" text-anchor="middle" font-family="${FONT_DISPLAY}" font-size="${ln.size}" font-weight="${ln.weight}"${style}${sp} fill="${ln.color}">${esc(ln.text)}</text>`
    )
    y += lineGap
  }
  y += beforeBadges - lineGap

  // Badges row (centred)
  const badgeGap = 20
  const pills = spec.badges.map((b) => pill(b, y))
  const totalW = pills.reduce((s, p) => s + p.width, 0) + badgeGap * (pills.length - 1)
  let bx = CX - totalW / 2
  for (const p of pills) {
    parts.push(p.render(bx))
    bx += p.width + badgeGap
  }
  y += badgeH / 2

  // Tagline
  if (spec.tagline) {
    y += taglineGap
    parts.push(
      `<text x="${CX}" y="${y}" text-anchor="middle" font-family="${FONT_BODY}" font-size="${taglineSize}" font-weight="500" font-style="italic" fill="#ffffff" fill-opacity="0.9">${esc(spec.tagline)}</text>`
    )
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">` +
    `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="#3a2080"/><stop offset="1" stop-color="#6f4bd6"/>` +
    `</linearGradient></defs>` +
    (fontCss ? `<style>${fontCss}</style>` : '') +
    `<rect x="0" y="0" width="${SIZE}" height="${SIZE}" fill="url(#bg)"/>` +
    // Decorative balls
    `<circle cx="${SIZE - 80}" cy="90" r="150" fill="#ffffff" opacity="0.05"/>` +
    `<circle cx="70" cy="${SIZE - 70}" r="110" fill="#ffffff" opacity="0.05"/>` +
    parts.join('') +
    `</svg>`

  return { svg, width: SIZE, height: SIZE }
}

/** Tournament announcement: it's a tournament, the date, and the points per game. */
export function buildTournamentPosterSvg(
  opts: { name: string; target: number; date?: Date; time?: string },
  fontCss = ''
): PosterResult {
  const title = opts.name.trim() || 'Ping-pong tournament'
  const size = estW(title, 88, 0.56) > SIZE - 180 ? 64 : 88
  const lines = wrap(title, SIZE - 180, size, 0.56, 2).map<CardLine>((text) => ({
    text,
    size,
    weight: 800,
    color: '#ffffff',
  }))
  return buildCardSvg(
    {
      eyebrow: 'PING-PONG TOURNAMENT',
      lines,
      badges: [whenBadge(opts.date ?? new Date(), opts.time), `Game to ${opts.target} points`],
    },
    fontCss
  )
}

/** Quick-game challenge card to send to an opponent. */
export function buildChallengePosterSvg(
  opts: { playerA: string; playerB: string; target: number; date?: Date; time?: string },
  fontCss = ''
): PosterResult {
  const a = trunc(opts.playerA.trim() || 'Player 1', 18)
  const b = trunc(opts.playerB.trim() || 'Player 2', 18)
  const nameSize = Math.max(a.length, b.length) > 12 ? 72 : 92
  return buildCardSvg(
    {
      eyebrow: 'PING-PONG CHALLENGE',
      lines: [
        { text: a, size: nameSize, weight: 800, color: '#ffffff' },
        { text: 'vs', size: 44, weight: 700, color: CORAL, italic: true },
        { text: b, size: nameSize, weight: 800, color: '#ffffff' },
      ],
      badges: [whenBadge(opts.date ?? new Date(), opts.time), `Game to ${opts.target} points`],
      tagline: 'Will you take up the challenge?',
    },
    fontCss
  )
}
