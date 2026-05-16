import { useState, useEffect } from 'react'

function formatDuration(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function GameTimer({ startedAt, compact = false }) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const ms = startedAt ? now - new Date(startedAt).getTime() : 0
  const dur = formatDuration(ms)

  return (
    <div
      style={{
        fontFamily: 'var(--font-mono, monospace)',
        fontSize: 11,
        letterSpacing: '.12em',
        textTransform: 'uppercase',
        background: 'var(--color-bg-2, #3a1f2c)',
        color: 'var(--color-ink-2, #d8b893)',
        border: '1px solid var(--color-line, #5a3445)',
        padding: '6px 12px',
        borderRadius: 999,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontFeatureSettings: '"tnum"',
      }}
      title="Total game time"
    >
      <span style={{ fontSize: 10 }}>⏱</span>
      <b
        style={{
          color: 'var(--color-ink, #f6e7d3)',
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 14,
          letterSpacing: '-0.01em',
        }}
      >
        {dur}
      </b>
      {!compact && <span>elapsed</span>}
    </div>
  )
}
