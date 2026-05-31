const V = {
  bg2:     'var(--color-bg-2, #3a1f2c)',
  surface: 'var(--color-surface, #3d2330)',
  accent:  'var(--color-accent, #e89a3c)',
  accent2: 'var(--color-accent-2, #d24a3d)',
  ink:     'var(--color-ink, #f6e7d3)',
  muted:   'var(--color-muted, #9b7c6b)',
}

export function trumpTint(trump) {
  if (!trump || trump.nt) return {
    bg: V.bg2,
    border: `1px dashed color-mix(in oklab, ${V.accent} 60%, transparent)`,
    glyphColor: V.accent,
  }
  if (trump.red) return {
    bg: 'color-mix(in oklab, var(--color-accent-2) 10%, var(--color-surface))',
    border: '1px solid color-mix(in oklab, var(--color-accent-2) 28%, transparent)',
    glyphColor: 'var(--color-red-suit, #e57860)',
  }
  return {
    bg: 'color-mix(in oklab, var(--color-accent) 8%, var(--color-surface))',
    border: '1px solid color-mix(in oklab, var(--color-accent) 24%, transparent)',
    glyphColor: 'var(--color-ink)',
  }
}
