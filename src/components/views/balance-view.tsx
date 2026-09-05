'use client'

import { useMemo, useState } from 'react'
import {
  Calendar,
  Equal,
  History,
  RotateCcw,
  Scale,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useBalance,
  useLogs,
  useReseed,
  useWeeklyStats,
} from '@/hooks/use-data'
import { useFaDigits } from '@/hooks/use-fa-digits'
import { useTierMeta } from '@/hooks/use-tier-meta'
import { formatRelativeFa } from '@/lib/jalali'
import type { BalanceDTO, PurchaseLogDTO } from '@/lib/types'
import { cn } from '@/lib/utils'

function hexWithAlpha(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0')
  return `${hex}${a}`
}

function profileInitial(name: string): string {
  return name?.trim()?.[0] ?? '؟'
}

/* ------------------------------ User mini --------------------------------- */

function UserMini({
  name,
  color,
  points,
  isLeader,
}: {
  name: string
  color: string
  points: number
  isLeader?: boolean
}) {
  const fa = useFaDigits()
  return (
    <div className="flex items-center gap-2">
      <div
        aria-hidden
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white',
          isLeader && 'ring-2 ring-offset-2 ring-offset-background',
        )}
        style={{ backgroundColor: color, ...(isLeader ? { boxShadow: `0 0 0 2px ${color}` } : undefined) }}
      >
        {profileInitial(name)}
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium leading-tight">{name}</span>
        <span className="text-muted-foreground text-xs tabular-nums leading-tight">
          {fa(points)} امتیاز
        </span>
      </div>
    </div>
  )
}

/* ------------------------------- Hero card -------------------------------- */

function HeroCard({ balance, hasData }: { balance: BalanceDTO; hasData: boolean }) {
  const fa = useFaDigits()
  const tierMeta = useTierMeta()
  const isBalanced = balance.delta === 0 && hasData

  if (!hasData) {
    return (
      <Card className="py-6">
        <CardContent className="flex flex-col items-center gap-3 py-2 text-center">
          <span
            aria-hidden
            className="bg-muted text-muted-foreground flex size-14 items-center justify-center rounded-2xl"
          >
            <Scale className="size-7" />
          </span>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">نوبت خرید بعدی</h2>
            <p className="text-muted-foreground text-sm">
              هنوز خریدی ثبت نشده است. اولین خرید، تراز را تعیین می‌کند.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (isBalanced) {
    return (
      <Card className="border-emerald-500/30 py-6">
        <CardContent className="flex flex-col items-center gap-3 py-2 text-center">
          <span
            aria-hidden
            className="bg-emerald-500/15 text-emerald-600 flex size-14 items-center justify-center rounded-2xl dark:text-emerald-400"
          >
            <Equal className="size-7" />
          </span>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">تراز برابر است</h2>
            <p className="text-muted-foreground text-sm">
              امتیاز هر دو هم‌خانه برابر است. هر کس می‌تواند خرید بعدی را انجام دهد.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const debt = balance.debtPoints
  const mediumCount = Math.ceil(debt / tierMeta[3].points)
  const heavyCount = Math.ceil(debt / tierMeta[5].points)
  const mediumColor = tierMeta[3].color
  const heavyColor = tierMeta[5].color

  return (
    <Card className="overflow-hidden py-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">نوبت خرید بعدی</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3 pb-5 pt-1 text-center">
        {/* Gradient ring avatar */}
        <div className="bg-gradient-to-tr from-emerald-500 to-amber-500 rounded-full p-0.5">
          <div className="bg-background rounded-full p-0.5">
            <div
              className="flex size-20 items-center justify-center rounded-full text-2xl font-bold text-white"
              style={{ backgroundColor: balance.nextBuyerColor ?? '#6b7280' }}
              aria-hidden
            >
              {profileInitial(balance.nextBuyerName ?? '؟')}
            </div>
          </div>
        </div>
        <h2
          className="text-xl font-bold leading-tight"
          style={{ color: balance.nextBuyerColor ?? undefined }}
        >
          {balance.nextBuyerName ?? '—'}
        </h2>
        <p className="text-muted-foreground text-sm">
          <span className="text-foreground font-bold tabular-nums">{fa(debt)}</span>{' '}
          امتیاز عقب‌تر است
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <span
            className="rounded-full px-3 py-1 text-xs font-medium"
            style={{ backgroundColor: hexWithAlpha(mediumColor, 0.12), color: mediumColor }}
          >
            ≈ {fa(mediumCount)} خرید {tierMeta[3].label}
          </span>
          <span
            className="rounded-full px-3 py-1 text-xs font-medium"
            style={{ backgroundColor: hexWithAlpha(heavyColor, 0.12), color: heavyColor }}
          >
            ≈ {fa(heavyCount)} خرید {tierMeta[5].label}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

/* -------------------------- Weekly recap card ----------------------------- */

function WeeklyRecapCard({
  weekly,
}: {
  weekly: NonNullable<ReturnType<typeof useWeeklyStats>['data']>
}) {
  const fa = useFaDigits()
  const delta = weekly.delta
  const positive = delta >= 0
  const hasLastWeek = weekly.lastWeek.purchases > 0 || weekly.lastWeek.points > 0

  return (
    <Card className="py-0">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="text-muted-foreground size-4" aria-hidden />
          خلاصه هفتگی
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end justify-between gap-2">
          <div>
            <div className="text-muted-foreground text-xs">امتیاز این هفته</div>
            <div className="text-3xl font-bold tabular-nums leading-tight">
              {fa(weekly.thisWeek.points)}
            </div>
            <div className="text-muted-foreground text-xs tabular-nums">
              {fa(weekly.thisWeek.purchases)} خرید
            </div>
          </div>
          {hasLastWeek && (
            <div
              className={cn(
                'flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
                positive
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                  : 'bg-red-500/15 text-red-700 dark:text-red-300',
              )}
            >
              {positive ? (
                <TrendingUp className="size-3.5" aria-hidden />
              ) : (
                <TrendingDown className="size-3.5" aria-hidden />
              )}
              {positive ? '+' : ''}
              {fa(delta)} امتیاز
            </div>
          )}
        </div>

        {weekly.thisWeek.perBuyer.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {weekly.thisWeek.perBuyer.map((b, i) => (
              <div key={`${b.name}-${i}`} className="flex items-center gap-1.5">
                <div
                  className="flex size-7 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ backgroundColor: b.avatarColor }}
                  aria-hidden
                >
                  {profileInitial(b.name)}
                </div>
                <span className="text-sm tabular-nums">{fa(b.points)}</span>
              </div>
            ))}
          </div>
        )}

        {hasLastWeek && (
          <div className="text-muted-foreground border-t pt-2 text-xs tabular-nums">
            هفته گذشته: {fa(weekly.lastWeek.points)} امتیاز در {fa(weekly.lastWeek.purchases)} خرید
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* --------------------------- Balance bar card ----------------------------- */

function BalanceBarCard({ balance, hasData }: { balance: BalanceDTO; hasData: boolean }) {
  const fa = useFaDigits()
  const p0 = balance.profiles[0]
  const p1 = balance.profiles[1]
  const total = p0.totalPoints + p1.totalPoints
  const leader = balance.delta > 0 ? p0 : balance.delta < 0 ? p1 : null
  const p0Pct = total > 0 ? (p0.totalPoints / total) * 100 : 50
  const p1Pct = total > 0 ? (p1.totalPoints / total) * 100 : 50

  return (
    <Card className="py-0">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">تراز امتیازها</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          className={cn('flex h-3 overflow-hidden rounded-full', !hasData && 'bg-muted')}
          aria-label="نسبت امتیاز دو هم‌خانه"
        >
          {hasData ? (
            <>
              <div
                style={{
                  width: `${p0Pct}%`,
                  backgroundColor: p0.avatarColor,
                  transition: 'width 0.3s ease',
                }}
              />
              <div
                style={{
                  width: `${p1Pct}%`,
                  backgroundColor: p1.avatarColor,
                  transition: 'width 0.3s ease',
                }}
              />
            </>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-3">
          <UserMini
            name={p0.name}
            color={p0.avatarColor}
            points={p0.totalPoints}
            isLeader={leader?.id === p0.id}
          />
          <UserMini
            name={p1.name}
            color={p1.avatarColor}
            points={p1.totalPoints}
            isLeader={leader?.id === p1.id}
          />
        </div>
      </CardContent>
    </Card>
  )
}

/* ------------------------ Delta indicator card ---------------------------- */

function DeltaIndicatorCard({ balance }: { balance: BalanceDTO }) {
  const fa = useFaDigits()
  const positive = balance.delta > 0
  const leaderName = balance.leaderName ?? ''
  const debtorName = balance.nextBuyerName ?? ''

  return (
    <Card
      className={cn(
        'py-0',
        positive
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : 'border-red-500/30 bg-red-500/5',
      )}
    >
      <CardContent className="flex items-center gap-3 py-3">
        {positive ? (
          <TrendingUp className="text-emerald-600 size-5 shrink-0 dark:text-emerald-400" />
        ) : (
          <TrendingDown className="text-red-600 size-5 shrink-0 dark:text-red-400" />
        )}
        <div className="flex-1 text-sm leading-tight">
          <span className="font-medium">{leaderName}</span> جلو است؛ نوبت خرید{' '}
          <span className="font-medium">{debtorName}</span>.
        </div>
        <div
          className={cn(
            'shrink-0 text-lg font-bold tabular-nums',
            positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
          )}
        >
          {fa(Math.abs(balance.delta))}
        </div>
      </CardContent>
    </Card>
  )
}

/* ------------------------- Recent activity card --------------------------- */

function RecentActivityCard({ logs }: { logs: PurchaseLogDTO[] }) {
  const fa = useFaDigits()
  return (
    <Card className="py-0">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="text-muted-foreground size-4" aria-hidden />
          فعالیت اخیر
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {logs.map((log) => (
            <li key={log.id} className="flex items-center gap-2 text-sm">
              <div
                className="flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ backgroundColor: log.buyerColor }}
                aria-hidden
              >
                {profileInitial(log.buyerName)}
              </div>
              <span className="min-w-0 flex-1 truncate">{log.itemTitle}</span>
              <span
                className="bg-emerald-500/15 text-emerald-700 shrink-0 rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums dark:text-emerald-300"
              >
                +{fa(log.pointsAwarded)}
              </span>
              <span className="text-muted-foreground shrink-0 text-xs">
                {formatRelativeFa(log.purchasedAt)}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

/* ------------------------------ Balance view ------------------------------ */

/**
 * Turn-balance view. Renders a hero card that picks the next buyer (or shows
 * a balanced / no-data state), an optional weekly recap, a proportional
 * balance bar with `UserMini` for each side, a delta indicator when out of
 * balance, recent activity (last 6 purchases) and a demo-reset
 * `AlertDialog`. The whole thing collapses to a single Scale / empty state
 * card until at least two profiles exist.
 */
export function BalanceView() {
  const balanceQuery = useBalance()
  const logsQuery = useLogs(50)
  const weeklyQuery = useWeeklyStats()
  const reseed = useReseed()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const balance = balanceQuery.data
  const logs = useMemo(() => (logsQuery.data ?? []).slice(0, 6), [logsQuery.data])
  const weekly = weeklyQuery.data

  if (balanceQuery.isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (!balance || balance.profiles.length < 2) {
    return (
      <Card className="py-6">
        <CardContent className="flex flex-col items-center gap-3 py-2 text-center">
          <span
            aria-hidden
            className="bg-muted text-muted-foreground flex size-14 items-center justify-center rounded-2xl"
          >
            <Scale className="size-7" />
          </span>
          <div className="space-y-1">
            <h3 className="text-base font-semibold">تراز در دسترس نیست</h3>
            <p className="text-muted-foreground text-sm">
              برای محاسبه تراز، حداقل دو پروفایل لازم است.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const hasData = balance.profiles.some((p) => p.totalPoints > 0)
  const isBalanced = balance.delta === 0 && hasData
  const showWeekly = !!weekly && (weekly.thisWeek.purchases > 0 || weekly.lastWeek.purchases > 0)

  return (
    <div className="space-y-3">
      <HeroCard balance={balance} hasData={hasData} />

      {showWeekly && weekly && <WeeklyRecapCard weekly={weekly} />}

      <BalanceBarCard balance={balance} hasData={hasData} />

      {!isBalanced && hasData && <DeltaIndicatorCard balance={balance} />}

      {logs.length > 0 && <RecentActivityCard logs={logs} />}

      <div className="pt-2">
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              className="w-full gap-2"
              disabled={reseed.isPending}
            >
              <RotateCcw className="size-4" />
              {reseed.isPending ? 'در حال بازنشانی…' : 'بازنشانی داده‌های دمو'}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>بازنشانی داده‌های دمو؟</AlertDialogTitle>
              <AlertDialogDescription>
                همه کالاها، خریدها و امتیازها به حالت اولیه برمی‌گردند. این عمل برگشت‌ناپذیر است.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>انصراف</AlertDialogCancel>
              <AlertDialogAction onClick={() => reseed.mutate()}>
                بله، بازنشانی کن
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
