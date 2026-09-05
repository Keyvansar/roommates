'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getSocket, joinHouseholdRoom, type ChangePayload } from '@/lib/realtime'
import { qk } from '@/lib/query-keys'
import { useSyncStore, type PresenceEntry } from '@/hooks/use-sync-store'
import { useUserStore } from '@/lib/store'

export function useRealtime(): void {
  const qc = useQueryClient()
  const setConnected = useSyncStore((s) => s.setConnected)
  const setPresence = useSyncStore((s) => s.setPresence)
  const upsertPresence = useSyncStore((s) => s.upsertPresence)
  const removePresence = useSyncStore((s) => s.removePresence)
  const activeProfile = useUserStore((s) => s.activeProfile)
  const householdId = useUserStore((s) => s.household?.id)

  useEffect(() => {
    const socket = getSocket()

    const handleChange = (payload: ChangePayload) => {
      if (!payload?.type) return
      switch (payload.type) {
        case 'items':
          void qc.invalidateQueries({ queryKey: qk.items })
          void qc.invalidateQueries({ queryKey: qk.stats })
          void qc.invalidateQueries({ queryKey: ['stats', 'weekly'] })
          break
        case 'purchase-logs':
          void qc.invalidateQueries({ queryKey: qk.logs })
          void qc.invalidateQueries({ queryKey: [...qk.logs, 'deleted'] })
          void qc.invalidateQueries({ queryKey: qk.balance })
          void qc.invalidateQueries({ queryKey: qk.stats })
          void qc.invalidateQueries({ queryKey: ['stats', 'weekly'] })
          break
        case 'balance':
          void qc.invalidateQueries({ queryKey: qk.balance })
          void qc.invalidateQueries({ queryKey: qk.stats })
          break
        case 'profiles':
          void qc.invalidateQueries({ queryKey: qk.profiles })
          void qc.invalidateQueries({ queryKey: qk.stats })
          break
      }
    }

    const handleConnect = () => {
      setConnected(true)
      if (householdId) joinHouseholdRoom(householdId, activeProfile?.name)
    }
    const handleDisconnect = () => setConnected(false)
    const handlePresence = (entry: { id: string; profile: unknown; online?: boolean }) => {
      if (!entry?.id) return
      if (entry.online === false) { removePresence(entry.id); return }
      const profile =
        typeof entry.profile === 'string'
          ? { id: entry.id, name: entry.profile as string, avatarColor: '#6b7280', pin: null }
          : (entry.profile as { id: string; name: string; avatarColor: string; pin: string | null })
      upsertPresence({ id: entry.id, profile } as PresenceEntry)
    }
    const handlePresenceList = (list: Array<{ id: string; profile: unknown }>) => {
      if (!Array.isArray(list)) return
      const normalized: PresenceEntry[] = list.map((e) => ({
        id: e.id,
        profile:
          typeof e.profile === 'string'
            ? { id: e.id, name: e.profile as string, avatarColor: '#6b7280', pin: null }
            : (e.profile as { id: string; name: string; avatarColor: string; pin: string | null }),
      }))
      setPresence(normalized)
    }

    socket.on('change', handleChange)
    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('presence', handlePresence)
    socket.on('presence-list', handlePresenceList)

    if (socket.connected) {
      setConnected(true)
      if (householdId) joinHouseholdRoom(householdId, activeProfile?.name)
    }

    return () => {
      socket.off('change', handleChange)
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('presence', handlePresence)
      socket.off('presence-list', handlePresenceList)
    }
  }, [qc, setConnected, setPresence, upsertPresence, removePresence, activeProfile, householdId])
}
