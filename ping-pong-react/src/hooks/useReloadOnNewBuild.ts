import { useEffect } from 'react'

const CHECK_MS = 5 * 60_000

const entryScript = (page: Document) =>
  page.querySelector('script[type="module"][src]')?.getAttribute('src')

async function deployedEntry() {
  const response = await fetch(location.pathname, { cache: 'no-store' })
  return entryScript(new DOMParser().parseFromString(await response.text(), 'text/html'))
}

/** Reloads once another build is deployed. A failed check just waits for the next one. */
export function useReloadOnNewBuild(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const check = () =>
      deployedEntry()
        .then((entry) => {
          if (entry && entry !== entryScript(document)) location.reload()
        })
        .catch(() => {})
    const timer = setInterval(check, CHECK_MS)
    return () => clearInterval(timer)
  }, [enabled])
}
