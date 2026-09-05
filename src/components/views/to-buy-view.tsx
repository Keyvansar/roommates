'use client'

import { useMemo } from 'react'
import { Check, PartyPopper, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CategoryIcon } from '@/components/category-icon'
import { TierBadge } from '@/components/badges'
import { useCheckout, useItems } from '@/hooks/use-data'
import { useFaDigits } from '@/hooks/use-fa-digits'
import { useTierMeta } from '@/hooks/use-tier-meta'
import { useUserStore } from '@/lib/store'
import type { ItemDTO, PointTier } from '@/lib/types'
import { cn } from '@/lib/utils'

const TIERS_DESC: PointTier[] = [5, 3, 1]

function profileInitial(name: string): string {
  return name?.trim()?.[0] ?? '؟'
}

/**
 * Depleted items queue. The header is a gradient summary card (icon, count,
 * total points and the active buyer's name), followed by a row of tier
 * breakdown chips (heavy/medium/light with their counts). The queue is
 * sorted by tier descending so heavy items surface to the top; each row
 * shows the category icon, title, tier badge and a check button that fires
 * the checkout mutation for the active buyer. The empty state shows a
 * PartyPopper celebration.
 */
export function ToBuyView() {
  const itemsQuery = useItems()
  const checkout = useCheckout()
  const fa = useFaDigits()
  const tierMeta = useTierMeta()
  const activeProfile = useUserStore((s) => s.activeProfile)

  const items = itemsQuery.data ?? []
  const depleted = useMemo(
    () => items.filter((i) => i.status === 'depleted'),
    [items],
  )
  const sorted = useMemo(
    () => [...depleted].sort((a, b) => b.pointTier - a.pointTier),
    [depleted],
  )

  const totalPoints = depleted.reduce((sum, i) => sum + tierMeta[i.pointTier].points, 0)
  const tierCounts: Record<PointTier, number> = { 1: 0, 3: 0, 5: 0 }
  for (const i of depleted) tierCounts[i.pointTier]++

  const handleCheckout = (item: ItemDTO) => {
    checkout.mutate({ itemId: item.id })
  }

  if (itemsQuery.isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  if (depleted.length === 0) {
    return (
      <Card className="py-6">
        <CardContent className="flex flex-col items-center gap-3 py-2 text-center">
          <span
            aria-hidden
            className="bg-emerald-500/15 text-emerald-600 flex size-14 items-center justify-center rounded-2xl dark:text-emerald-400"
          >
            <PartyPopper className="size-7" />
          </span>
          <div className="space-y-1">
            <h3 className="text-base font-semibold">سبد خرید خالی است</h3>
            <p className="text-muted-foreground text-sm">
              همه کالاها موجودند. وقتی چیزی تمام شد اینجا ظاهر می‌شود.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {/* Summary card */}
      <Card className="border-0 overflow-hidden py-0">
        <div className="bg-gradient-to-bl from-emerald-500/15 via-emerald-500/10 to-amber-500/15 p-4">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="bg-emerald-500/20 text-emerald-700 flex size-11 shrink-0 items-center justify-center rounded-xl dark:text-emerald-300"
            >
              <ShoppingCart className="size-5" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold tabular-nums leading-none">
                  {fa(depleted.length)}
                </span>
                <span className="text-muted-foreground text-sm">کالا برای خرید</span>
              </div>
              <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-1 text-xs">
                <span className="tabular-nums">{fa(totalPoints)}</span>
                <span>امتیاز</span>
                {activeProfile && (
                  <>
                    <span aria-hidden>·</span>
                    <span>نوبت خرید:</span>
                    <span
                      className="inline-flex items-center gap-1 font-medium"
                      style={{ color: activeProfile.avatarColor }}
                    >
                      <span
                        aria-hidden
                        className="inline-flex size-4 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ backgroundColor: activeProfile.avatarColor }}
                      >
                        {profileInitial(activeProfile.name)}
                      </span>
                      {activeProfile.name}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Tier breakdown chips */}
      <div className="flex flex-wrap gap-2">
        {TIERS_DESC.map((t) => {
          const meta = tierMeta[t]
          const count = tierCounts[t]
          if (count === 0) return null
          return (
            <div
              key={t}
              className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs"
              style={{ borderColor: `${meta.color}40`, backgroundColor: `${meta.color}10` }}
            >
              <span
                aria-hidden
                className="inline-block size-2 rounded-full"
                style={{ backgroundColor: meta.color }}
              />
              <span className="font-medium">{meta.label}</span>
              <span
                className="tabular-nums"
                style={{ color: meta.color }}
              >
                {fa(count)}
              </span>
            </div>
          )
        })}
      </div>

      {/* Queue */}
      <div className="space-y-2">
        {sorted.map((item) => {
          const isCheckingOut =
            checkout.isPending && checkout.variables?.itemId === item.id
          return (
            <div
              key={item.id}
              className="bg-card flex items-center gap-3 rounded-xl border p-3"
            >
              <span
                aria-hidden
                className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg"
              >
                <CategoryIcon name={item.categoryIcon} size={18} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium leading-tight">{item.title}</span>
                <span className="text-muted-foreground truncate text-xs leading-tight">
                  {item.categoryTitle}
                </span>
              </div>
              <TierBadge tier={item.pointTier} />
              <Button
                size="icon"
                aria-label={`ثبت خرید ${item.title}`}
                onClick={() => handleCheckout(item)}
                disabled={isCheckingOut}
                className={cn('shrink-0', isCheckingOut && 'opacity-70')}
              >
                <Check className="size-4" />
              </Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
