// Client-side SVG → PNG export, with Google fonts inlined as base64 so the
// rendered image keeps the app's branding (canvas can't load external fonts).

const FONT_CSS_URL =
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Outfit:wght@500;600;700;800&display=swap'

let fontCssCache: string | null = null

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

async function toFontDataUri(url: string): Promise<string> {
  const res = await fetch(url)
  const buf = await res.arrayBuffer()
  return `data:font/woff2;base64,${bufferToBase64(buf)}`
}

/**
 * Fetches the Google Fonts stylesheet and rewrites every woff2 URL to an inline
 * base64 data URI. Returns a <style>-ready CSS string, or '' if anything fails
 * (the SVG then falls back to its system-font stack). Cached after first call.
 */
export async function getEmbeddedFontCss(): Promise<string> {
  if (fontCssCache !== null) return fontCssCache
  try {
    const css = await (await fetch(FONT_CSS_URL)).text()
    const urlRe = /url\((https:\/\/fonts\.gstatic\.com[^)]+\.woff2)\)/g
    const urls = [...new Set([...css.matchAll(urlRe)].map((m) => m[1]))]
    const map = new Map<string, string>()
    await Promise.all(urls.map(async (u) => map.set(u, await toFontDataUri(u))))
    fontCssCache = css.replace(urlRe, (_full, u: string) => `url(${map.get(u) ?? u})`)
  } catch {
    fontCssCache = ''
  }
  return fontCssCache
}

/** Rasterises an SVG string to a PNG Blob at the given pixel scale. */
export async function svgToPngBlob(
  svg: string,
  width: number,
  height: number,
  scale = 2
): Promise<Blob> {
  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)
  try {
    const img = new Image()
    img.decoding = 'async'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Impossible de charger le SVG'))
      img.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas non disponible')
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
    if (!blob) throw new Error('Encodage PNG échoué')
    return blob
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Triggers a browser download of a Blob under the given filename. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke on the next tick so the download has a chance to start.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
