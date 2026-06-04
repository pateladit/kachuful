import { useState, useRef, useEffect } from 'react'

const V = {
  surface: 'var(--color-surface, #3d2330)',
  muted:   'var(--color-muted, #9b7c6b)',
  line:    'var(--color-line, #5a3445)',
  accent2: 'var(--color-accent-2, #d24a3d)',
}

const SIZE = 36
const R    = 13
const CIRC = 2 * Math.PI * R
const HOLD_DURATION = 1200

export default function HoldToEndButton({ onEndGame }) {
  const [holding, setHolding]   = useState(false)
  const [progress, setProgress] = useState(0)
  const rafRef   = useRef(null)
  const startRef = useRef(null)

  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  function startHold() {
    cancelAnimationFrame(rafRef.current)
    setHolding(true)
    startRef.current = Date.now()
    function tick() {
      const pct = Math.min(100, ((Date.now() - startRef.current) / HOLD_DURATION) * 100)
      setProgress(pct)
      if (pct < 100) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        setHolding(false)
        setProgress(0)
        onEndGame()
      }
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  function cancelHold() {
    cancelAnimationFrame(rafRef.current)
    setHolding(false)
    setProgress(0)
  }

  const dash = (progress / 100) * CIRC

  return (
    <button
      className="game-icon-btn"
      onMouseDown={startHold}
      onMouseUp={cancelHold}
      onMouseLeave={cancelHold}
      onTouchStart={e => { e.preventDefault(); startHold() }}
      onTouchEnd={cancelHold}
      onTouchCancel={cancelHold}
      aria-label="Hold to end game"
      title="Hold to end game"
      style={{
        position: 'relative',
        width: SIZE, height: SIZE,
        borderRadius: 10,
        background: holding
          ? `color-mix(in oklab, ${V.accent2} 14%, ${V.surface})`
          : V.surface,
        border: `1px solid ${holding
          ? `color-mix(in oklab, ${V.accent2} 50%, ${V.line})`
          : V.line}`,
        cursor: 'pointer',
        display: 'grid',
        placeItems: 'center',
        transition: 'background .15s ease, border-color .15s ease',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'manipulation',
        flexShrink: 0,
      }}
    >
      <svg
        width={SIZE} height={SIZE}
        style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)', pointerEvents: 'none' }}
        aria-hidden
      >
        <circle
          cx={SIZE / 2} cy={SIZE / 2} r={R}
          fill="none"
          stroke={V.accent2}
          strokeWidth="1.5"
          strokeDasharray={`${dash} ${CIRC}`}
          strokeLinecap="round"
        />
      </svg>
      <span
        aria-hidden
        style={{
          fontSize: 11,
          color: holding ? V.accent2 : V.muted,
          transition: 'color .15s ease',
          lineHeight: 1,
          position: 'relative',
          zIndex: 1,
        }}
      >⏹</span>
    </button>
  )
}
