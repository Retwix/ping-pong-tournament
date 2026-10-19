type ScrollableWindow = {
  readonly scrollY: number
  scrollTo: (options: { top: number }) => void
  addEventListener: (type: 'resize', listener: () => void) => void
}

export const unstickScrollOnResize = (win: ScrollableWindow) => {
  win.addEventListener('resize', () => {
    if (win.scrollY < 0) win.scrollTo({ top: 0 })
  })
}
