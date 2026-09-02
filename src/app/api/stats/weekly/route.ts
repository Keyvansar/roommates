import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export async function GET() {
  const ctx = await getCurrentUser({ withHousehold: true })
  const householdId = ctx?.household?.id ?? null

  const now = new Date()
  const thisWeekStart = new Date(now.getTime() - WEEK_MS)
  const lastWeekStart = new Date(now.getTime() - 2 * WEEK_MS)

  const baseWhere = { householdId, deletedAt: null as Date | null }

  const [thisWeekLogs, lastWeekLogs] = await Promise.all([
    db.purchaseLog.findMany({
      where: { ...baseWhere, purchasedAt: { gte: thisWeekStart } },
      include: { buyer: { select: { id: true, name: true, avatarColor: true } } },
    }),
    db.purchaseLog.findMany({
      where: { ...baseWhere, purchasedAt: { gte: lastWeekStart, lt: thisWeekStart } },
      select: { pointsAwarded: true },
    }),
  ])

  const thisWeekPurchases = thisWeekLogs.length
  const thisWeekPoints = thisWeekLogs.reduce((s, l) => s + l.pointsAwarded, 0)
  const lastWeekPurchases = lastWeekLogs.length
  const lastWeekPoints = lastWeekLogs.reduce((s, l) => s + l.pointsAwarded, 0)

  const buyerMap = new Map<string, { name: string; avatarColor: string; count: number; points: number }>()
  for (const l of thisWeekLogs) {
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

  const delta = thisWeekPoints - lastWeekPoints
  const deltaPct = lastWeekPoints > 0
    ? Math.round((delta / lastWeekPoints) * 100)
    : thisWeekPoints > 0 ? 100 : 0

  return NextResponse.json({
    thisWeek: { purchases: thisWeekPurchases, points: thisWeekPoints, perBuyer },
    lastWeek: { purchases: lastWeekPurchases, points: lastWeekPoints },
    delta,
    deltaPct,
  })
}
