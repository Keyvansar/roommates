import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { formatJalaliMonth } from '@/lib/jalali-stats'

export const dynamic = 'force-dynamic'

const RANGES = ['all', '3m', '1m'] as const
type Range = (typeof RANGES)[number]

function rangeStart(range: Range): Date | null {
  if (range === 'all') return null
  const days = range === '1m' ? 30 : 90
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - days)
  return d
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0)
}

export async function GET(req: NextRequest) {
  const ctx = await getCurrentUser({ withHousehold: true })
  const url = new URL(req.url)
  const rangeParam = (url.searchParams.get('range') ?? 'all') as Range
  const range: Range = RANGES.includes(rangeParam) ? rangeParam : 'all'

  const householdId = ctx?.household?.id ?? null
  const since = rangeStart(range)

  const where: { householdId: string | null; deletedAt: Date | null; purchasedAt?: { gte: Date } } = {
    householdId,
    deletedAt: null,
  }
  if (since) where.purchasedAt = { gte: since }

  const logs = await db.purchaseLog.findMany({
    where,
    select: {
      id: true, itemId: true, itemTitle: true, buyerId: true, pointTier: true,
      pointsAwarded: true, purchasedAt: true,
    },
  })

  // Totals
  const purchases = logs.length
  const points = logs.reduce((s, l) => s + l.pointsAwarded, 0)
  const uniqueItems = new Set<string>()
  for (const l of logs) if (l.itemTitle) uniqueItems.add(l.itemTitle)
  const items = uniqueItems.size
  const uniqueDays = new Set<string>()
  for (const l of logs) uniqueDays.add(l.purchasedAt.toISOString().slice(0, 10))
  const activeDays = uniqueDays.size

  // perProfile — sorted by points desc, then count desc.
  const profileMap = new Map<string, { count: number; points: number }>()
  for (const l of logs) {
    const e = profileMap.get(l.buyerId) ?? { count: 0, points: 0 }
    e.count += 1; e.points += l.pointsAwarded
    profileMap.set(l.buyerId, e)
  }
  const profilesInScope = await db.profile.findMany({
    where: { householdId },
    select: { id: true, name: true, avatarColor: true },
  })
  const perProfile = profilesInScope
    .map((p) => ({ id: p.id, name: p.name, avatarColor: p.avatarColor, ...(profileMap.get(p.id) ?? { count: 0, points: 0 }) }))
    .filter((p) => p.count > 0)
    .sort((a, b) => b.points - a.points || b.count - a.count)

  // perCategory — match logs to their item's category.
  const itemIdsInLogs = new Set<string>()
  for (const l of logs) if (l.itemId) itemIdsInLogs.add(l.itemId)
  const itemsWithCats = await db.item.findMany({
    where: { id: { in: Array.from(itemIdsInLogs) } },
    select: { id: true, categoryId: true },
  })
  const itemCatMap = new Map<string, string>()
  for (const it of itemsWithCats) itemCatMap.set(it.id, it.categoryId)
  // Logs without an itemId need a category fallback — we use a synthetic
  // "uncategorized" bucket whose id is ''.
  const catMap = new Map<string, { count: number; points: number }>()
  for (const l of logs) {
    const catId = l.itemId ? (itemCatMap.get(l.itemId) ?? '') : ''
    const e = catMap.get(catId) ?? { count: 0, points: 0 }
    e.count += 1; e.points += l.pointsAwarded
    catMap.set(catId, e)
  }
  const catIds = Array.from(catMap.keys()).filter((k) => k !== '')
  const cats = await db.category.findMany({
    where: { id: { in: catIds } },
    select: { id: true, title: true, icon: true },
  })
  const perCategory = cats
    .map((c) => ({ id: c.id, title: c.title, icon: c.icon, ...(catMap.get(c.id) ?? { count: 0, points: 0 }) }))
    .sort((a, b) => b.points - a.points || b.count - a.count)
  if (catMap.has('')) {
    perCategory.push({ id: '', title: 'بدون دسته', icon: 'Package', ...(catMap.get('') ?? { count: 0, points: 0 }) })
  }

  // perTier
  const tierMap = new Map<number, { count: number; points: number }>([
    [1, { count: 0, points: 0 }],
    [3, { count: 0, points: 0 }],
    [5, { count: 0, points: 0 }],
  ])
  for (const l of logs) {
    const t = l.pointTier as number
    const e = tierMap.get(t)
    if (e) { e.count += 1; e.points += l.pointsAwarded }
  }
  const perTier = Array.from(tierMap.entries())
    .map(([tier, v]) => ({ tier, count: v.count, points: v.points }))
    .sort((a, b) => a.tier - b.tier)

  // monthlyTrend — last 6 months with Jalali labels.
  const now = new Date()
  const months: Array<{ key: string; label: string; count: number; points: number }> = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    months.push({ key, label: formatJalaliMonth(d), count: 0, points: 0 })
  }
  const monthIndex = new Map<string, number>()
  months.forEach((m, i) => monthIndex.set(m.key, i))
  for (const l of logs) {
    const key = `${l.purchasedAt.getFullYear()}-${String(l.purchasedAt.getMonth() + 1).padStart(2, '0')}`
    const idx = monthIndex.get(key)
    if (idx !== undefined) {
      months[idx].count += 1
      months[idx].points += l.pointsAwarded
    }
  }

  // topItems — top 5 by count.
  const itemMap = new Map<string, { count: number; points: number; buyerId: string; purchasedAt: Date }>()
  for (const l of logs) {
    const key = l.itemTitle || '—'
    const e = itemMap.get(key) ?? { count: 0, points: 0, buyerId: l.buyerId, purchasedAt: l.purchasedAt }
    e.count += 1
    e.points += l.pointsAwarded
    if (l.purchasedAt > e.purchasedAt) { e.buyerId = l.buyerId; e.purchasedAt = l.purchasedAt }
    itemMap.set(key, e)
  }
  const topSorted = Array.from(itemMap.entries())
    .sort((a, b) => b[1].count - a[1].count || b[1].points - a[1].points)
    .slice(0, 5)
  const topBuyerIds = new Set<string>(topSorted.map(([, v]) => v.buyerId))
  const topBuyers = await db.profile.findMany({
    where: { id: { in: Array.from(topBuyerIds) } },
    select: { id: true, name: true, avatarColor: true },
  })
  const topBuyerMap = new Map<string, { name: string; avatarColor: string }>()
  for (const p of topBuyers) topBuyerMap.set(p.id, { name: p.name, avatarColor: p.avatarColor })
  const topItems = topSorted.map(([title, v]) => ({
    itemTitle: title,
    count: v.count,
    points: v.points,
    buyerName: topBuyerMap.get(v.buyerId)?.name ?? '—',
    buyerColor: topBuyerMap.get(v.buyerId)?.avatarColor ?? '#6b7280',
  }))

  return NextResponse.json({
    totals: { purchases, points, items, activeDays },
    perProfile,
    perCategory,
    perTier,
    monthlyTrend: months,
    topItems,
  })
}
