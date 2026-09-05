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
  const categoryId = url.searchParams.get('categoryId') ?? ''
  const rangeParam = (url.searchParams.get('range') ?? 'all') as Range
  const range: Range = RANGES.includes(rangeParam) ? rangeParam : 'all'

  const householdId = ctx?.household?.id ?? null

  const category = await db.category.findUnique({
    where: { id: categoryId },
    select: { id: true, title: true, icon: true, householdId: true },
  })
  if (!category) return NextResponse.json({ error: 'دسته یافت نشد' }, { status: 404 })
  if (category.householdId !== null && (!ctx?.household || category.householdId !== ctx.household.id))
    return NextResponse.json({ error: 'این دسته متعلق به خانه شما نیست' }, { status: 403 })

  const since = rangeStart(range)

  // Items in this category (scoped to household or demo null).
  const itemsInCategory = await db.item.findMany({
    where: { categoryId },
    select: { id: true, title: true },
  })
  const itemIds = new Set(itemsInCategory.map((i) => i.id))

  const where: { householdId: string | null; deletedAt: Date | null; itemId?: { in: string[] }; purchasedAt?: { gte: Date } } = {
    householdId,
    deletedAt: null,
  }
  if (itemIds.size > 0) where.itemId = { in: Array.from(itemIds) }
  else {
    // No items in this category — return empty result.
    return NextResponse.json({
      category: { id: category.id, title: category.title, icon: category.icon },
      totals: { purchases: 0, points: 0, items: 0 },
      perItem: [],
      perBuyer: [],
      recentLogs: [],
    })
  }
  if (since) where.purchasedAt = { gte: since }

  const logs = await db.purchaseLog.findMany({
    where,
    orderBy: { purchasedAt: 'desc' },
    include: { buyer: { select: { id: true, name: true, avatarColor: true } } },
  })

  const purchases = logs.length
  const points = logs.reduce((s, l) => s + l.pointsAwarded, 0)
  const items = itemIds.size

  // perItem
  const perItemMap = new Map<string, { count: number; points: number; lastBuyer: string | null; lastBuyerColor: string | null; lastAt: Date | null }>()
  for (const it of itemsInCategory) {
    perItemMap.set(it.title, { count: 0, points: 0, lastBuyer: null, lastBuyerColor: null, lastAt: null })
  }
  for (const l of logs) {
    // Find item title by itemId.
    const item = itemsInCategory.find((i) => i.id === l.itemId)
    if (!item) continue
    const e = perItemMap.get(item.title)!
    e.count += 1
    e.points += l.pointsAwarded
    if (!e.lastAt || l.purchasedAt > e.lastAt) {
      e.lastAt = l.purchasedAt
      e.lastBuyer = l.buyer?.name ?? null
      e.lastBuyerColor = l.buyer?.avatarColor ?? null
    }
  }
  const perItem = Array.from(perItemMap.entries())
    .map(([itemTitle, v]) => ({
      itemTitle,
      count: v.count,
      points: v.points,
      lastBuyer: v.lastBuyer,
      lastBuyerColor: v.lastBuyerColor,
      lastAt: v.lastAt ? v.lastAt.toISOString() : null,
    }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count || b.points - a.points)

  // perBuyer
  const perBuyerMap = new Map<string, { name: string; avatarColor: string; count: number; points: number }>()
  for (const l of logs) {
    const e = perBuyerMap.get(l.buyerId) ?? { name: l.buyer?.name ?? '—', avatarColor: l.buyer?.avatarColor ?? '#6b7280', count: 0, points: 0 }
    e.count += 1; e.points += l.pointsAwarded
    perBuyerMap.set(l.buyerId, e)
  }
  const perBuyer = Array.from(perBuyerMap.values()).sort((a, b) => b.points - a.points || b.count - a.count)

  // recentLogs — top 10
  const recentLogs = logs.slice(0, 10).map((l) => ({
    id: l.id,
    itemTitle: l.itemTitle,
    buyerName: l.buyer?.name ?? '—',
    buyerColor: l.buyer?.avatarColor ?? '#6b7280',
    pointTier: l.pointTier,
    pointsAwarded: l.pointsAwarded,
    purchasedAt: l.purchasedAt.toISOString(),
  }))

  return NextResponse.json({
    category: { id: category.id, title: category.title, icon: category.icon },
    totals: { purchases, points, items },
    perItem,
    perBuyer,
    recentLogs,
  })
}
