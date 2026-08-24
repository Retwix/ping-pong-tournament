const ASPECT_WIDTH = 40
const ASPECT_HEIGHT = 53
const COMPACT_MAX_HEIGHT = 48

export type LoaderSizing = {
  readonly width: number
  readonly height: number
  readonly compact: boolean
}

export const loaderSizing = (height: number): LoaderSizing => ({
  width: Math.round((height * ASPECT_WIDTH) / ASPECT_HEIGHT),
  height,
  compact: height <= COMPACT_MAX_HEIGHT,
})
