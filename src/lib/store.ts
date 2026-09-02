'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ProfileDTO } from '@/lib/types'

export interface SessionUser {
  id: string
  email: string
  name: string
  avatarColor: string
  avatarEmoji: string | null
}

export interface SessionHousehold {
  id: string
  name: string
  inviteCode: string
  ownerId: string
}

interface UserState {
  user: SessionUser | null
  household: SessionHousehold | null
  role: 'OWNER' | 'MODERATOR' | 'MEMBER' | null
  activeProfileId: string | null
  activeProfile: ProfileDTO | null
  hydrated: boolean
  demoMode: boolean

  setSession: (s: { user: SessionUser; household: SessionHousehold | null; role: string | null }) => void
  setProfile: (profile: ProfileDTO | null) => void
  setDemoMode: (v: boolean) => void
  clearSession: () => void
  setHydrated: () => void
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      household: null,
      role: null,
      activeProfileId: null,
      activeProfile: null,
      hydrated: false,
      demoMode: false,
      setSession: (s) =>
        set({ user: s.user, household: s.household, role: (s.role as 'OWNER' | 'MODERATOR' | 'MEMBER') ?? null }),
      setProfile: (profile) => set({ activeProfile: profile, activeProfileId: profile?.id ?? null }),
      setDemoMode: (v) => set({ demoMode: v }),
      clearSession: () => set({ user: null, household: null, role: null, activeProfile: null, activeProfileId: null }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: 'hamkhaneh-user',
      onRehydrateStorage: () => (state) => { state?.setHydrated() },
    }
  )
)
