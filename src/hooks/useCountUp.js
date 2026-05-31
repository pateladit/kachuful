import { useState, useEffect, useRef } from 'react'

export function useCountUp(target, { duration = 600, enabled = true } = {}) {
  const [display, setDisplay] = useState(target)
  const prevRef = useRef(target)

  useEffect(() => {
    if (!enabled || prevRef.current === target) {
      setDisplay(target)
      prevRef.current = target
      return
    }

    const from = prevRef.current
    const diff = target - from
    prevRef.current = target

    if (diff === 0) return

    const start = performance.now()
    let raf

    function tick(now) {
      const t = Math.min(1, (now - start) / duration)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(from + diff * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration, enabled])

  return display
}
