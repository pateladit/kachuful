import { useState, useEffect } from 'react'

const KEY = 'kachuful-theme'

export function useTheme() {
  const [theme, setThemeState] = useState(
    () => localStorage.getItem(KEY) ?? 'lantern'
  )

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(KEY, theme)
  }, [theme])

  function setTheme(t) { setThemeState(t) }
  function toggleTheme() { setThemeState(t => t === 'lantern' ? 'mehfil' : 'lantern') }

  return { theme, setTheme, toggleTheme }
}
