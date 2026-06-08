import React, { createContext, useContext, useState, useEffect } from 'react'
import { DARK, LIGHT } from './theme'

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('saisambu-theme')
    return saved ? saved === 'dark' : true
  })

  const t = isDark ? DARK : LIGHT

  function toggle() {
    setIsDark(d => {
      localStorage.setItem('saisambu-theme', !d ? 'dark' : 'light')
      return !d
    })
  }

  useEffect(() => {
    document.body.style.background = t.bg
    document.body.style.color = t.text
  }, [isDark])

  return (
    <ThemeContext.Provider value={{ t, isDark, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
