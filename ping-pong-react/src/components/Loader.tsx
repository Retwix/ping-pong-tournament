import { loaderSizing } from '../lib/loader'

type LoaderProps = {
  readonly height?: number
  readonly caption?: string | null
  readonly label?: string
}

export function Loader({ height = 120, caption = 'Chargement…', label = 'Chargement en cours' }: LoaderProps) {
  const { width, compact } = loaderSizing(height)
  return (
    <div className="rv-loader-wrap">
      <svg
        className="rv-loader"
        width={width}
        height={height}
        viewBox="-5 -19 40 53"
        fill="none"
        role="img"
        aria-label={label}
        data-size={compact ? 'sm' : undefined}
      >
        <g className="rv-a rv-shadow-x">
          <ellipse className="rv-a rv-shadow rv-fx" cx="15" cy="30" rx="7" ry="1.7" />
        </g>
        <g className="rv-a rv-carriage">
          <g className="rv-a rv-stroke">
            <g className="rv-a rv-tilt">
              <g className="rv-a rv-flip">
                <g className="rv-a rv-face-a">
                  <ellipse className="rv-edge" cx="15" cy="17.9" rx="7.6" ry="4.8" />
                  <ellipse className="rv-paddle" cx="15" cy="16.8" rx="7.6" ry="4.8" />
                  <ellipse className="rv-rim" cx="15" cy="16.8" rx="7.6" ry="4.8" fill="none" />
                  <ellipse className="rv-face" cx="15" cy="16.3" rx="6" ry="3.5" />
                </g>
                <g className="rv-a rv-face-b">
                  <ellipse className="rv-edge-b" cx="15" cy="17.9" rx="7.6" ry="4.8" />
                  <ellipse className="rv-paddle-b" cx="15" cy="16.8" rx="7.6" ry="4.8" />
                  <ellipse className="rv-rim" cx="15" cy="16.8" rx="7.6" ry="4.8" fill="none" />
                  <ellipse className="rv-face" cx="15" cy="16.3" rx="6" ry="3.5" />
                </g>
              </g>
              <rect className="rv-handle" x="13.4" y="20.4" width="3.2" height="7.4" rx="1.6" />
            </g>
          </g>
        </g>
        <circle className="rv-a rv-ring rv-ring-a rv-fx" cx="5.9" cy="11.39" r="3.4" fill="none" strokeWidth="0.5" />
        <circle className="rv-a rv-ring rv-ring-b rv-fx" cx="24.1" cy="11.39" r="3.4" fill="none" strokeWidth="0.5" />
        <g className="rv-a rv-ball-x">
          <g className="rv-a rv-ball-y">
            <g className="rv-a rv-squash">
              <g className="rv-a rv-spin">
                <circle className="rv-ball" cx="15" cy="11.39" r="2.9" />
                <circle cx="16" cy="10.39" r="0.7" fill="#FFFFFF" opacity="0.6" />
              </g>
            </g>
          </g>
        </g>
      </svg>
      {caption ? <div className="rv-loader-caption">{caption}</div> : null}
    </div>
  )
}
