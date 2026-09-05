'use client'

import { create } from 'zustand'
import type { ProfileDTO } from '@/lib/types'

export interface PresenceEntry {
  id: string
  profile: ProfileDTO
}

interface SyncState {
  connected: boolean
  presence: PresenceEntry[]
  setConnected: (v: boolean) => void
  setPresence: (list: PresenceEntry[]) => void
  upsertPresence: (entry: PresenceEntry) => void
  removePresence: (id: string) => void
}

export const useSyncStore = create<SyncState>((set) => ({
  connected: false,
  presence: [],
  setConnected: (v) => set({ connected: v }),
  setPresence: (list) => set({ presence: list }),
  upsertPresence: (entry) =>
    set((s) => {
      const idx = s.presence.findIndex((p) => p.id === entry.id)
      if (idx === -1) return { presence: [...s.presence, entry] }
      const next = s.presence.slice()
      next[idx] = { ...next[idx], ...entry }
      return { presence: next }
    }),
  removePresence: (id) =>
    set((s) => ({ presence: s.presence.filter((p) => p.id !== id) })),
}))
