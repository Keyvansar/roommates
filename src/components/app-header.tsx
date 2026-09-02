'use client'

import { useState } from 'react'
import {
  Check,
  ChevronDown,
  Home,
  LogOut,
  RefreshCw,
  Shield,
  ShieldCheck,
  UserCog,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useLogout, useMe, useSwitchHousehold } from '@/hooks/use-auth'
import { useProfiles } from '@/hooks/use-data'
import { useSyncStore } from '@/hooks/use-sync-store'
import { useUserStore } from '@/lib/store'
import type { ProfileDTO } from '@/lib/types'
import { cn } from '@/lib/utils'

function profileInitial(name: string): string {
  return name?.trim()?.[0] ?? '؟'
}

function ConnectionDot() {
  const connected = useSyncStore((s) => s.connected)
  return (
    <span
      title={connected ? 'آنلاین و همگام' : 'آفلاین — همگام‌سازی متوقف'}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
        connected ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-muted text-muted-foreground',
      )}
      aria-label={connected ? 'اتصال برقرار است' : 'اتصال قطع است'}
    >
      {connected ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}
      <span className="hidden sm:inline">{connected ? 'آنلاین' : 'آفلاین'}</span>
    </span>
  )
}

function RoleBadge() {
  const role = useUserStore((s) => s.role)
  if (!role || role === 'MEMBER') return null
  const isOwner = role === 'OWNER'
  const Icon = isOwner ? ShieldCheck : Shield
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
        isOwner
          ? 'bg-primary/15 text-primary'
          : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
      )}
      title={isOwner ? 'مالک خانه' : 'ناظر خانه'}
    >
      <Icon className="size-3" />
      <span>{isOwner ? 'مالک' : 'ناظر'}</span>
    </span>
  )
}

/**
 * Inline profile switcher dialog. Lets the user pick the active profile
 * (used as the buyer for new purchases and as the presence identifier).
 * Picks are written into `useUserStore.setProfile`.
 */
function ProfileSwitcherDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const profilesQuery = useProfiles()
  const activeProfileId = useUserStore((s) => s.activeProfileId)
  const setProfile = useUserStore((s) => s.setProfile)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تغییر پروفایل فعال</DialogTitle>
          <DialogDescription>
            پروفایلی که می‌خواهید خریدهایتان به نام آن ثبت شود انتخاب کنید.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2">
          {profilesQuery.data?.map((p: ProfileDTO) => {
            const isActive = activeProfileId === p.id
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => { setProfile(p); onOpenChange(false) }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl border p-3 text-right transition-colors hover:bg-accent/40',
                    isActive ? 'border-primary bg-primary/5' : 'border-border bg-card',
                  )}
                >
                  <span
                    aria-hidden
                    className="flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ backgroundColor: p.avatarColor }}
                  >
                    {profileInitial(p.name)}
                  </span>
                  <span className="flex-1 text-sm font-medium">{p.name}</span>
                  {isActive && <Check className="text-primary size-4" />}
                </button>
              </li>
            )
          })}
        </ul>

        <DialogClose asChild>
          <Button variant="outline" className="w-full">بستن</Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Top app header. Shows the brand (Home icon + "هم‌خانه‌یاب" + the active
 * household's name), the realtime connection status pill, the role badge,
 * and a user dropdown. The dropdown surfaces the user's email, a sub-menu
 * to switch between households (only when they belong to more than one), a
 * profile switcher dialog trigger, and the logout action.
 */
export function AppHeader() {
  const meQuery = useMe()
  const logout = useLogout()
  const switchHousehold = useSwitchHousehold()
  const user = useUserStore((s) => s.user)
  const household = useUserStore((s) => s.household)
  const [switcherOpen, setSwitcherOpen] = useState(false)

  const meUser = meQuery.data?.user ?? null
  const displayName = user?.name ?? meUser?.name ?? 'کاربر'
  const displayEmail = user?.email ?? meUser?.email ?? ''
  const avatarColor = user?.avatarColor ?? meUser?.avatarColor ?? '#6b7280'
  const households = meQuery.data?.households ?? []
  const showSwitcher = households.length > 1

  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-30 border-b backdrop-blur">
      <div className="mx-auto flex h-14 max-w-2xl items-center gap-2 px-3">
        {/* Brand */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="bg-primary/15 text-primary flex size-9 shrink-0 items-center justify-center rounded-full">
            <Home className="size-5" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-sm font-semibold leading-none">
              <span>هم‌خانه‌یاب</span>
              {household && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground truncate text-xs font-normal">{household.name}</span>
                </>
              )}
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <ConnectionDot />
              <RoleBadge />
            </div>
          </div>
        </div>

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 px-2">
              <Avatar className="size-7">
                <AvatarFallback
                  className="text-xs font-bold text-white"
                  style={{ backgroundColor: avatarColor }}
                >
                  {profileInitial(displayName)}
                </AvatarFallback>
              </Avatar>
              <span className="max-w-[7rem] truncate text-xs sm:max-w-[10rem] sm:text-sm">{displayName}</span>
              <ChevronDown className="text-muted-foreground size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="truncate text-sm font-semibold">{displayName}</span>
              <span className="text-muted-foreground truncate text-xs font-normal" dir="ltr">{displayEmail}</span>
            </DropdownMenuLabel>

            {showSwitcher && (
              <>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 text-muted-foreground text-[11px]">خانه‌ها</div>
                <div className="max-h-48 overflow-y-auto">
                  {households.map((h) => {
                    const isActive = h.isActive
                    return (
                      <DropdownMenuItem
                        key={h.id}
                        disabled={isActive || switchHousehold.isPending}
                        onClick={() => switchHousehold.mutate({ householdId: h.id })}
                        className="flex items-center gap-2"
                      >
                        <span className="flex-1 truncate text-sm">{h.name}</span>
                        {isActive ? (
                          <Check className="text-primary size-3.5" />
                        ) : (
                          <RefreshCw className="text-muted-foreground size-3" />
                        )}
                      </DropdownMenuItem>
                    )
                  })}
                </div>
              </>
            )}

            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setSwitcherOpen(true)}>
              <UserCog className="size-4" />
              <span>تغییر پروفایل فعال</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
            >
              <LogOut className="size-4" />
              <span>خروج</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ProfileSwitcherDialog open={switcherOpen} onOpenChange={setSwitcherOpen} />
    </header>
  )
}

// Re-export the Users icon so downstream agents can use the same icon for
// "members" / "household" entries without re-importing from lucide.
export const HouseholdIcon = Users
