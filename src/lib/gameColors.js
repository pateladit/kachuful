export function trumpTint(trump) {
  if (!trump || trump.nt) return {
    bg:         'var(--color-bg-2, #301820)',
    border:     '1px dashed color-mix(in oklab, var(--color-muted, #8e7060) 50%, transparent)',
    glyphColor: 'var(--color-muted, #8e7060)',
    labelColor: 'var(--color-muted, #8e7060)',
    flavor:     null,
    pageBleed:  'var(--color-bg, #211218)',
  }

  if (trump.id === 'spades') return {
    bg:         'color-mix(in oklab, #0c1824 72%, var(--color-bg-2, #301820))',
    border:     '1px solid color-mix(in oklab, #7090b8 25%, transparent)',
    glyphColor: '#c0d4e8',
    labelColor: '#6a90b0',
    flavor:     'cold · commanding',
    pageBleed:  'color-mix(in oklab, #0a1420 7%, var(--color-bg, #211218))',
  }

  if (trump.id === 'diamonds') return {
    bg:         'color-mix(in oklab, var(--color-accent, #c98818) 15%, var(--color-bg-2, #301820))',
    border:     '1px solid color-mix(in oklab, var(--color-accent, #c98818) 38%, transparent)',
    glyphColor: 'var(--color-accent, #c98818)',
    labelColor: 'color-mix(in oklab, var(--color-accent, #c98818) 60%, var(--color-muted, #8e7060))',
    flavor:     'flashy · treacherous',
    pageBleed:  'color-mix(in oklab, #3a2000 7%, var(--color-bg, #211218))',
  }

  if (trump.id === 'clubs') return {
    bg:         'color-mix(in oklab, #143a10 68%, var(--color-bg-2, #301820))',
    border:     '1px solid color-mix(in oklab, #5a8838 25%, transparent)',
    glyphColor: '#7ab860',
    labelColor: '#508840',
    flavor:     'earthy · grounded',
    pageBleed:  'color-mix(in oklab, #081808 7%, var(--color-bg, #211218))',
  }

  // hearts
  return {
    bg:         'color-mix(in oklab, var(--color-accent-2, #cc3e35) 15%, var(--color-bg-2, #301820))',
    border:     '1px solid color-mix(in oklab, var(--color-accent-2, #cc3e35) 35%, transparent)',
    glyphColor: 'var(--color-red-suit, #d86e52)',
    labelColor: 'color-mix(in oklab, var(--color-red-suit, #d86e52) 65%, var(--color-muted, #8e7060))',
    flavor:     'passionate · unforgiving',
    pageBleed:  'color-mix(in oklab, #280808 7%, var(--color-bg, #211218))',
  }
}

export function formatRank(rk) {
  if (!rk) return '—'
  const n = rk.rank
  return `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`
}

export function rankBg(rank, n) {
  if (n <= 1 || !rank) return 'transparent'
  const t = (rank - 1) / (n - 1)
  const base = `color-mix(in oklab, #ef4444 ${Math.round(t * 100)}%, #22c55e)`
  return `color-mix(in oklab, ${base} 40%, transparent)`
}
