import Avatar from './Avatar'
import { trumpById, scoreFor } from '../../lib/gameLogic'
import { formatRank, rankBg } from '../../lib/gameColors'

const V = {
  surface: 'var(--color-surface, #3d2330)',
  bg2:     'var(--color-bg-2, #3a1f2c)',
  ink:     'var(--color-ink, #f6e7d3)',
  ink2:    'var(--color-ink-2, #d8b893)',
  muted:   'var(--color-muted, #9b7c6b)',
  line:    'var(--color-line, #5a3445)',
  accent:  'var(--color-accent, #e89a3c)',
  accent2: 'var(--color-accent-2, #d24a3d)',
  accent3: 'var(--color-accent-3, #b6c97a)',
}

export default function RunningTab({
  players,
  completedRounds,
  tabRounds,
  dealerIdx,
  variant,
  totals,
  ranks,
  leaderIds,
  expanded,
  onToggleExpand,
  renderCurrentRound,
  renderTotal,
  totalCellColor,
}) {
  const getTotal = renderTotal ?? (p => totals[p.id])
  const getTotalColor = totalCellColor ?? (p => leaderIds.has(p.id) ? V.accent : V.ink)

  return (
    <section className="game-tab-sidebar" aria-label="Running score tab" style={{ background: V.surface, border: `1px solid ${V.line}`, borderRadius: 20, overflow: 'hidden' }}>

      <div style={{ padding: '14px 18px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16, letterSpacing: '-0.01em', margin: 0, color: V.ink }}>
          Running tab
          <small style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.muted, letterSpacing: '.14em', textTransform: 'uppercase', marginLeft: 8, fontWeight: 500 }}>
            {completedRounds.length} of {completedRounds.length + 1} rounds
          </small>
        </h2>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: V.muted, flexShrink: 0 }}>
          <span aria-hidden style={{ color: V.accent3 }}>●</span> made&nbsp;
          <span aria-hidden style={{ color: V.accent2 }}>●</span> missed
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${V.line}`, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 12, tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th
                scope="col"
                className="game-tab-round-cell"
                style={{ textAlign: 'left', padding: '9px 6px 9px 14px', background: V.surface, color: V.muted, fontWeight: 600, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', width: 60, borderBottom: `1px solid ${V.line}`, borderRight: `1px solid ${V.line}` }}
              >Rnd</th>
              {players.map((p, i) => (
                <th key={p.id} scope="col" style={{ padding: '9px 4px', background: V.surface, textAlign: 'center', borderBottom: `1px solid ${V.line}`, borderRight: i < players.length - 1 ? `1px solid ${V.line}` : 'none' }}>
                  <Avatar player={p} size={22} />
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 11, color: i === dealerIdx ? V.accent : V.ink, display: 'block', marginTop: 2, textTransform: 'none', letterSpacing: 0 }}>{p.displayName}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tabRounds.map(r => {
              const tr = trumpById.get(r.trump)
              return (
                <tr key={r.id}>
                  <td
                    className="game-tab-round-cell"
                    style={{ textAlign: 'left', padding: '7px 6px 7px 14px', borderBottom: `1px solid ${V.line}`, borderRight: `1px solid ${V.line}`, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 12, color: V.ink, background: V.bg2 }}
                  >
                    R{r.roundNumber}
                    <span aria-hidden style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: tr?.red ? '#e57860' : V.muted, marginLeft: 3 }}>{tr?.glyph}</span>
                  </td>
                  {players.map((p, pi) => {
                    const b    = r.bids[p.id]
                    const k    = r.took?.[p.id]
                    const made = b !== undefined && k !== undefined && b === k
                    const pts  = (b !== undefined && k !== undefined) ? scoreFor(b, k, variant) : null
                    return (
                      <td
                        key={p.id}
                        style={{
                          padding: '7px 4px', textAlign: 'center',
                          borderBottom: `1px solid ${V.line}`,
                          borderRight: pi < players.length - 1 ? `1px solid ${V.line}` : 'none',
                          background: pts === null ? 'transparent' : made ? `color-mix(in oklab, ${V.accent3} 14%, transparent)` : `color-mix(in oklab, ${V.accent2} 14%, transparent)`,
                        }}
                      >
                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1 }}>
                          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em', color: pts === null ? V.muted : made ? V.accent3 : V.accent2, fontVariantNumeric: 'tabular-nums' }}>
                            {pts === null ? '—' : made ? `+${pts}` : '0'}
                          </span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: V.ink2, opacity: .75, marginTop: 1 }}>
                            {b !== undefined ? b : '—'}/{k !== undefined ? k : '—'}
                          </span>
                        </div>
                      </td>
                    )
                  })}
                </tr>
              )
            })}

            {renderCurrentRound()}

            {/* TOTAL */}
            <tr>
              <td
                className="game-tab-round-cell"
                style={{ padding: '11px 6px 11px 14px', background: V.surface, fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted, fontWeight: 600, borderRight: `1px solid ${V.line}`, borderTop: `2px solid ${V.line}` }}
              >TOTAL</td>
              {players.map((p, pi) => (
                <td key={p.id} style={{ padding: '11px 4px', background: rankBg(ranks[p.id]?.rank, players.length), textAlign: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 19, color: getTotalColor(p), letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums', borderRight: pi < players.length - 1 ? `1px solid ${V.line}` : 'none', borderTop: `2px solid ${V.line}` }}>
                  {getTotal(p)}
                </td>
              ))}
            </tr>

            {/* RANK */}
            <tr>
              <td
                className="game-tab-round-cell"
                style={{ padding: '8px 6px 8px 14px', background: V.bg2, fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: V.muted, fontWeight: 600, borderRight: `1px solid ${V.line}` }}
              >RANK</td>
              {players.map((p, pi) => (
                <td key={p.id} style={{ padding: '8px 4px', background: rankBg(ranks[p.id]?.rank, players.length), textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12, color: leaderIds.has(p.id) ? V.accent : V.ink2, borderRight: pi < players.length - 1 ? `1px solid ${V.line}` : 'none' }}>
                  {formatRank(ranks[p.id])}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {completedRounds.length > 5 ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 10, borderTop: `1px solid ${V.line}`, background: V.bg2 }}>
          <button
            className="game-icon-btn game-expand-btn"
            onClick={onToggleExpand}
            aria-expanded={expanded}
            style={{ background: 'transparent', border: `1px solid ${V.line}`, color: V.ink2, fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', padding: '6px 14px', borderRadius: 999, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, touchAction: 'manipulation' }}
          >
            {expanded ? 'Collapse' : `All ${completedRounds.length} rounds`}
            <span aria-hidden style={{ display: 'inline-block', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .25s ease' }}>↓</span>
          </button>
        </div>
      ) : null}
    </section>
  )
}
