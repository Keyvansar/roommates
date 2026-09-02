import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const RANGES = ['all', '3m', '1m'] as const
type Range = (typeof RANGES)[number]
const VALID_TIERS = [1, 3, 5]

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
  const tierParam = Number(url.searchParams.get('tier') ?? '1')
  const tier = VALID_TIERS.includes(tierParam) ? tierParam : 1
  const rangeParam = (url.searchParams.get('range') ?? 'all') as Range
  const range: Range = RANGES.includes(rangeParam) ? rangeParam : 'all'

  const householdId = ctx?.household?.id ?? null
  const since = rangeStart(range)

  const where: { householdId: string | null; pointTier: number; deletedAt: Date | null; purchasedAt?: { gte: Date } } = {
    householdId,
    pointTier: tier,
    deletedAt: null,
  }
  if (since) where.purchasedAt = { gte: since }

  const logs = await db.purchaseLog.findMany({
    where,
    orderBy: { purchasedAt: 'desc' },
    include: { buyer: { select: { id: true, name: true, avatarColor: true } } },
  })

  const purchases = logs.length
  const points = logs.reduce((s, l) => s + l.pointsAwarded, 0)

  // Items in this tier (for the items count)
  const itemsInTier = await db.item.count({ where: { householdId, pointTier: tier } })

  // ItemId → category lookup.
  const itemIdsInLogs = new Set<string>()
  for (const l of logs) if (l.itemId) itemIdsInLogs.add(l.itemId)
  const itemsWithCats = await db.item.findMany({
    where: { id: { in: Array.from(itemIdsInLogs) } },
    select: { id: true, category: { select: { id: true, title: true, icon: true } } },
  })
  const itemCatMap = new Map<string, { id: string; title: string; icon: string }>()
  for (const it of itemsWithCats) {
    if (it.category) itemCatMap.set(it.id, { id: it.category.id, title: it.category.title, icon: it.category.icon })
  }

  // perBuyer
  const buyerMap = new Map<string, { name: string; avatarColor: string; count: number; points: number }>()
  for (const l of logs) {
    const e = buyerMap.get(l.buyerId) ?? {
      name: l.buyer?.name ?? '—',
      avatarColor: l.buyer?.avatarColor ?? '#6b7280',
      count: 0,
      points: 0,
    }
    e.count += 1; e.points += l.pointsAwarded
    buyerMap.set(l.buyerId, e)
  }
  const perBuyer = Array.from(buyerMap.values()).sort((a, b) => b.points - a.points || b.count - a.count)

  // perCategory
  const catMap = new Map<string, { id: string; title: string; icon: string; count: number; points: number }>()
  for (const l of logs) {
    const cat = l.itemId ? itemCatMap.get(l.itemId) : null
    if (!cat) continue
    const e = catMap.get(cat.id) ?? { id: cat.id, title: cat.title, icon: cat.icon, count: 0, points: 0 }
    e.count += 1; e.points += l.pointsAwarded
    catMap.set(cat.id, e)
  }
  const perCategory = Array.from(catMap.values()).sort((a, b) => b.points - a.points || b.count - a.count)

  // perItem — top 10 by count.
  const perItemMap = new Map<string, { count: number; points: number; categoryTitle: string | null; lastBuyerId: string | null; lastAt: Date | null }>()
  for (const l of logs) {
    const key = l.itemTitle || '—'
    const cat = l.itemId ? itemCatMap.get(l.itemId) : null
    const e = perItemMap.get(key) ?? { count: 0, points: 0, categoryTitle: cat?.title ?? null, lastBuyerId: null, lastAt: null }
    e.count += 1; e.points += l.pointsAwarded
    if (!e.lastAt || l.purchasedAt > e.lastAt) { e.lastAt = l.purchasedAt; e.lastBuyerId = l.buyerId }
    perItemMap.set(key, e)
  }
  const topItemBuyerIds = new Set<string>()
  for (const v of perItemMap.values()) if (v.lastBuyerId) topItemBuyerIds.add(v.lastBuyerId)
  const topItemBuyers = await db.profile.findMany({
    where: { id: { in: Array.from(topItemBuyerIds) } },
    select: { id: true, name: true, avatarColor: true },
  })
  const topItemBuyerMap = new Map<string, { name: string; avatarColor: string }>()
  for (const p of topItemBuyers) topItemBuyerMap.set(p.id, { name: p.name, avatarColor: p.avatarColor })
  const perItem = Array.from(perItemMap.entries())
    .map(([itemTitle, v]) => ({
      itemTitle,
      count: v.count,
      points: v.points,
      categoryTitle: v.categoryTitle,
      lastBuyer: v.lastBuyerId ? (topItemBuyerMap.get(v.lastBuyerId)?.name ?? null) : null,
      lastBuyerColor: v.lastBuyerId ? (topItemBuyerMap.get(v.lastBuyerId)?.avatarColor ?? null) : null,
      lastAt: v.lastAt ? v.lastAt.toISOString() : null,
    }))
    .sort((a, b) => b.count - a.count || b.points - a.points)
    .slice(0, 10)

  // recentLogs — top 10
  const recentLogs = logs.slice(0, 10).map((l) => ({
    id: l.id,
    itemTitle: l.itemTitle,
    buyerName: l.buyer?.name ?? '—',
    buyerColor: l.buyer?.avatarColor ?? '#6b7280',
    pointsAwarded: l.pointsAwarded,
    purchasedAt: l.purchasedAt.toISOString(),
    categoryTitle: l.itemId ? (itemCatMap.get(l.itemId)?.title ?? null) : null,
  }))

  return NextResponse.json({
    tier,
    totals: { purchases, points, items: itemsInTier },
    perBuyer,
    perCategory,
    perItem,
    recentLogs,
  })
}
