import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

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

export async function GET(req: NextRequest) {
  const ctx = await getCurrentUser({ withHousehold: true })
  const url = new URL(req.url)
  const profileId = url.searchParams.get('profileId') ?? ''
  const rangeParam = (url.searchParams.get('range') ?? 'all') as Range
  const range: Range = RANGES.includes(rangeParam) ? rangeParam : 'all'

  const householdId = ctx?.household?.id ?? null

  const profile = await db.profile.findUnique({
    where: { id: profileId },
    select: { id: true, name: true, avatarColor: true, avatarEmoji: true, householdId: true },
  })
  if (!profile) return NextResponse.json({ error: 'پروفایل یافت نشد' }, { status: 404 })
  if (ctx?.household && profile.householdId !== ctx.household.id)
    return NextResponse.json({ error: 'این پروفایل متعلق به خانه شما نیست' }, { status: 403 })
  if (!ctx?.household && profile.householdId !== null)
    return NextResponse.json({ error: 'این پروفایل متعلق به این محیط نیست' }, { status: 403 })

  const since = rangeStart(range)
  const where: { householdId: string | null; buyerId: string; deletedAt: Date | null; purchasedAt?: { gte: Date } } = {
    householdId,
    buyerId: profileId,
    deletedAt: null,
  }
  if (since) where.purchasedAt = { gte: since }

  const logs = await db.purchaseLog.findMany({
    where,
    orderBy: { purchasedAt: 'desc' },
    select: {
      id: true, itemId: true, itemTitle: true, pointTier: true,
      pointsAwarded: true, purchasedAt: true,
    },
  })

  // ItemId → category lookup (for logs that reference an item).
  const itemIdsInLogs = new Set<string>()
  for (const l of logs) if (l.itemId) itemIdsInLogs.add(l.itemId)
  const itemsWithCats = await db.item.findMany({
    where: { id: { in: Array.from(itemIdsInLogs) } },
    select: { id: true, categoryId: true, category: { select: { id: true, title: true, icon: true } } },
  })
  const itemCatMap = new Map<string, { id: string; title: string; icon: string }>()
  for (const it of itemsWithCats) {
    if (it.category) itemCatMap.set(it.id, { id: it.category.id, title: it.category.title, icon: it.category.icon })
  }

  const purchases = logs.length
  const points = logs.reduce((s, l) => s + l.pointsAwarded, 0)
  const usedCategories = new Set<string>()

  // perCategory
  const catMap = new Map<string, { id: string; title: string; icon: string; count: number; points: number }>()
  for (const l of logs) {
    const cat = l.itemId ? itemCatMap.get(l.itemId) : null
    if (cat) {
      usedCategories.add(cat.id)
      const e = catMap.get(cat.id) ?? { id: cat.id, title: cat.title, icon: cat.icon, count: 0, points: 0 }
      e.count += 1; e.points += l.pointsAwarded
      catMap.set(cat.id, e)
    }
  }
  const perCategory = Array.from(catMap.values()).sort((a, b) => b.points - a.points || b.count - a.count)
  const categories = usedCategories.size

  // perItem — top 10 by count.
  const perItemMap = new Map<string, { count: number; points: number; categoryTitle: string | null; lastAt: Date | null }>()
  for (const l of logs) {
    const key = l.itemTitle || '—'
    const cat = l.itemId ? itemCatMap.get(l.itemId) : null
    const e = perItemMap.get(key) ?? { count: 0, points: 0, categoryTitle: cat?.title ?? null, lastAt: null }
    e.count += 1; e.points += l.pointsAwarded
    if (!e.lastAt || l.purchasedAt > e.lastAt) e.lastAt = l.purchasedAt
    perItemMap.set(key, e)
  }
  const perItem = Array.from(perItemMap.entries())
    .map(([itemTitle, v]) => ({
      itemTitle,
      count: v.count,
      points: v.points,
      categoryTitle: v.categoryTitle,
      lastAt: v.lastAt ? v.lastAt.toISOString() : null,
    }))
    .sort((a, b) => b.count - a.count || b.points - a.points)
    .slice(0, 10)

  // perTier
  const tierMap = new Map<number, { count: number; points: number }>([
    [1, { count: 0, points: 0 }],
    [3, { count: 0, points: 0 }],
    [5, { count: 0, points: 0 }],
  ])
  for (const l of logs) {
    const e = tierMap.get(l.pointTier as number)
    if (e) { e.count += 1; e.points += l.pointsAwarded }
  }
  const perTier = Array.from(tierMap.entries())
    .map(([tier, v]) => ({ tier, count: v.count, points: v.points }))
    .sort((a, b) => a.tier - b.tier)

  // recentLogs — top 10
  const recentLogs = logs.slice(0, 10).map((l) => ({
    id: l.id,
    itemTitle: l.itemTitle,
    pointTier: l.pointTier,
    pointsAwarded: l.pointsAwarded,
    purchasedAt: l.purchasedAt.toISOString(),
    categoryTitle: l.itemId ? (itemCatMap.get(l.itemId)?.title ?? null) : null,
  }))

  return NextResponse.json({
    profile: {
      id: profile.id,
      name: profile.name,
      avatarColor: profile.avatarColor,
      avatarEmoji: profile.avatarEmoji ?? null,
    },
    totals: { purchases, points, categories },
    perCategory,
    perItem,
    perTier,
    recentLogs,
  })
}
