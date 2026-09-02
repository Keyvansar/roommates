'use client'

import { useMemo, useState } from 'react'
import {
  BarChart3,
  Calendar,
  ChevronLeft,
  Crown,
  Download,
  Package,
  ShoppingBag,
  TrendingUp,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { CategoryIcon } from '@/components/category-icon'
import { TierBadge } from '@/components/badges'
import {
  useBuyerStats,
  useCategoryStats,
  useStats,
  useTierStats,
} from '@/hooks/use-data'
import { useFaDigits } from '@/hooks/use-fa-digits'
import { useTierMeta } from '@/hooks/use-tier-meta'
import { formatRelativeFa } from '@/lib/jalali'
import type { PointTier } from '@/lib/types'
import { cn } from '@/lib/utils'

/* ------------------------------- Constants -------------------------------- */

type Range = 'all' | '3m' | '1m'

const RANGE_OPTIONS: { key: Range; label: string }[] = [
  { key: '1m', label: 'ماه اخیر' },
  { key: '3m', label: '۳ ماه' },
  { key: 'all', label: 'همه' },
]

const TIERS: PointTier[] = [1, 3, 5]

const MEDAL_COLORS = ['#f59e0b', '#94a3b8', '#b45309'] // gold, silver, bronze

/* ------------------------------- Helpers ---------------------------------- */

function profileInitial(name: string): string {
  return name?.trim()?.[0] ?? '؟'
}

function hexWithAlpha(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0')
  return `${hex}${a}`
}

/* ------------------------------ Small bits -------------------------------- */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-muted-foreground px-1 text-xs font-medium">{children}</div>
  )
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-muted-foreground flex flex-col items-center gap-2 py-8 text-center text-sm">
      {children}
    </div>
  )
}

function DialogSection({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-2">
      <SectionLabel>{label}</SectionLabel>
      {children}
    </section>
  )
}

/* ----------------------------- Header card -------------------------------- */

function HeaderCard({ range }: { range: Range }) {
  return (
    <Card className="border-0 overflow-hidden py-0">
      <div className="bg-gradient-to-bl from-emerald-500/15 via-emerald-500/10 to-amber-500/15 p-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="bg-emerald-500/20 text-emerald-700 flex size-11 shrink-0 items-center justify-center rounded-xl dark:text-emerald-300"
          >
            <BarChart3 className="size-5" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <h2 className="text-lg font-bold leading-tight">آمار و تحلیل</h2>
            <p className="text-muted-foreground text-xs leading-tight">
              نمایی کلی از خریدها و امتیازهای هم‌خانه
            </p>
          </div>
          <a
            href={`/api/stats/export?range=${range}`}
            download
            className="hover:bg-accent text-muted-foreground hover:text-foreground flex size-9 items-center justify-center rounded-lg border transition-colors"
            aria-label="دانلود خروجی CSV"
            title="دانلود خروجی CSV"
          >
            <Download className="size-4" />
          </a>
        </div>
      </div>
    </Card>
  )
}

/* --------------------------- Range segmented ------------------------------ */

function RangeFilter({
  value,
  onChange,
}: {
  value: Range
  onChange: (r: Range) => void
}) {
  return (
    <div
      role="tablist"
      aria-label="بازه زمانی"
      className="bg-muted text-muted-foreground inline-flex w-full items-center gap-1 rounded-lg p-1 text-xs font-medium"
    >
      {RANGE_OPTIONS.map((opt) => {
        const active = value === opt.key
        return (
          <button
            key={opt.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.key)}
            className={cn(
              'flex-1 rounded-md px-2 py-1.5 text-center transition-colors',
              active
                ? 'bg-background text-foreground shadow-sm'
                : 'hover:text-foreground',
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

/* -------------------------------- KPI grid -------------------------------- */

function KpiCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: string
  color: string
}) {
  return (
    <Card className="py-0">
      <CardContent className="flex flex-col gap-2 p-4">
        <span
          aria-hidden
          className="flex size-9 items-center justify-center rounded-lg"
          style={{ backgroundColor: hexWithAlpha(color, 0.12), color }}
        >
          {icon}
        </span>
        <div>
          <div className="text-2xl font-bold leading-none tabular-nums">{value}</div>
          <div className="text-muted-foreground mt-1 text-xs">{label}</div>
        </div>
      </CardContent>
    </Card>
  )
}

function KpiGrid({
  totals,
}: {
  totals: {
    purchases: number
    points: number
    items: number
    activeDays: number
  }
}) {
  const fa = useFaDigits()
  return (
    <div className="grid grid-cols-2 gap-2">
      <KpiCard
        icon={<ShoppingBag className="size-4" />}
        label="کل خریدها"
        value={fa(totals.purchases)}
        color="#10b981"
      />
      <KpiCard
        icon={<TrendingUp className="size-4" />}
        label="کل امتیاز"
        value={fa(totals.points)}
        color="#f59e0b"
      />
      <KpiCard
        icon={<Package className="size-4" />}
        label="اقلام منحصر"
        value={fa(totals.items)}
        color="#6366f1"
      />
      <KpiCard
        icon={<Calendar className="size-4" />}
        label="روزهای فعال"
        value={fa(totals.activeDays)}
        color="#ec4899"
      />
    </div>
  )
}

/* ------------------------------ Leader card ------------------------------- */

function LeaderCard({
  leader,
  totalPoints,
}: {
  leader: { name: string; avatarColor: string; points: number } | null
  totalPoints: number
}) {
  const fa = useFaDigits()
  const pct = leader && totalPoints > 0 ? Math.round((leader.points / totalPoints) * 100) : 0

  if (!leader) {
    return (
      <Card className="py-0">
        <CardContent className="flex items-center gap-3 p-4">
          <span
            aria-hidden
            className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-xl"
          >
            <Crown className="size-5" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm font-medium">هنوز خریدی ثبت نشده</span>
            <span className="text-muted-foreground text-xs">
              لیدر با اولین خرید مشخص می‌شود
            </span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-amber-500/30 py-0">
      <CardContent className="flex items-center gap-3 p-4">
        <span
          aria-hidden
          className="bg-amber-500/15 text-amber-600 flex size-10 shrink-0 items-center justify-center rounded-xl dark:text-amber-400"
        >
          <Crown className="size-5" />
        </span>
        <div
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ backgroundColor: leader.avatarColor }}
        >
          {profileInitial(leader.name)}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold">{leader.name}</span>
          <span className="text-muted-foreground text-xs tabular-nums">
            {fa(leader.points)} امتیاز · {fa(pct)}٪ از کل
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

/* ---------------------- Per-profile contribution -------------------------- */

function ProfileContribution({
  profiles,
  totalPoints,
  onSelect,
}: {
  profiles: Array<{ id: string; name: string; avatarColor: string; count: number; points: number }>
  totalPoints: number
  onSelect: (id: string) => void
}) {
  const fa = useFaDigits()
  if (profiles.length === 0) return null

  return (
    <div className="space-y-2">
      {profiles.map((p) => {
        const pct = totalPoints > 0 ? (p.points / totalPoints) * 100 : 0
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p.id)}
            className="bg-card hover:bg-accent/40 flex w-full items-center gap-3 rounded-xl border p-3 text-right transition-colors"
          >
            <div
              aria-hidden
              className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: p.avatarColor }}
            >
              {profileInitial(p.name)}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium">{p.name}</span>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {fa(p.count)} خرید · {fa(p.points)} امتیاز
                </span>
              </div>
              <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: p.avatarColor }}
                />
              </div>
            </div>
            <ChevronLeft className="text-muted-foreground size-4 shrink-0" aria-hidden />
          </button>
        )
      })}
    </div>
  )
}

/* ----------------------------- Tier distribution -------------------------- */

function TierDistribution({
  perTier,
  onSelect,
}: {
  perTier: Array<{ tier: number; count: number; points: number }>
  onSelect: (tier: PointTier) => void
}) {
  const fa = useFaDigits()
  const tierMeta = useTierMeta()

  const byTier = new Map<number, { count: number; points: number }>(
    perTier.map((t) => [t.tier, { count: t.count, points: t.points }]),
  )

  return (
    <div className="grid grid-cols-3 gap-2">
      {TIERS.map((t) => {
        const meta = tierMeta[t]
        const e = byTier.get(t) ?? { count: 0, points: 0 }
        const disabled = e.count === 0
        return (
          <button
            key={t}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(t)}
            className={cn(
              'flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition-all',
              disabled
                ? 'opacity-50'
                : 'hover:scale-[1.03] active:scale-[0.98] cursor-pointer',
            )}
            style={{
              borderColor: disabled ? undefined : hexWithAlpha(meta.color, 0.3),
              backgroundColor: disabled ? undefined : hexWithAlpha(meta.color, 0.06),
            }}
          >
            <span
              aria-hidden
              className="inline-block size-2 rounded-full"
              style={{ backgroundColor: meta.color }}
            />
            <span className="text-sm font-semibold">{meta.label}</span>
            <span
              className="text-lg font-bold tabular-nums"
              style={{ color: meta.color }}
            >
              {fa(e.count)}
            </span>
            <span className="text-muted-foreground text-[10px] tabular-nums">
              {fa(e.points)} امتیاز
            </span>
          </button>
        )
      })}
    </div>
  )
}

/* ----------------------------- Category list ------------------------------ */

function CategoryBreakdown({
  categories,
  maxPoints,
  onSelect,
}: {
  categories: Array<{ id: string; title: string; icon: string; count: number; points: number }>
  maxPoints: number
  onSelect: (id: string) => void
}) {
  const fa = useFaDigits()
  if (categories.length === 0) {
    return (
      <EmptyHint>
        <span>دسته‌ای برای نمایش وجود ندارد.</span>
      </EmptyHint>
    )
  }

  return (
    <div className="space-y-2">
      {categories.map((c) => {
        const pct = maxPoints > 0 ? (c.points / maxPoints) * 100 : 0
        return (
          <button
            key={c.id || c.title}
            type="button"
            onClick={() => onSelect(c.id)}
            disabled={!c.id}
            className={cn(
              'bg-card flex w-full items-center gap-3 rounded-xl border p-3 text-right transition-colors',
              c.id ? 'hover:bg-accent/40 cursor-pointer' : 'cursor-default',
            )}
          >
            <span
              aria-hidden
              className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg"
            >
              <CategoryIcon name={c.icon} size={18} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium">{c.title}</span>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {fa(c.count)} خرید · {fa(c.points)} امتیاز
                </span>
              </div>
              <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                <div
                  className="bg-primary h-full rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
            {c.id && (
              <ChevronLeft className="text-muted-foreground size-4 shrink-0" aria-hidden />
            )}
          </button>
        )
      })}
    </div>
  )
}

/* ----------------------------- Monthly trend ------------------------------ */

function MonthlyTrend({
  data,
}: {
  data: Array<{ key: string; label: string; count: number; points: number }>
}) {
  const fa = useFaDigits()
  const W = 320
  const H = 140
  const PAD_X = 18
  const PAD_TOP = 12
  const PAD_BOTTOM = 28
  const plotW = W - PAD_X * 2
  const plotH = H - PAD_TOP - PAD_BOTTOM

  const max = Math.max(1, ...data.map((d) => d.points))
  const min = 0
  const span = max - min || 1
  const n = data.length

  const xAt = (i: number) => PAD_X + (n <= 1 ? plotW / 2 : (i * plotW) / (n - 1))
  const yAt = (v: number) => PAD_TOP + plotH - ((v - min) / span) * plotH

  const linePath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(2)} ${yAt(d.points).toFixed(2)}`)
    .join(' ')
  const areaPath = `${linePath} L ${xAt(n - 1).toFixed(2)} ${PAD_TOP + plotH} L ${xAt(0).toFixed(2)} ${PAD_TOP + plotH} Z`

  const gridLines = [0, 0.25, 0.5, 0.75, 1]

  return (
    <Card className="py-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">روند ماهانه</CardTitle>
      </CardHeader>
      <CardContent className="pb-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label="نمودار روند ماهانه امتیازها"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="insights-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="insights-line" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
          </defs>

          {/* Gridlines */}
          {gridLines.map((g, i) => {
            const y = PAD_TOP + plotH * g
            return (
              <line
                key={i}
                x1={PAD_X}
                y1={y}
                x2={W - PAD_X}
                y2={y}
                stroke="currentColor"
                strokeOpacity={0.08}
                strokeWidth={1}
              />
            )
          })}

          {/* Area fill */}
          {data.length > 1 && <path d={areaPath} fill="url(#insights-area)" />}
          {/* Line */}
          {data.length > 0 && (
            <path
              d={linePath}
              fill="none"
              stroke="url(#insights-line)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* Data points */}
          {data.map((d, i) => (
            <g key={d.key}>
              <circle
                cx={xAt(i)}
                cy={yAt(d.points)}
                r={3.5}
                fill="#ffffff"
                stroke="#10b981"
                strokeWidth={2}
              />
              <text
                x={xAt(i)}
                y={H - 10}
                textAnchor="middle"
                className="fill-muted-foreground"
                style={{ fontSize: 10 }}
              >
                {d.label}
              </text>
            </g>
          ))}
        </svg>
        {data.every((d) => d.count === 0) && (
          <div className="text-muted-foreground mt-1 text-center text-xs">
            در این بازه خریدی ثبت نشده است.
          </div>
        )}
        <div className="text-muted-foreground mt-1 flex items-center justify-between px-1 text-xs tabular-nums">
          <span>بیشینه: {fa(max)} امتیاز</span>
          <span>۶ ماه اخیر</span>
        </div>
      </CardContent>
    </Card>
  )
}

/* ----------------------------- Top items ---------------------------------- */

function TopItems({
  items,
}: {
  items: Array<{ itemTitle: string; count: number; points: number; buyerName: string; buyerColor: string }>
}) {
  const fa = useFaDigits()
  if (items.length === 0) {
    return (
      <EmptyHint>
        <Package className="text-muted-foreground size-6" aria-hidden />
        <span>هنوز کالایی خرید نشده است.</span>
      </EmptyHint>
    )
  }

  return (
    <ol className="space-y-2">
      {items.map((it, i) => {
        const medal = i < 3 ? MEDAL_COLORS[i] : null
        return (
          <li
            key={`${it.itemTitle}-${i}`}
            className="bg-card flex items-center gap-3 rounded-xl border p-3"
          >
            <span
              aria-hidden
              className="flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
              style={medal ? { backgroundColor: medal } : { backgroundColor: '#64748b' }}
            >
              {fa(i + 1)}
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium leading-tight">{it.itemTitle}</span>
              <span className="text-muted-foreground text-xs tabular-nums leading-tight">
                {fa(it.count)} خرید · {fa(it.points)} امتیاز
              </span>
            </div>
            <div
              className="flex items-center gap-1.5"
              title={`آخرین خریدار: ${it.buyerName}`}
            >
              <span
                aria-hidden
                className="flex size-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ backgroundColor: it.buyerColor }}
              >
                {profileInitial(it.buyerName)}
              </span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/* ------------------------------ Skeletons --------------------------------- */

function DrillSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  )
}

/* ------------------------ Per-buyer bars (shared) ------------------------- */

function BuyerBars({
  buyers,
  totalPoints,
}: {
  buyers: Array<{ name: string; avatarColor: string; count: number; points: number }>
  totalPoints: number
}) {
  const fa = useFaDigits()
  if (buyers.length === 0) {
    return <EmptyHint><span>داده‌ای موجود نیست.</span></EmptyHint>
  }
  return (
    <div className="space-y-2.5">
      {buyers.map((b, i) => {
        const pct = totalPoints > 0 ? (b.points / totalPoints) * 100 : 0
        return (
          <div key={`${b.name}-${i}`} className="space-y-1">
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ backgroundColor: b.avatarColor }}
              >
                {profileInitial(b.name)}
              </span>
              <span className="truncate flex-1 text-sm font-medium">{b.name}</span>
              <span className="text-muted-foreground text-xs tabular-nums">
                {fa(b.count)} خرید · {fa(b.points)} امتیاز
              </span>
            </div>
            <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: b.avatarColor }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------- Per-category bars (buyer) ---------------------- */

function CategoryBars({
  categories,
  totalPoints,
  color,
}: {
  categories: Array<{ id: string; title: string; icon: string; count: number; points: number }>
  totalPoints: number
  color: string
}) {
  const fa = useFaDigits()
  if (categories.length === 0) {
    return <EmptyHint><span>دسته‌ای ثبت نشده است.</span></EmptyHint>
  }
  return (
    <div className="space-y-2.5">
      {categories.map((c, i) => {
        const pct = totalPoints > 0 ? (c.points / totalPoints) * 100 : 0
        return (
          <div key={`${c.id || c.title}-${i}`} className="space-y-1">
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="bg-muted flex size-6 shrink-0 items-center justify-center rounded-md"
              >
                <CategoryIcon name={c.icon} size={14} />
              </span>
              <span className="truncate flex-1 text-sm font-medium">{c.title}</span>
              <span className="text-muted-foreground text-xs tabular-nums">
                {fa(c.count)} · {fa(c.points)} امتیاز
              </span>
            </div>
            <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------ Per-tier colored cards -------------------------- */

function TierCards({
  perTier,
}: {
  perTier: Array<{ tier: number; count: number; points: number }>
}) {
  const fa = useFaDigits()
  const tierMeta = useTierMeta()
  const byTier = new Map<number, { count: number; points: number }>(
    perTier.map((t) => [t.tier, { count: t.count, points: t.points }]),
  )
  return (
    <div className="grid grid-cols-3 gap-2">
      {TIERS.map((t) => {
        const meta = tierMeta[t]
        const e = byTier.get(t) ?? { count: 0, points: 0 }
        return (
          <div
            key={t}
            className="flex flex-col items-center gap-1 rounded-xl border p-2.5 text-center"
            style={{
              borderColor: hexWithAlpha(meta.color, 0.3),
              backgroundColor: hexWithAlpha(meta.color, 0.06),
            }}
          >
            <span className="text-xs font-medium">{meta.label}</span>
            <span
              className="text-base font-bold tabular-nums"
              style={{ color: meta.color }}
            >
              {fa(e.count)}
            </span>
            <span className="text-muted-foreground text-[10px] tabular-nums">
              {fa(e.points)} امتیاز
            </span>
          </div>
        )
      })}
    </div>
  )
}

/* ----------------------- Recent logs (variants) -------------------------- */

function RecentLogsCategory({
  logs,
}: {
  logs: Array<{ id: string; itemTitle: string; buyerName: string; buyerColor: string; pointTier: number; pointsAwarded: number; purchasedAt: string }>
}) {
  const fa = useFaDigits()
  if (logs.length === 0) {
    return <EmptyHint><span>خرید اخیری موجود نیست.</span></EmptyHint>
  }
  return (
    <ul className="space-y-2">
      {logs.map((l) => (
        <li key={l.id} className="flex items-center gap-2 text-sm">
          <span
            aria-hidden
            className="flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ backgroundColor: l.buyerColor }}
          >
            {profileInitial(l.buyerName)}
          </span>
          <span className="min-w-0 flex-1 truncate">{l.itemTitle}</span>
          <TierBadge tier={l.pointTier as PointTier} />
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
            {formatRelativeFa(l.purchasedAt)}
          </span>
        </li>
      ))}
    </ul>
  )
}

function RecentLogsBuyer({
  logs,
}: {
  logs: Array<{ id: string; itemTitle: string; pointTier: number; pointsAwarded: number; purchasedAt: string; categoryTitle: string | null }>
}) {
  const fa = useFaDigits()
  if (logs.length === 0) {
    return <EmptyHint><span>خرید اخیری موجود نیست.</span></EmptyHint>
  }
  return (
    <ul className="space-y-2">
      {logs.map((l) => (
        <li key={l.id} className="flex items-center gap-2 text-sm">
          <TierBadge tier={l.pointTier as PointTier} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium leading-tight">{l.itemTitle}</div>
            {l.categoryTitle && (
              <div className="text-muted-foreground truncate text-xs leading-tight">
                {l.categoryTitle}
              </div>
            )}
          </div>
          <span className="bg-emerald-500/15 text-emerald-700 shrink-0 rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums dark:text-emerald-300">
            +{fa(l.pointsAwarded)}
          </span>
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
            {formatRelativeFa(l.purchasedAt)}
          </span>
        </li>
      ))}
    </ul>
  )
}

function RecentLogsTier({
  logs,
}: {
  logs: Array<{ id: string; itemTitle: string; buyerName: string; buyerColor: string; pointsAwarded: number; purchasedAt: string; categoryTitle: string | null }>
}) {
  const fa = useFaDigits()
  if (logs.length === 0) {
    return <EmptyHint><span>خرید اخیری موجود نیست.</span></EmptyHint>
  }
  return (
    <ul className="space-y-2">
      {logs.map((l) => (
        <li key={l.id} className="flex items-center gap-2 text-sm">
          <span
            aria-hidden
            className="flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ backgroundColor: l.buyerColor }}
          >
            {profileInitial(l.buyerName)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium leading-tight">{l.itemTitle}</div>
            {l.categoryTitle && (
              <div className="text-muted-foreground truncate text-xs leading-tight">
                {l.categoryTitle}
              </div>
            )}
          </div>
          <span className="bg-emerald-500/15 text-emerald-700 shrink-0 rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums dark:text-emerald-300">
            +{fa(l.pointsAwarded)}
          </span>
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
            {formatRelativeFa(l.purchasedAt)}
          </span>
        </li>
      ))}
    </ul>
  )
}

/* ------------------------- Ranked items (category) ----------------------- */

function RankedItemsCategory({
  items,
}: {
  items: Array<{ itemTitle: string; count: number; points: number; lastBuyer: string | null; lastBuyerColor: string | null; lastAt: string | null }>
}) {
  const fa = useFaDigits()
  if (items.length === 0) {
    return <EmptyHint><span>کالایی در این دسته ثبت نشده.</span></EmptyHint>
  }
  return (
    <div className="max-h-64 space-y-2 overflow-y-auto scrollbar-thin pr-1">
      <ol className="space-y-2">
        {items.map((it, i) => (
          <li
            key={`${it.itemTitle}-${i}`}
            className="bg-card flex items-center gap-3 rounded-lg border p-2.5"
          >
            <span
              aria-hidden
              className="text-muted-foreground w-6 shrink-0 text-center text-xs font-bold tabular-nums"
            >
              {fa(i + 1)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium leading-tight">{it.itemTitle}</div>
              <div className="text-muted-foreground flex items-center gap-1.5 text-xs leading-tight">
                {it.lastBuyer && (
                  <>
                    <span
                      aria-hidden
                      className="inline-flex size-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
                      style={{ backgroundColor: it.lastBuyerColor ?? '#6b7280' }}
                    >
                      {profileInitial(it.lastBuyer)}
                    </span>
                    <span className="truncate">{it.lastBuyer}</span>
                    {it.lastAt && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="shrink-0 tabular-nums">
                          {formatRelativeFa(it.lastAt)}
                        </span>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
            <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
              {fa(it.count)} ×
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

/* -------------------------- Top items (buyer) ----------------------------- */

function TopItemsBuyer({
  items,
}: {
  items: Array<{ itemTitle: string; count: number; points: number; categoryTitle: string | null; lastAt: string | null }>
}) {
  const fa = useFaDigits()
  if (items.length === 0) {
    return <EmptyHint><span>کالایی ثبت نشده است.</span></EmptyHint>
  }
  return (
    <div className="max-h-64 space-y-2 overflow-y-auto scrollbar-thin pr-1">
      <ol className="space-y-2">
        {items.map((it, i) => (
          <li
            key={`${it.itemTitle}-${i}`}
            className="bg-card flex items-center gap-3 rounded-lg border p-2.5"
          >
            <span
              aria-hidden
              className="text-muted-foreground w-6 shrink-0 text-center text-xs font-bold tabular-nums"
            >
              {fa(i + 1)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium leading-tight">{it.itemTitle}</div>
              {it.categoryTitle && (
                <div className="text-muted-foreground truncate text-xs leading-tight">
                  {it.categoryTitle}
                </div>
              )}
            </div>
            <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
              {fa(it.count)} × · {fa(it.points)} امتیاز
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

/* --------------------------- Top items (tier) ----------------------------- */

function TopItemsTier({
  items,
}: {
  items: Array<{ itemTitle: string; count: number; points: number; categoryTitle: string | null; lastBuyer: string | null; lastBuyerColor: string | null; lastAt: string | null }>
}) {
  const fa = useFaDigits()
  if (items.length === 0) {
    return <EmptyHint><span>کالایی در این تیر ثبت نشده.</span></EmptyHint>
  }
  return (
    <div className="max-h-64 space-y-2 overflow-y-auto scrollbar-thin pr-1">
      <ol className="space-y-2">
        {items.map((it, i) => (
          <li
            key={`${it.itemTitle}-${i}`}
            className="bg-card flex items-center gap-3 rounded-lg border p-2.5"
          >
            <span
              aria-hidden
              className="text-muted-foreground w-6 shrink-0 text-center text-xs font-bold tabular-nums"
            >
              {fa(i + 1)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium leading-tight">{it.itemTitle}</div>
              <div className="text-muted-foreground flex items-center gap-1.5 text-xs leading-tight">
                {it.categoryTitle && <span className="truncate">{it.categoryTitle}</span>}
                {it.lastBuyer && (
                  <>
                    <span aria-hidden>·</span>
                    <span
                      aria-hidden
                      className="inline-flex size-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
                      style={{ backgroundColor: it.lastBuyerColor ?? '#6b7280' }}
                    >
                      {profileInitial(it.lastBuyer)}
                    </span>
                    {it.lastAt && (
                      <span className="shrink-0 tabular-nums">
                        {formatRelativeFa(it.lastAt)}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
            <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
              {fa(it.count)} ×
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

/* --------------------- Per-category list (tier, scroll) -------------------- */

function CategoryListTier({
  categories,
}: {
  categories: Array<{ id: string; title: string; icon: string; count: number; points: number }>
}) {
  const fa = useFaDigits()
  if (categories.length === 0) {
    return <EmptyHint><span>دسته‌ای ثبت نشده است.</span></EmptyHint>
  }
  return (
    <div className="max-h-64 space-y-2 overflow-y-auto scrollbar-thin pr-1">
      <ul className="space-y-2">
        {categories.map((c, i) => (
          <li
            key={`${c.id || c.title}-${i}`}
            className="bg-card flex items-center gap-3 rounded-lg border p-2.5"
          >
            <span
              aria-hidden
              className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-md"
            >
              <CategoryIcon name={c.icon} size={16} />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.title}</span>
            <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
              {fa(c.count)} خرید · {fa(c.points)} امتیاز
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ============================ Drill-down: Category ======================== */

function CategoryDrillDownDialog({
  open,
  onOpenChange,
  categoryId,
  range,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  categoryId: string | null
  range: Range
}) {
  const fa = useFaDigits()
  const query = useCategoryStats(categoryId, range)
  const data = query.data

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-md gap-4 overflow-y-auto p-5 scrollbar-thin sm:max-w-md">
        <DialogHeader>
          {data ? (
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-xl"
              >
                <CategoryIcon name={data.category.icon} size={20} />
              </span>
              <div className="min-w-0">
                <DialogTitle className="truncate text-base">{data.category.title}</DialogTitle>
                <DialogDescription className="text-xs tabular-nums">
                  {fa(data.totals.purchases)} خرید · {fa(data.totals.points)} امتیاز · {fa(data.totals.items)} کالا
                </DialogDescription>
              </div>
            </div>
          ) : (
            <DialogTitle className="text-base">جزئیات دسته</DialogTitle>
          )}
        </DialogHeader>

        {query.isLoading ? (
          <DrillSkeleton />
        ) : !data ? (
          <EmptyHint>
            <span>داده‌ای برای این دسته موجود نیست.</span>
          </EmptyHint>
        ) : data.totals.purchases === 0 ? (
          <EmptyHint>
            <Package className="text-muted-foreground size-6" aria-hidden />
            <span>در این بازه خریدی در این دسته ثبت نشده است.</span>
          </EmptyHint>
        ) : (
          <div className="space-y-4">
            <DialogSection label="سهم هم‌خانه‌ها">
              <BuyerBars buyers={data.perBuyer} totalPoints={data.totals.points} />
            </DialogSection>

            <DialogSection label="پرتکرارترین اقلام">
              <RankedItemsCategory items={data.perItem} />
            </DialogSection>

            <DialogSection label="آخرین خریدها">
              <RecentLogsCategory logs={data.recentLogs} />
            </DialogSection>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/* ============================ Drill-down: Buyer =========================== */

function BuyerDrillDownDialog({
  open,
  onOpenChange,
  profileId,
  range,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  profileId: string | null
  range: Range
}) {
  const fa = useFaDigits()
  const query = useBuyerStats(profileId, range)
  const data = query.data

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-md gap-4 overflow-y-auto p-5 scrollbar-thin sm:max-w-md">
        <DialogHeader>
          {data ? (
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="flex size-10 shrink-0 items-center justify-center rounded-full text-base font-bold text-white"
                style={{ backgroundColor: data.profile.avatarColor }}
              >
                {profileInitial(data.profile.name)}
              </span>
              <div className="min-w-0">
                <DialogTitle className="truncate text-base">{data.profile.name}</DialogTitle>
                <DialogDescription className="text-xs tabular-nums">
                  {fa(data.totals.purchases)} خرید · {fa(data.totals.points)} امتیاز · {fa(data.totals.categories)} دسته
                </DialogDescription>
              </div>
            </div>
          ) : (
            <DialogTitle className="text-base">جزئیات هم‌خانه</DialogTitle>
          )}
        </DialogHeader>

        {query.isLoading ? (
          <DrillSkeleton />
        ) : !data ? (
          <EmptyHint>
            <span>داده‌ای برای این هم‌خانه موجود نیست.</span>
          </EmptyHint>
        ) : data.totals.purchases === 0 ? (
          <EmptyHint>
            <ShoppingBag className="text-muted-foreground size-6" aria-hidden />
            <span>در این بازه خریدی از این هم‌خانه ثبت نشده است.</span>
          </EmptyHint>
        ) : (
          <div className="space-y-4">
            <DialogSection label="دسته‌های خرید‌شده">
              <CategoryBars
                categories={data.perCategory}
                totalPoints={data.totals.points}
                color={data.profile.avatarColor}
              />
            </DialogSection>

            <DialogSection label="توزیع تیرها">
              <TierCards perTier={data.perTier} />
            </DialogSection>

            <DialogSection label="پرتکرارترین اقلام">
              <TopItemsBuyer items={data.perItem} />
            </DialogSection>

            <DialogSection label="آخرین خریدها">
              <RecentLogsBuyer logs={data.recentLogs} />
            </DialogSection>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/* ============================= Drill-down: Tier =========================== */

function TierDrillDownDialog({
  open,
  onOpenChange,
  tier,
  range,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  tier: PointTier | null
  range: Range
}) {
  const fa = useFaDigits()
  const tierMeta = useTierMeta()
  const query = useTierStats(tier, range)
  const data = query.data

  const tierLabel = tier != null ? tierMeta[tier].label : '—'
  const tierColor = tier != null ? tierMeta[tier].color : '#64748b'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-md gap-4 overflow-y-auto p-5 scrollbar-thin sm:max-w-md">
        <DialogHeader>
          {data ? (
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="flex size-10 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: hexWithAlpha(tierColor, 0.12), color: tierColor }}
              >
                <Crown className="size-5" />
              </span>
              <div className="min-w-0">
                <DialogTitle className="truncate text-base">تیر {tierLabel}</DialogTitle>
                <DialogDescription className="text-xs tabular-nums">
                  {fa(data.totals.purchases)} خرید · {fa(data.totals.points)} امتیاز · {fa(data.totals.items)} کالا
                </DialogDescription>
              </div>
            </div>
          ) : (
            <DialogTitle className="text-base">جزئیات تیر</DialogTitle>
          )}
        </DialogHeader>

        {query.isLoading ? (
          <DrillSkeleton />
        ) : !data ? (
          <EmptyHint>
            <span>داده‌ای برای این تیر موجود نیست.</span>
          </EmptyHint>
        ) : data.totals.purchases === 0 ? (
          <EmptyHint>
            <Package className="text-muted-foreground size-6" aria-hidden />
            <span>در این بازه خریدی در این تیر ثبت نشده است.</span>
          </EmptyHint>
        ) : (
          <div className="space-y-4">
            <DialogSection label="سهم هم‌خانه‌ها">
              <BuyerBars buyers={data.perBuyer} totalPoints={data.totals.points} />
            </DialogSection>

            <DialogSection label="دسته‌های خرید‌شده">
              <CategoryListTier categories={data.perCategory} />
            </DialogSection>

            <DialogSection label="پرتکرارترین اقلام">
              <TopItemsTier items={data.perItem} />
            </DialogSection>

            <DialogSection label="آخرین خریدها">
              <RecentLogsTier logs={data.recentLogs} />
            </DialogSection>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/* ============================== Main view ================================= */

export function InsightsView() {
  const [range, setRange] = useState<Range>('all')
  const [drillDownCat, setDrillDownCat] = useState<string | null>(null)
  const [drillDownBuyer, setDrillDownBuyer] = useState<string | null>(null)
  const [drillDownTier, setDrillDownTier] = useState<PointTier | null>(null)

  const statsQuery = useStats(range)

  const stats = statsQuery.data
  const totalPoints = useMemo(
    () => stats?.perProfile.reduce((s, p) => s + p.points, 0) ?? 0,
    [stats?.perProfile],
  )
  const maxCategoryPoints = useMemo(
    () => stats?.perCategory.reduce((m, c) => Math.max(m, c.points), 0) ?? 0,
    [stats?.perCategory],
  )
  const leader = useMemo(() => {
    if (!stats || stats.perProfile.length === 0) return null
    return stats.perProfile[0]
  }, [stats])

  if (statsQuery.isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!stats) {
    return (
      <Card className="py-6">
        <CardContent className="flex flex-col items-center gap-3 py-2 text-center">
          <span
            aria-hidden
            className="bg-muted text-muted-foreground flex size-14 items-center justify-center rounded-2xl"
          >
            <BarChart3 className="size-7" />
          </span>
          <div className="space-y-1">
            <h3 className="text-base font-semibold">داده‌ای موجود نیست</h3>
            <p className="text-muted-foreground text-sm">
              هنوز خریدی ثبت نشده است.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const hasData = stats.totals.purchases > 0

  return (
    <div className="space-y-3">
      <HeaderCard range={range} />

      <RangeFilter value={range} onChange={setRange} />

      <KpiGrid totals={stats.totals} />

      <LeaderCard leader={leader} totalPoints={totalPoints} />

      {hasData && (
        <Card className="py-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">سهم هم‌خانه‌ها</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileContribution
              profiles={stats.perProfile}
              totalPoints={totalPoints}
              onSelect={setDrillDownBuyer}
            />
          </CardContent>
        </Card>
      )}

      <MonthlyTrend data={stats.monthlyTrend} />

      {hasData && (
        <Card className="py-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">دسته‌های خرید‌شده</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryBreakdown
              categories={stats.perCategory}
              maxPoints={maxCategoryPoints}
              onSelect={setDrillDownCat}
            />
          </CardContent>
        </Card>
      )}

      {hasData && (
        <Card className="py-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">توزیع تیرها</CardTitle>
          </CardHeader>
          <CardContent>
            <TierDistribution perTier={stats.perTier} onSelect={setDrillDownTier} />
          </CardContent>
        </Card>
      )}

      {hasData && (
        <Card className="py-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">پرتکرارترین اقلام</CardTitle>
          </CardHeader>
          <CardContent>
            <TopItems items={stats.topItems} />
          </CardContent>
        </Card>
      )}

      {!hasData && (
        <Card className="py-6">
          <CardContent className="flex flex-col items-center gap-3 py-2 text-center">
            <span
              aria-hidden
              className="bg-muted text-muted-foreground flex size-14 items-center justify-center rounded-2xl"
            >
              <BarChart3 className="size-7" />
            </span>
            <div className="space-y-1">
              <h3 className="text-base font-semibold">هنوز خریدی ثبت نشده</h3>
              <p className="text-muted-foreground text-sm">
                با ثبت اولین خرید، نمودارها و تحلیل‌ها ظاهر می‌شوند.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <CategoryDrillDownDialog
        open={!!drillDownCat}
        onOpenChange={(v) => !v && setDrillDownCat(null)}
        categoryId={drillDownCat}
        range={range}
      />
      <BuyerDrillDownDialog
        open={!!drillDownBuyer}
        onOpenChange={(v) => !v && setDrillDownBuyer(null)}
        profileId={drillDownBuyer}
        range={range}
      />
      <TierDrillDownDialog
        open={!!drillDownTier}
        onOpenChange={(v) => !v && setDrillDownTier(null)}
        tier={drillDownTier}
        range={range}
      />
    </div>
  )
}
