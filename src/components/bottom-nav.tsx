'use client'

import { useId } from 'react'
import { useItems } from '@/hooks/use-data'
import { useFaDigits } from '@/hooks/use-fa-digits'
import { useMe } from '@/hooks/use-auth'
import { useUserStore } from '@/lib/store'
import { TABS, hasMinRole, type TabKey } from '@/components/tabs'
import { cn } from '@/lib/utils'

interface BottomNavProps {
  active: TabKey
  onChange: (tab: TabKey) => void
}

/**
 * Sticky bottom navigation. Renders one button per visible tab in a grid
 * whose column count matches the number of visible tabs. The active tab
 * shows the icon at 110% scale, primary-coloured text and a small indicator
 * bar at the top of the cell. The "to-buy" tab also carries a numeric badge
 * showing how many items are currently depleted — formatted with Persian
 * digits when the appearance setting is on.
 *
 * Role gating: tabs with `minRole: 'MODERATOR'` (the moderation tab) are
 * hidden from plain members. The user's role is taken from Zustand first
 * and falls back to the `useMe` query while the store is hydrating.
 */
export function BottomNav({ active, onChange }: BottomNavProps) {
  const fa = useFaDigits()
  const roleFromStore = useUserStore((s) => s.role)
  const meQuery = useMe()
  const role = roleFromStore ?? (meQuery.data?.role ?? null)
  const itemsQuery = useItems()
  const depletedCount = itemsQuery.data?.filter((i) => i.status === 'depleted').length ?? 0
  const listId = useId()

  const visible = TABS.filter((t) => hasMinRole(role, t.minRole))

  return (
    <nav
      aria-label="ناوبری اصلی"
      className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky bottom-0 z-40 border-t pb-safe backdrop-blur"
    >
      <ul
        role="list"
        id={listId}
        className="mx-auto grid w-full max-w-2xl"
        style={{ gridTemplateColumns: `repeat(${visible.length}, minmax(0, 1fr))` }}
      >
        {visible.map((tab) => {
          const Icon = tab.icon
          const isActive = active === tab.key
          const showBadge = tab.key === 'to-buy' && depletedCount > 0
          return (
            <li key={tab.key} role="none" className="relative">
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={listId}
                onClick={() => onChange(tab.key)}
                className={cn(
                  'tap-scale relative flex h-16 w-full flex-col items-center justify-center gap-1 px-1 text-xs transition-colors',
                  'rounded-md hover:bg-accent/60',
                  isActive ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                {/* Top indicator bar — only on the active tab. */}
                <span
                  aria-hidden
                  className={cn(
                    'absolute top-0 h-0.5 w-8 rounded-full bg-primary transition-opacity',
                    isActive ? 'opacity-100' : 'opacity-0',
                  )}
                />
                <span className="relative">
                  <Icon
                    className={cn(
                      'transition-transform',
                      isActive ? 'scale-110' : 'scale-100',
                    )}
                    size={22}
                  />
                  {showBadge && (
                    <span
                      aria-label={`${fa(depletedCount)} کالا تمام‌شده`}
                      className="bg-destructive text-destructive-foreground absolute -top-1.5 -left-2 min-w-4 rounded-full px-1 text-[10px] leading-4 tabular-nums"
                    >
                      {fa(depletedCount)}
                    </span>
                  )}
                </span>
                <span className="leading-none">{tab.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
