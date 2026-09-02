'use client'

import { useProfiles } from '@/hooks/use-data'
import { useUserStore } from '@/lib/store'
import type { ProfileDTO } from '@/lib/types'
import { LoadingSplash } from '@/components/loading-splash'

function profileInitial(name: string): string {
  return (name?.trim()?.[0] ?? '؟')
}

/**
 * Demo-mode profile picker. When the app is running in demo mode (no logged
 * in user) we let the visitor browse as one of the seeded demo profiles.
 * Selecting a card calls `useUserStore.setProfile` so the rest of the app can
 * treat the active profile uniformly.
 */
export function UserPicker() {
  const profilesQuery = useProfiles()
  const setProfile = useUserStore((s) => s.setProfile)
  const activeProfileId = useUserStore((s) => s.activeProfileId)

  if (profilesQuery.isLoading || !profilesQuery.data) return <LoadingSplash />

  const profiles = profilesQuery.data

  return (
    <div className="app-shell mx-auto items-center justify-center gap-6 px-4 py-10 text-center">
      <header className="space-y-1">
        <div className="text-4xl" role="img" aria-label="سبد خرید">🛒</div>
        <h1 className="text-xl font-bold">هم‌خانه‌یاب — حالت دمو</h1>
        <p className="text-muted-foreground text-sm">
          یکی از پروفایل‌های نمونه را برای کاوش اپلیکیشن انتخاب کنید.
        </p>
      </header>

      <div className="grid w-full max-w-sm grid-cols-2 gap-3">
        {profiles.map((p: ProfileDTO) => {
          const isActive = activeProfileId === p.id
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setProfile(p)}
              aria-pressed={isActive}
              className="tap-scale flex flex-col items-center gap-3 rounded-2xl border bg-card p-5 text-center shadow-sm transition-colors hover:bg-accent/50 aria-pressed:border-primary aria-pressed:bg-accent/40"
            >
              <span
                aria-hidden
                className="flex size-14 items-center justify-center rounded-full text-xl font-bold text-white"
                style={{ backgroundColor: p.avatarColor }}
              >
                {profileInitial(p.name)}
              </span>
              <span className="text-sm font-medium">{p.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
