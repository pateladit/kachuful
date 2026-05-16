export default function Avatar({ player, size = 40, isDealer = false, glow = false }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: player.color,
        border: `2px solid ${isDealer ? '#e89a3c' : 'transparent'}`,
        boxShadow: glow ? '0 0 0 4px rgba(232,154,60,.18)' : 'none',
        display: 'grid',
        placeItems: 'center',
        color: '#1a0e15',
        fontFamily: 'var(--font-display, "Bricolage Grotesque", sans-serif)',
        fontWeight: 700,
        fontSize: size <= 28 ? 11 : size <= 36 ? 13 : size <= 56 ? 18 : 22,
        letterSpacing: '-0.01em',
        lineHeight: 1,
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {player.initial}
    </div>
  )
}
