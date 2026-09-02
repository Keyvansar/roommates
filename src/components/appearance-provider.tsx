'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

interface AppearanceSettings {
  faDigits: boolean
  compact: boolean
  setFaDigits: (v: boolean) => void
  setCompact: (v: boolean) => void
}

const AppearanceContext = createContext<AppearanceSettings>({
  faDigits: true,
  compact: false,
  setFaDigits: () => {},
  setCompact: () => {},
})

const STORAGE_KEY = 'hamkhaneh-appearance'

function readStored(): { faDigits: boolean; compact: boolean } {
  if (typeof window === 'undefined') return { faDigits: true, compact: false }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        faDigits: typeof parsed.faDigits === 'boolean' ? parsed.faDigits : true,
        compact: typeof parsed.compact === 'boolean' ? parsed.compact : false,
      }
    }
  } catch { /* ignore */ }
  return { faDigits: true, compact: false }
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [stored] = useState(readStored)
  const [faDigits, setFaDigitsState] = useState(stored.faDigits)
  const [compact, setCompactState] = useState(stored.compact)

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ faDigits, compact })) } catch { /* */ }
  }, [faDigits, compact])

  useEffect(() => {
    const root = document.documentElement
    if (compact) root.classList.add('compact-mode')
    else root.classList.remove('compact-mode')
  }, [compact])

  return (
    <AppearanceContext.Provider value={{ faDigits, compact, setFaDigits: setFaDigitsState, setCompact: setCompactState }}>
      {children}
    </AppearanceContext.Provider>
  )
}

export function useAppearance() {
  return useContext(AppearanceContext)
}
