'use client'

import { useEffect, useState } from 'react'
import { useMe } from '@/hooks/use-auth'
import { useProfiles } from '@/hooks/use-data'
import { useRealtime } from '@/hooks/use-realtime'
import { useUserStore } from '@/lib/store'
import { AppHeader } from '@/components/app-header'
import { AuthScreen } from '@/components/auth-screen'
import { BottomNav } from '@/components/bottom-nav'
import { InstallPrompt } from '@/components/install-prompt'
import { LoadingSplash } from '@/components/loading-splash'
import { UserPicker } from '@/components/user-picker'
import { InventoryView } from '@/components/views/inventory-view'
import { ToBuyView } from '@/components/views/to-buy-view'
import { BalanceView } from '@/components/views/balance-view'
import { InsightsView } from '@/components/views/insights-view'
import { HistoryView } from '@/components/views/history-view'
import { ModerationView } from '@/components/views/moderation-view'
import { SettingsView } from '@/components/views/settings-view'
import type { TabKey } from '@/components/tabs'

export function AppShell() {
  useRealtime()

  const meQuery = useMe()
  const profilesQuery = useProfiles()
  const hydrated = useUserStore((s) => s.hydrated)
  const user = useUserStore((s) => s.user)
  const household = useUserStore((s) => s.household)
  const demoMode = useUserStore((s) => s.demoMode)
  const activeProfileId = useUserStore((s) => s.activeProfileId)
  const activeProfile = useUserStore((s) => s.activeProfile)
  const setSession = useUserStore((s) => s.setSession)
  const setProfile = useUserStore((s) => s.setProfile)
  const clearSession = useUserStore((s) => s.clearSession)

  const [tab, setTab] = useState<TabKey>('inventory')

  // Mirror server session → Zustand (effect, not render-phase)
  useEffect(() => {
    if (demoMode) return
    if (meQuery.isLoading) return

    const d = meQuery.data
    if (!d || !d.user) {
      if (user) clearSession()
      return
    }

    setSession({
      user: {
        id: d.user.id, email: d.user.email, name: d.user.name,
        avatarColor: d.user.avatarColor, avatarEmoji: d.user.avatarEmoji,
      },
      household: d.household
        ? { id: d.household.id, name: d.household.name, inviteCode: d.household.inviteCode, ownerId: d.household.ownerId }
        : null,
      role: d.role,
    })

    if (d.profile && !activeProfileId) {
      setProfile({
        id: d.profile.id, name: d.profile.name, avatarColor: d.profile.avatarColor, pin: null,
      })
    }
  }, [meQuery.data, meQuery.isLoading, demoMode])

  // Reset stale activeProfile when the household changes
  useEffect(() => {
    if (!profilesQuery.data) return
    const list = profilesQuery.data
    const exists = activeProfileId ? list.some((p) => p.id === activeProfileId) : false
    if (activeProfileId && !exists) { setProfile(null); return }
    if (!activeProfileId && list.length > 0) {
      const meProfile = meQuery.data?.profiles?.find((p) => p.isMe)
      if (meProfile) setProfile({ id: meProfile.id, name: meProfile.name, avatarColor: meProfile.avatarColor, pin: null })
      else setProfile(list[0])
    }
  }, [household?.id, demoMode, profilesQuery.data])

  // Gate on hydration + initial fetch
  if (!hydrated) return <LoadingSplash />
  if (!demoMode && meQuery.isLoading && !user) return <LoadingSplash />

  // Demo mode → UserPicker if no profile, else main app
  if (demoMode && !user) {
    if (!activeProfile) return (
      <div className="app-shell bg-background">
        <UserPicker />
      </div>
    )
    return (
      <div className="app-shell bg-background">
        <AppHeader />
        <main className="flex-1 w-full max-w-2xl mx-auto px-3 pb-28 pt-3 sm:px-4">
          <div className="mb-3"><InstallPrompt /></div>
          {tab === 'inventory' && <InventoryView />}
          {tab === 'to-buy' && <ToBuyView />}
          {tab === 'balance' && <BalanceView />}
          {tab === 'insights' && <InsightsView />}
          {tab === 'history' && <HistoryView />}
          {tab === 'moderation' && <ModerationView />}
          {tab === 'settings' && <SettingsView />}
        </main>
        <BottomNav active={tab} onChange={setTab} />
      </div>
    )
  }

  // No user → AuthScreen
  if (!user) return <AuthScreen />

  // Logged in → main app
  return (
    <div className="app-shell bg-background">
      <AppHeader />
      <main className="flex-1 w-full max-w-2xl mx-auto px-3 pb-28 pt-3 sm:px-4">
        <div className="mb-3"><InstallPrompt /></div>
        {tab === 'inventory' && <InventoryView />}
        {tab === 'to-buy' && <ToBuyView />}
        {tab === 'balance' && <BalanceView />}
        {tab === 'insights' && <InsightsView />}
        {tab === 'history' && <HistoryView />}
        {tab === 'moderation' && <ModerationView />}
        {tab === 'settings' && <SettingsView />}
      </main>
      <BottomNav active={tab} onChange={setTab} />
    </div>
  )
}
