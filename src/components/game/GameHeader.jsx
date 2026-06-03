import { memo } from 'react'
import GameTimer from './GameTimer'
import AccountMenu from '../AccountMenu'

const V = {
  ink:    'var(--color-ink, #f6e7d3)',
  muted:  'var(--color-muted, #9b7c6b)',
  line:   'var(--color-line, #5a3445)',
  accent: 'var(--color-accent, #e89a3c)',
}

export default memo(function GameHeader({ game, roundNumber, phase, children, right }) {
  return (
    <header style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 20, paddingBottom: 14, borderBottom: `1px solid ${V.line}` }}>
      <div>
        <div translate="no" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, letterSpacing: '-0.01em', color: V.ink }}>
          Ka
          <span aria-hidden style={{ display: 'inline-block', width: '.22em', height: '.22em', background: V.accent, borderRadius: '50%', margin: '0 .03em .15em', verticalAlign: 'middle' }} />
          Chu
          <span aria-hidden style={{ display: 'inline-block', width: '.22em', height: '.22em', background: V.accent, borderRadius: '50%', margin: '0 .03em .15em', verticalAlign: 'middle' }} />
          Fu
          <span aria-hidden style={{ display: 'inline-block', width: '.22em', height: '.22em', background: V.accent, borderRadius: '50%', margin: '0 .03em .15em', verticalAlign: 'middle' }} />
          L
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted, marginTop: 4 }}>
          {game.name ? `${game.name} · ` : ''}Round {roundNumber} · {phase}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <GameTimer startedAt={game.started_at} />
        {children}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        {right ?? <AccountMenu />}
      </div>
    </header>
  )
})
